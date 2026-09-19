import { useCallback, useEffect, useRef, useState } from "react";

import { MIN_TRANSCRIBE_AUDIO_BYTES } from "@/lib/dictation-audio";
import {
  blobToBase64,
  DICTATION_CHUNK_MS,
  DICTATION_OVERLAP_MS,
  isDevSpeechMockEnabled,
  isDictationSupported,
  openDictationMicStream,
  pickRecorderMimeType,
  rmsFromTimeDomain,
  setDevTranscriptSink,
  SPEECH_RMS_THRESHOLD,
  SPEECH_SILENCE_TIMEOUT_MS,
  stitchSpokenText,
  stopMediaStream,
  stripWhisperTailJunk,
  isSpaceToggleKey,
} from "@/lib/web-speech";

export type TranscribeAudioFn = (args: {
  audioBase64: string;
  mimeType: string;
}) => Promise<{ text: string }>;

export interface UseWebSpeechDictationOptions {
  /** Latest spoken text for this listening session (stitched clips). */
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

type RecorderLane = {
  recorder: MediaRecorder;
  hadSpeech: boolean;
  stopTimer: number | null;
};

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
 * Groq only accepts complete files, so each clip is `start()` → `stop()`
 * (never `requestData` / timeslice fragments). Two overlapping recorders
 * cover the word at a clip boundary. Typing stays the source of truth:
 * this only streams words into a callback. It never grades, never receives
 * the expected verse, and turns itself off after
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
  const overlapTimerRef = useRef<number | null>(null);
  const amplitudeTimerRef = useRef<number | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const lanesRef = useRef<RecorderLane[]>([]);
  const pendingRef = useRef(new Map<number, string>());
  const nextSeqRef = useRef(0);
  const appliedSeqRef = useRef(0);
  const beginLaneRef = useRef<(session: number, stream: MediaStream) => void>(
    () => {},
  );
  const amplitudeRef = useRef<{
    context: AudioContext;
    source: MediaStreamAudioSourceNode;
    analyser: AnalyserNode;
    buffer: Uint8Array<ArrayBuffer>;
  } | null>(null);

