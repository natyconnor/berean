import { useCallback, useEffect, useRef, useState } from "react";

import {
  blobToBase64,
  DICTATION_CHUNK_MS,
  DICTATION_FIRST_CHUNK_MS,
  isDevSpeechMockEnabled,
  isDictationSupported,
  openDictationMicStream,
  pickRecorderMimeType,
  rmsFromTimeDomain,
  setDevTranscriptSink,
  SPEECH_RMS_THRESHOLD,
  SPEECH_SILENCE_TIMEOUT_MS,
  stopMediaStream,
  stripWhisperTailJunk,
  isSpaceToggleKey,
} from "@/lib/web-speech";

export type TranscribeAudioFn = (args: {
  audioBase64: string;
  mimeType: string;
}) => Promise<{ text: string }>;

export interface UseWebSpeechDictationOptions {
  /** Latest spoken text for this listening session. */
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

function audioContextConstructor(): (new () => AudioContext) | undefined {
  if (typeof window === "undefined") return undefined;
  if (window.AudioContext) return window.AudioContext;
  const webkit = (
    window as Window & { webkitAudioContext?: new () => AudioContext }
  ).webkitAudioContext;
  return webkit;
}

function recorderCanRequestData(
  recorder: MediaRecorder,
): recorder is MediaRecorder & { requestData: () => void } {
  return typeof recorder.requestData === "function";
}

/**
 * Optional live dictation via MediaRecorder + Groq Whisper.
 *
 * One recording for the whole listen. Periodic snapshots send the audio
 * from t=0 so far (a valid growing file) so words are not chopped at
 * clip boundaries. Typing stays the source of truth: this only streams
 * words into a callback. It never grades, never receives the expected
 * verse, and turns itself off after {@link SPEECH_SILENCE_TIMEOUT_MS}
 * with no speech.
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
  const chunkTimerRef = useRef<number | null>(null);
  const amplitudeTimerRef = useRef<number | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const partsRef = useRef<Blob[]>([]);
  const speechSinceSendRef = useRef(false);
  const silentTicksRef = useRef(0);
  const nextSeqRef = useRef(0);
  const lastAppliedSeqRef = useRef(-1);
  const armSnapshotRef = useRef<(delay: number) => void>(() => {});
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

  const clearChunkTimer = useCallback(() => {
    if (chunkTimerRef.current !== null) {
      window.clearTimeout(chunkTimerRef.current);
      chunkTimerRef.current = null;
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

  const sendSnapshot = useCallback(async (session: number, blob: Blob) => {
    if (sessionRef.current !== session) return;
    if (isDevSpeechMockEnabled()) return;
    if (blob.size < 64) return;
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
      if (seq <= lastAppliedSeqRef.current) return;
      const text = stripWhisperTailJunk(result.text ?? "");
      if (!text) return;
      lastAppliedSeqRef.current = seq;
      committedRef.current = text;
      onTranscriptRef.current(text);
    } catch {
      // The next growing snapshot still includes this audio.
    }
  }, []);

  const ingestRecorderData = useCallback(
    (session: number, blobPart: Blob, mimeType: string) => {
      if (sessionRef.current !== session) return;
      if (blobPart.size > 0) partsRef.current.push(blobPart);
      const hadNewSpeech = speechSinceSendRef.current;
      if (!hadNewSpeech) return;
      const blob = new Blob(partsRef.current, {
        type: mimeType || "audio/webm",
      });
      if (blob.size < 64) return;
      speechSinceSendRef.current = false;
      void sendSnapshot(session, blob);
    },
    [sendSnapshot],
  );

  const stop = useCallback(() => {
    wantRef.current = false;
    setDevTranscriptSink(null);
    clearSilenceTimer();
    clearChunkTimer();
    stopAmplitudeMonitor();
    setListening(false);
    const recorder = recorderRef.current;
    recorderRef.current = null;
    if (recorder && recorder.state !== "inactive") {
      try {
        recorder.stop();
      } catch {
        releaseMicStream();
      }
    } else {
      releaseMicStream();
    }
  }, [
    clearChunkTimer,
    clearSilenceTimer,
    releaseMicStream,
    stopAmplitudeMonitor,
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

  const flushRecorderSnapshot = useCallback(() => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state !== "recording") return;
    if (!speechSinceSendRef.current) return;
    if (recorderCanRequestData(recorder)) recorder.requestData();
  }, []);

  const snapshotRecorder = useCallback(() => {
    // Skip near-silent tails; silence-onset flush / Stop still send last words.
    if (silentTicksRef.current >= 2) return;
    flushRecorderSnapshot();
  }, [flushRecorderSnapshot]);

  const armSnapshot = useCallback(
    (delay: number) => {
      clearChunkTimer();
      chunkTimerRef.current = window.setTimeout(() => {
        chunkTimerRef.current = null;
        snapshotRecorder();
        if (wantRef.current) armSnapshotRef.current(DICTATION_CHUNK_MS);
      }, delay);
    },
    [clearChunkTimer, snapshotRecorder],
  );

  useEffect(() => {
    armSnapshotRef.current = armSnapshot;
  }, [armSnapshot]);

  const startRecorder = useCallback(
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
        stop();
        return;
      }

      partsRef.current = [];
      speechSinceSendRef.current = false;
      recorder.ondataavailable = (event) => {
        if (sessionRef.current !== session) return;
        ingestRecorderData(
          session,
          event.data,
          recorder.mimeType || mimeType || "audio/webm",
        );
      };
      recorder.onerror = () => {
        if (sessionRef.current !== session) return;
        stop();
      };
      recorder.onstop = () => {
        if (recorderRef.current === recorder) recorderRef.current = null;
        if (!wantRef.current) releaseMicStream();
      };

      recorderRef.current = recorder;
      const canRequest = recorderCanRequestData(recorder);
      try {
        if (canRequest) recorder.start();
        else recorder.start(DICTATION_FIRST_CHUNK_MS);
      } catch {
        recorderRef.current = null;
        stop();
        return;
      }

      if (canRequest) armSnapshot(DICTATION_FIRST_CHUNK_MS);
    },
    [armSnapshot, ingestRecorderData, releaseMicStream, stop],
  );

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
          if (rmsFromTimeDomain(session.buffer) < SPEECH_RMS_THRESHOLD) {
            silentTicksRef.current += 1;
            // Flush once as speech ends (~400ms quiet) so the last words go
            // to Groq without a long silent tail on Stop / 5s timeout.
            if (silentTicksRef.current === 2) flushRecorderSnapshot();
            return;
          }
          silentTicksRef.current = 0;
          speechSinceSendRef.current = true;
          armSilenceTimer();
        }, 200);
      } catch {
        stopAmplitudeMonitor();
      }
    },
    [armSilenceTimer, flushRecorderSnapshot, stopAmplitudeMonitor],
  );

  const start = useCallback(() => {
    if (wantRef.current) return;
    if (!isDictationSupported()) return;

    sessionRef.current += 1;
    const session = sessionRef.current;
    committedRef.current = "";
    partsRef.current = [];
    nextSeqRef.current = 0;
    lastAppliedSeqRef.current = -1;
    speechSinceSendRef.current = false;
    silentTicksRef.current = 0;
    wantRef.current = true;
    setListening(true);
    armSilenceTimer();
    setDevTranscriptSink((spoken) => {
      if (sessionRef.current !== session || !wantRef.current) return;
      committedRef.current = stripWhisperTailJunk(spoken);
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
      startRecorder(session, stream);
    });
  }, [armSilenceTimer, startAmplitudeMonitor, startRecorder, stop]);

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
      clearChunkTimer();
      stopAmplitudeMonitor();
      const recorder = recorderRef.current;
      recorderRef.current = null;
      try {
        if (recorder && recorder.state !== "inactive") recorder.stop();
      } catch {
        // ignore
      }
      stopMediaStream(micStreamRef.current);
      micStreamRef.current = null;
    };
  }, [clearChunkTimer, clearSilenceTimer, stopAmplitudeMonitor]);

  return { supported, listening, micStream, start, stop, toggle };
}
