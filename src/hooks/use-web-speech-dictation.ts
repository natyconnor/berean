import { useCallback, useEffect, useRef, useState } from "react";

import { MIN_TRANSCRIBE_AUDIO_BYTES } from "@/lib/dictation-audio";
import { logStt } from "@/lib/dev-log";
import {
  appendSpokenText,
  blobToBase64,
  cloneMediaStreamForAnalysis,
  createUtteranceVad,
  forceEndUtteranceVad,
  isDevSpeechMockEnabled,
  isDictationSupported,
  MAX_UTTERANCE_MS,
  MIN_UTTERANCE_MS,
  openDictationMicStream,
  pickRecorderMimeType,
  raiseNoiseFloorFromRejectedClip,
  rmsFromTimeDomain,
  setDevTranscriptSink,
  shouldSendUtterance,
  SPEECH_SILENCE_TIMEOUT_MS,
  spokenFromWhisper,
  stepUtteranceVad,
  stopMediaStream,
  isSpaceToggleKey,
  VAD_POLL_MS,
  type UtteranceVad,
} from "@/lib/web-speech";

export type TranscribeAudioFn = (args: {
  audioBase64: string;
  mimeType: string;
}) => Promise<{ text: string }>;

export interface UseWebSpeechDictationOptions {
  /** Latest spoken text for this listening session (appended utterances). */
  onTranscript: (spoken: string) => void;
  /** Convex Groq Whisper action. Unused in DEV mockSpeech mode. */
  transcribeAudio: TranscribeAudioFn;
}

export interface WebSpeechDictation {
  supported: boolean;
  listening: boolean;
  /** Shared getUserMedia stream the waveform consumes. */
  micStream: MediaStream | null;
  start: () => void;
  stop: () => void;
  toggle: () => void;
}

type ActiveUtterance = {
  recorder: MediaRecorder;
  parts: Blob[];
  startedAt: number;
  peakRms: number;
  noiseFloor: number;
  maxTimer: number | null;
  stopReason: StopReason;
};

type StopReason = "pause" | "stop" | "max" | "silence" | "error";

function audioContextConstructor(): (new () => AudioContext) | undefined {
  if (typeof window === "undefined") return undefined;
  if (window.AudioContext) return window.AudioContext;
  const webkit = (
    window as Window & { webkitAudioContext?: new () => AudioContext }
  ).webkitAudioContext;
  return webkit;
}

/**
 * Optional live dictation via MediaRecorder + Groq Whisper.
 *
 * Groq is not on-device streaming ASR. The closest honest UX is utterance
 * endpointing: one complete `start()` → `stop()` file per pause (never
 * overlapping windows, never `requestData` / timeslice fragments). Words
 * appear after a short natural pause and are appended, not rewritten.
 * Typing stays the source of truth. This never grades, never receives the
 * expected verse, and turns itself off after
 * {@link SPEECH_SILENCE_TIMEOUT_MS} with no speech.
 */