  const releaseMicStream = useCallback(() => {
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

  const clearOverlapTimer = useCallback(() => {
    if (overlapTimerRef.current !== null) {
      window.clearTimeout(overlapTimerRef.current);
      overlapTimerRef.current = null;
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
  }, []);

  const flushPending = useCallback((session: number) => {
    if (sessionRef.current !== session) return;
    const pending = pendingRef.current;
    while (pending.has(appliedSeqRef.current)) {
      const text = pending.get(appliedSeqRef.current) ?? "";
      pending.delete(appliedSeqRef.current);
      appliedSeqRef.current += 1;
      if (!text) continue;
      committedRef.current = stitchSpokenText(committedRef.current, text);
      onTranscriptRef.current(committedRef.current);
    }
  }, []);

  const sendChunk = useCallback(
    async (session: number, blob: Blob) => {
      if (sessionRef.current !== session) return;
      if (isDevSpeechMockEnabled()) return;
      if (blob.size < MIN_TRANSCRIBE_AUDIO_BYTES) return;
      const seq = nextSeqRef.current;
      nextSeqRef.current += 1;
      try {
        const audioBase64 = await blobToBase64(blob);
        if (sessionRef.current !== session) return;
        const result = await transcribeRef.current({
          audioBase64,
          mimeType: blob.type || "audio/webm",
        });
        if (sessionRef.current !== session) return;
        pendingRef.current.set(seq, stripWhisperTailJunk(result.text ?? ""));
      } catch {
        if (sessionRef.current !== session) return;
        pendingRef.current.set(seq, "");
      }
      flushPending(session);
    },
    [flushPending],
  );

  const stopLanes = useCallback(() => {
    const lanes = [...lanesRef.current];
    for (const lane of lanes) {
      if (lane.stopTimer !== null) {
        window.clearTimeout(lane.stopTimer);
        lane.stopTimer = null;
      }
      if (lane.recorder.state !== "inactive") {
        try {
          lane.recorder.stop();
        } catch {
          // onstop still runs for a successful stop()
        }
      }
    }
  }, []);

  const stop = useCallback(() => {
    wantRef.current = false;
    setDevTranscriptSink(null);
    clearSilenceTimer();
    clearOverlapTimer();
    stopAmplitudeMonitor();
    setListening(false);
    if (lanesRef.current.length === 0) {
      releaseMicStream();
      return;
    }
    stopLanes();
  }, [
    clearOverlapTimer,
    clearSilenceTimer,
    releaseMicStream,
    stopAmplitudeMonitor,
    stopLanes,
  ]);

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
      stop();
    }, SPEECH_SILENCE_TIMEOUT_MS);
  }, [clearSilenceTimer, stop]);

  const beginLane = useCallback(
    (session: number, stream: MediaStream) => {
      if (!wantRef.current || sessionRef.current !== session) return;
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
        if (lanesRef.current.length === 0) stop();
        return;
      }

      const parts: Blob[] = [];
      const lane: RecorderLane = {
        recorder,
        hadSpeech: false,
        stopTimer: null,
      };
      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) parts.push(event.data);
      };
      recorder.onerror = () => {
        if (sessionRef.current !== session) return;
        stop();
      };
      recorder.onstop = () => {
        lanesRef.current = lanesRef.current.filter((item) => item !== lane);
        if (lane.stopTimer !== null) {
          window.clearTimeout(lane.stopTimer);
          lane.stopTimer = null;
        }
        const type = recorder.mimeType || mimeType || "audio/webm";
        const blob = new Blob(parts, { type });
        const keepGoing = wantRef.current && sessionRef.current === session;
        if (keepGoing && micStreamRef.current) {
          beginLaneRef.current(session, micStreamRef.current);
        } else if (!wantRef.current && lanesRef.current.length === 0) {
          releaseMicStream();
        }
        if (
          sessionRef.current === session &&
          lane.hadSpeech &&
          blob.size >= 64
        ) {
          void sendChunk(session, blob);
        }
      };

      lanesRef.current.push(lane);
      try {
        // No timeslice: Groq 400s on incomplete webm/ogg/mp4 fragments.
        recorder.start();
      } catch {
        lanesRef.current = lanesRef.current.filter((item) => item !== lane);
        if (lanesRef.current.length === 0) stop();
        return;
      }

      lane.stopTimer = window.setTimeout(() => {
        lane.stopTimer = null;
        if (lane.recorder.state === "inactive") return;
        try {
          lane.recorder.stop();
        } catch {
          stop();
        }
      }, DICTATION_CHUNK_MS);
    },
    [releaseMicStream, sendChunk, stop],
  );

  useEffect(() => {
    beginLaneRef.current = beginLane;
  }, [beginLane]);

  const startAmplitudeMonitor = useCallback(
    (stream: MediaStream) => {
      stopAmplitudeMonitor();
      const Context = audioContextConstructor();
      if (!Context) return;
      try {
        const context = new Context();
        const source = context.createMediaStreamSource(stream);
        const analyser = context.createAnalyser();
        analyser.fftSize = 1024;
        analyser.smoothingTimeConstant = 0.4;
        source.connect(analyser);
        if (context.state === "suspended") void context.resume();
        const buffer = new Uint8Array(new ArrayBuffer(analyser.fftSize));
        amplitudeRef.current = { context, source, analyser, buffer };
        amplitudeTimerRef.current = window.setInterval(() => {
          const session = amplitudeRef.current;
          if (!session || !wantRef.current) return;
          session.analyser.getByteTimeDomainData(session.buffer);
          if (rmsFromTimeDomain(session.buffer) < SPEECH_RMS_THRESHOLD) return;
          for (const lane of lanesRef.current) lane.hadSpeech = true;
          armSilenceTimer();
        }, 200);
      } catch {
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
    lanesRef.current = [];
    wantRef.current = true;
    setListening(true);
    armSilenceTimer();
    setDevTranscriptSink((spoken) => {
      if (sessionRef.current !== session || !wantRef.current) return;
      committedRef.current = stitchSpokenText(
        committedRef.current,
        stripWhisperTailJunk(spoken),
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
      beginLane(session, stream);
      overlapTimerRef.current = window.setTimeout(() => {
        overlapTimerRef.current = null;
        if (!wantRef.current || sessionRef.current !== session) return;
        if (!micStreamRef.current) return;
        beginLane(session, micStreamRef.current);
      }, DICTATION_OVERLAP_MS);
    });
  }, [armSilenceTimer, beginLane, startAmplitudeMonitor, stop]);

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
      clearOverlapTimer();
      stopAmplitudeMonitor();
      const lanes = [...lanesRef.current];
      lanesRef.current = [];
      for (const lane of lanes) {
        if (lane.stopTimer !== null) window.clearTimeout(lane.stopTimer);
        try {
          if (lane.recorder.state !== "inactive") lane.recorder.stop();
        } catch {
          // ignore
        }
      }
      stopMediaStream(micStreamRef.current);
      micStreamRef.current = null;
    };
  }, [clearOverlapTimer, clearSilenceTimer, stopAmplitudeMonitor]);

  return { supported, listening, micStream, start, stop, toggle };
}