export function useWebSpeechDictation({
  onTranscript,
  transcribeAudio,
}: UseWebSpeechDictationOptions): WebSpeechDictation {
  const [supported, setSupported] = useState(isDictationSupported);
  const [listening, setListening] = useState(false);
  const [micStream, setMicStream] = useState<MediaStream | null>(null);

  const onTranscriptRef = useRef(onTranscript);
  useEffect(() => {
    onTranscriptRef.current = onTranscript;
  }, [onTranscript]);

  const transcribeRef = useRef(transcribeAudio);
  useEffect(() => {
    transcribeRef.current = transcribeAudio;
  }, [transcribeAudio]);

  const wantRef = useRef(false);
  const sessionRef = useRef(0);
  const committedRef = useRef("");
  const silenceTimerRef = useRef<number | null>(null);
  const amplitudeTimerRef = useRef<number | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const vadStreamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<ActiveUtterance | null>(null);
  const pendingStartRef = useRef(false);
  const vadRef = useRef<UtteranceVad>(createUtteranceVad());
  const pendingRef = useRef(new Map<number, string>());
  const nextSeqRef = useRef(0);
  const appliedSeqRef = useRef(0);
  const beginUtteranceRef = useRef<
    (
      session: number,
      stream: MediaStream,
      peakRms: number,
      floor: number,
    ) => void
  >(() => {});
  const stopActiveRecorderRef = useRef<(reason: StopReason) => void>(() => {});
  const amplitudeRef = useRef<{
    context: AudioContext;
    source: MediaStreamAudioSourceNode;
    analyser: AnalyserNode;
    buffer: Uint8Array<ArrayBuffer>;
  } | null>(null);

  const releaseMicStream = useCallback(() => {
    stopMediaStream(vadStreamRef.current);
    vadStreamRef.current = null;
    stopMediaStream(micStreamRef.current);
    micStreamRef.current = null;
    setMicStream(null);
  }, []);

  const clearSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current !== null) {
      window.clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  }, []);

  const stopAmplitudeMonitor = useCallback(() => {
    if (amplitudeTimerRef.current !== null) {
      window.clearInterval(amplitudeTimerRef.current);
      amplitudeTimerRef.current = null;
    }
    const session = amplitudeRef.current;
    amplitudeRef.current = null;
    if (!session) return;
    try {
      session.source.disconnect();
    } catch {
      // already disconnected
    }
    if (session.context.state !== "closed") {
      void session.context.close();
    }
    stopMediaStream(vadStreamRef.current);
    vadStreamRef.current = null;
  }, []);

  const flushPending = useCallback((session: number) => {
    if (sessionRef.current !== session) return;
    const pending = pendingRef.current;
    while (pending.has(appliedSeqRef.current)) {
      const text = pending.get(appliedSeqRef.current) ?? "";
      pending.delete(appliedSeqRef.current);
      appliedSeqRef.current += 1;
      if (!text) continue;
      committedRef.current = appendSpokenText(committedRef.current, text);
      onTranscriptRef.current(committedRef.current);
      logStt("transcript-apply", {
        seq: appliedSeqRef.current - 1,
        chars: text.length,
        sessionChars: committedRef.current.length,
      });
    }
  }, []);

  const sendUtterance = useCallback(
    async (session: number, blob: Blob, reason: StopReason) => {
      if (sessionRef.current !== session) return;
      if (isDevSpeechMockEnabled()) return;
      if (blob.size < MIN_TRANSCRIBE_AUDIO_BYTES) return;
      const seq = nextSeqRef.current;
      nextSeqRef.current += 1;
      logStt("transcribe-send", {
        seq,
        bytes: blob.size,
        mimeType: blob.type || "audio/webm",
        reason,
      });
      try {
        const audioBase64 = await blobToBase64(blob);
        if (sessionRef.current !== session) return;
        const result = await transcribeRef.current({
          audioBase64,
          mimeType: blob.type || "audio/webm",
        });
        if (sessionRef.current !== session) return;
        const text = spokenFromWhisper(result.text ?? "");
        pendingRef.current.set(seq, text);
        if (text) {
          logStt("transcribe-ok", { seq, chars: text.length });
        } else {
          logStt("transcribe-empty", { seq });
        }
      } catch (error) {
        if (sessionRef.current !== session) return;
        pendingRef.current.set(seq, "");
        logStt("transcribe-error", {
          seq,
          message: error instanceof Error ? error.message : "transcribe failed",
        });
      }
      flushPending(session);
    },
    [flushPending],
  );

  const stopActiveRecorder = useCallback((reason: StopReason) => {
    const active = recorderRef.current;
    if (!active) return;
    if (active.maxTimer !== null) {
      window.clearTimeout(active.maxTimer);
      active.maxTimer = null;
    }
    if (active.recorder.state === "inactive") return;
    active.stopReason = reason;
    try {
      active.recorder.stop();
    } catch {
      recorderRef.current = null;
      logStt("recorder-stop-failed", { reason });
    }
  }, []);

  const finishListening = useCallback(
    (reason: StopReason) => {
      wantRef.current = false;
      pendingStartRef.current = false;
      setDevTranscriptSink(null);
      clearSilenceTimer();
      stopAmplitudeMonitor();
      setListening(false);
      vadRef.current = forceEndUtteranceVad(vadRef.current);
      if (!recorderRef.current) {
        logStt("listen-stop", { reason, flushed: false });
        releaseMicStream();
        return;
      }
      logStt("listen-stop", { reason, flushed: true });
      stopActiveRecorder(reason);
    },
    [
      clearSilenceTimer,
      releaseMicStream,
      stopActiveRecorder,
      stopAmplitudeMonitor,
    ],
  );

  const stop = useCallback(() => {
    finishListening("stop");
  }, [finishListening]);

  useEffect(() => {
    function syncSupport() {
      const next = isDictationSupported();
      setSupported(next);
      if (!next) stop();
    }
    window.addEventListener("hashchange", syncSupport);
    return () => window.removeEventListener("hashchange", syncSupport);
  }, [stop]);

  const armSilenceTimer = useCallback(() => {
    clearSilenceTimer();
    silenceTimerRef.current = window.setTimeout(() => {
      finishListening("silence");
    }, SPEECH_SILENCE_TIMEOUT_MS);
  }, [clearSilenceTimer, finishListening]);

  const beginUtterance = useCallback(
    (
      session: number,
      stream: MediaStream,
      peakRms: number,
      noiseFloor: number,
    ) => {
      if (!wantRef.current || sessionRef.current !== session) return;
      if (recorderRef.current) {
        pendingStartRef.current = true;
        return;
      }
      if (typeof MediaRecorder !== "function") {
        if (isDevSpeechMockEnabled()) return;
        stop();
        return;
      }

      const mimeType = pickRecorderMimeType();
      let recorder: MediaRecorder;
      try {
        recorder = mimeType
          ? new MediaRecorder(stream, { mimeType })
          : new MediaRecorder(stream);
      } catch {
        stop();
        return;
      }

      const parts: Blob[] = [];
      const active: ActiveUtterance = {
        recorder,
        parts,
        startedAt: Date.now(),
        peakRms,
        noiseFloor,
        maxTimer: null,
        stopReason: "pause",
      };
      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) parts.push(event.data);
      };
      recorder.onerror = () => {
        if (sessionRef.current !== session) return;
        stop();
      };
      recorder.onstop = () => {
        if (active.maxTimer !== null) {
          window.clearTimeout(active.maxTimer);
          active.maxTimer = null;
        }
        if (recorderRef.current === active) recorderRef.current = null;
        const type = recorder.mimeType || mimeType || "audio/webm";
        const blob = new Blob(parts, { type });
        const elapsed = Date.now() - active.startedAt;
        const send =
          sessionRef.current === session &&
          blob.size >= MIN_TRANSCRIBE_AUDIO_BYTES &&
          elapsed >= MIN_UTTERANCE_MS &&
          shouldSendUtterance(active.peakRms, active.noiseFloor);
        logStt("utterance-stop", {
          bytes: blob.size,
          ms: elapsed,
          send,
          peakRms: Number(active.peakRms.toFixed(4)),
        });
        if (send) {
          void sendUtterance(session, blob, active.stopReason);
        } else {
          vadRef.current = raiseNoiseFloorFromRejectedClip(vadRef.current);
        }
        const keepGoing = wantRef.current && sessionRef.current === session;
        if (keepGoing && pendingStartRef.current && micStreamRef.current) {
          pendingStartRef.current = false;
          beginUtteranceRef.current(
            session,
            micStreamRef.current,
            vadRef.current.peakRms,
            vadRef.current.noiseFloor,
          );
        } else if (!keepGoing && !recorderRef.current) {
          releaseMicStream();
        }
      };

      recorderRef.current = active;
      try {
        // No timeslice: Groq 400s on incomplete webm/ogg/mp4 fragments.
        recorder.start();
      } catch {
        recorderRef.current = null;
        stop();
        return;
      }

      logStt("utterance-start", { session });
      active.maxTimer = window.setTimeout(() => {
        active.maxTimer = null;
        if (recorderRef.current !== active) return;
        vadRef.current = forceEndUtteranceVad(vadRef.current);
        stopActiveRecorderRef.current("max");
      }, MAX_UTTERANCE_MS);
    },
    [releaseMicStream, sendUtterance, stop],
  );

  useEffect(() => {
    beginUtteranceRef.current = beginUtterance;
  }, [beginUtterance]);

  useEffect(() => {
    stopActiveRecorderRef.current = stopActiveRecorder;
  }, [stopActiveRecorder]);

  const startAmplitudeMonitor = useCallback(
    (stream: MediaStream) => {
      stopAmplitudeMonitor();
      const Context = audioContextConstructor();
      if (!Context) return;
      const vadStream = cloneMediaStreamForAnalysis(stream) ?? stream;
      if (vadStream !== stream) vadStreamRef.current = vadStream;
      try {
        const context = new Context();
        const source = context.createMediaStreamSource(vadStream);
        const analyser = context.createAnalyser();
        analyser.fftSize = 1024;
        analyser.smoothingTimeConstant = 0.4;
        source.connect(analyser);
        if (context.state === "suspended") void context.resume();
        const buffer = new Uint8Array(new ArrayBuffer(analyser.fftSize));
        amplitudeRef.current = { context, source, analyser, buffer };
        amplitudeTimerRef.current = window.setInterval(() => {
          const graph = amplitudeRef.current;
          if (!graph || !wantRef.current) return;
          graph.analyser.getByteTimeDomainData(graph.buffer);
          const rms = rmsFromTimeDomain(graph.buffer);
          const session = sessionRef.current;
          const stepped = stepUtteranceVad(vadRef.current, rms, VAD_POLL_MS);
          vadRef.current = stepped.vad;
          if (
            stepped.event === "start" ||
            (stepped.vad.inUtterance && stepped.vad.silenceRunMs === 0)
          ) {
            armSilenceTimer();
          }
          const active = recorderRef.current;
          if (active && stepped.vad.peakRms > 0) {
            active.peakRms = Math.max(active.peakRms, stepped.vad.peakRms);
          }
          if (stepped.event === "start" && micStreamRef.current) {
            beginUtteranceRef.current(
              session,
              micStreamRef.current,
              stepped.vad.peakRms,
              stepped.vad.noiseFloor,
            );
          } else if (stepped.event === "end") {
            stopActiveRecorderRef.current("pause");
          }
        }, VAD_POLL_MS);
      } catch {
        if (vadStream !== stream) {
          stopMediaStream(vadStream);
          vadStreamRef.current = null;
        }
        stopAmplitudeMonitor();
      }
    },
    [armSilenceTimer, stopAmplitudeMonitor],
  );

  const start = useCallback(() => {
    if (wantRef.current) return;
    if (!isDictationSupported()) return;

    sessionRef.current += 1;
    const session = sessionRef.current;
    committedRef.current = "";
    pendingRef.current = new Map();
    nextSeqRef.current = 0;
    appliedSeqRef.current = 0;
    recorderRef.current = null;
    pendingStartRef.current = false;
    vadRef.current = createUtteranceVad();
    wantRef.current = true;
    setListening(true);
    armSilenceTimer();
    logStt("listen-start", { session });
    setDevTranscriptSink((spoken) => {
      if (sessionRef.current !== session || !wantRef.current) return;
      committedRef.current = appendSpokenText(
        committedRef.current,
        spokenFromWhisper(spoken),
      );
      onTranscriptRef.current(committedRef.current);
    });

    void openDictationMicStream().then((stream) => {
      if (!wantRef.current || sessionRef.current !== session) {
        stopMediaStream(stream);
        return;
      }
      if (!stream) {
        if (isDevSpeechMockEnabled()) return;
        stop();
        return;
      }
      micStreamRef.current = stream;
      setMicStream(stream);
      startAmplitudeMonitor(stream);
    });
  }, [armSilenceTimer, startAmplitudeMonitor, stop]);

  const toggle = useCallback(() => {
    if (wantRef.current) {
      stop();
      return;
    }
    start();
  }, [start, stop]);

  useEffect(() => {
    if (!listening) return;
    function onKeyDown(event: KeyboardEvent) {
      if (!isSpaceToggleKey(event)) return;
      event.preventDefault();
      stop();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [listening, stop]);

  useEffect(() => {
    return () => {
      wantRef.current = false;
      sessionRef.current += 1;
      setDevTranscriptSink(null);
      clearSilenceTimer();
      stopAmplitudeMonitor();
      const active = recorderRef.current;
      recorderRef.current = null;
      if (active?.maxTimer !== null && active) {
        window.clearTimeout(active.maxTimer);
      }
      try {
        if (active && active.recorder.state !== "inactive") {
          active.recorder.stop();
        }
      } catch {
        // ignore
      }
      stopMediaStream(vadStreamRef.current);
      vadStreamRef.current = null;
      stopMediaStream(micStreamRef.current);
      micStreamRef.current = null;
    };
  }, [clearSilenceTimer, stopAmplitudeMonitor]);

  return { supported, listening, micStream, start, stop, toggle };
}
