import { useCallback, useEffect, useRef, useState } from "react";

import {
  getSpeechRecognitionCtor,
  isSpeechRecognitionSupported,
  liveAudioTrack,
  openDictationMicStream,
  preferContinuousSpeechRecognition,
  setDevTranscriptSink,
  speechRecognitionAcceptsAudioTrack,
  SPEECH_RESTART_GAP_MS,
  SPEECH_SILENCE_TIMEOUT_MS,
  stopMediaStream,
  type BrowserSpeechRecognition,
  isSpaceToggleKey,
} from "@/lib/web-speech";

export interface UseWebSpeechDictationOptions {
  /** Latest spoken text for this listening session (finals + current interim). */
  onTranscript: (spoken: string) => void;
}

export interface WebSpeechDictation {
  supported: boolean;
  listening: boolean;
  /** Shared getUserMedia stream when recognition can consume an audio track. */
  micStream: MediaStream | null;
  start: () => void;
  stop: () => void;
  toggle: () => void;
}

function transcriptFromResults(results: SpeechRecognitionResultList): {
  committed: string;
  display: string;
} {
  let committed = "";
  let interim = "";
  for (let i = 0; i < results.length; i += 1) {
    const result = results[i];
    if (!result) continue;
    const piece = result[0]?.transcript ?? "";
    if (result.isFinal) {
      const trimmed = piece.trim();
      if (!trimmed) continue;
      committed = committed ? `${committed} ${trimmed}` : trimmed;
    } else {
      interim += piece;
    }
  }
  const interimTrimmed = interim.trim();
  const display = interimTrimmed
    ? committed
      ? `${committed} ${interimTrimmed}`
      : interimTrimmed
    : committed;
  return { committed, display };
}

/**
 * Optional live dictation via the browser Web Speech API.
 *
 * Typing stays the source of truth: this only streams words into a callback.
 * It never grades, never receives the expected verse, and turns itself off
 * after {@link SPEECH_SILENCE_TIMEOUT_MS} with no speech.
 */
export function useWebSpeechDictation({
  onTranscript,
}: UseWebSpeechDictationOptions): WebSpeechDictation {
  const [supported, setSupported] = useState(isSpeechRecognitionSupported);
  const [listening, setListening] = useState(false);
  const [micStream, setMicStream] = useState<MediaStream | null>(null);

  const onTranscriptRef = useRef(onTranscript);
  useEffect(() => {
    onTranscriptRef.current = onTranscript;
  }, [onTranscript]);

  const wantRef = useRef(false);
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const committedRef = useRef("");
  const prefixRef = useRef("");
  const silenceTimerRef = useRef<number | null>(null);
  const restartTimerRef = useRef<number | null>(null);
  const lastStartAtRef = useRef(0);
  const micStreamRef = useRef<MediaStream | null>(null);
  const audioTrackRef = useRef<MediaStreamTrack | undefined>(undefined);

  const releaseMicStream = useCallback(() => {
    stopMediaStream(micStreamRef.current);
    micStreamRef.current = null;
    audioTrackRef.current = undefined;
    setMicStream(null);
  }, []);

  const clearSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current !== null) {
      window.clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  }, []);

  const clearRestartTimer = useCallback(() => {
    if (restartTimerRef.current !== null) {
      window.clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    wantRef.current = false;
    setDevTranscriptSink(null);
    clearSilenceTimer();
    clearRestartTimer();
    setListening(false);
    const recognition = recognitionRef.current;
    if (recognition) {
      try {
        recognition.stop();
      } catch {
        recognitionRef.current = null;
      }
    }
    // Release capture after stop() so start(audioTrack) is not starved by
    // ended tracks during the engine's own teardown.
    releaseMicStream();
  }, [clearRestartTimer, clearSilenceTimer, releaseMicStream]);

  useEffect(() => {
    function syncSupport() {
      const next = isSpeechRecognitionSupported();
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

  const launchRecognition = useCallback(
    (recognition: BrowserSpeechRecognition, audioTrack?: MediaStreamTrack) => {
      lastStartAtRef.current = Date.now();
      const shared = liveAudioTrack(micStreamRef.current) ?? audioTrack;
      try {
        if (shared && shared.readyState === "live") {
          audioTrackRef.current = shared;
          recognition.start(shared);
          return;
        }
        // Holding getUserMedia while calling start() without a track opens a
        // second capture on Mac Chrome and leaves this recognizer deaf.
        if (micStreamRef.current) {
          releaseMicStream();
        }
        audioTrackRef.current = undefined;
        recognition.start();
      } catch {
        releaseMicStream();
        try {
          recognition.start();
        } catch {
          stop();
        }
      }
    },
    [releaseMicStream, stop],
  );

  const scheduleRestart = useCallback(
    (recognition: BrowserSpeechRecognition) => {
      clearRestartTimer();
      const wait = Math.max(
        0,
        SPEECH_RESTART_GAP_MS - (Date.now() - lastStartAtRef.current),
      );
      restartTimerRef.current = window.setTimeout(() => {
        restartTimerRef.current = null;
        if (!wantRef.current) return;
        if (recognitionRef.current !== recognition) return;
        launchRecognition(recognition, audioTrackRef.current);
      }, wait);
    },
    [clearRestartTimer, launchRecognition],
  );

  const start = useCallback(() => {
    if (wantRef.current) return;
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) return;

    const previous = recognitionRef.current;
    if (previous) {
      recognitionRef.current = null;
      try {
        previous.abort();
      } catch {
        // ignore a recognizer that is already closed
      }
    }

    const recognition = new Ctor();
    recognition.continuous = preferContinuousSpeechRecognition();
    recognition.interimResults = true;
    recognition.lang = "en-US";
    // Do not set grammars, phrases, or any other hint — never the verse text.

    committedRef.current = "";
    prefixRef.current = "";
    recognitionRef.current = recognition;
    wantRef.current = true;
    setDevTranscriptSink((spoken) => {
      onTranscriptRef.current(spoken);
    });

    recognition.onresult = (event) => {
      if (recognitionRef.current !== recognition || !wantRef.current) return;
      armSilenceTimer();
      const next = transcriptFromResults(event.results);
      committedRef.current = next.committed;
      const prefix = prefixRef.current;
      const display = prefix
        ? next.display
          ? `${prefix} ${next.display}`
          : prefix
        : next.display;
      onTranscriptRef.current(display);
    };

    recognition.onspeechstart = () => {
      if (recognitionRef.current !== recognition) return;
      if (wantRef.current) armSilenceTimer();
    };

    recognition.onerror = (event) => {
      if (recognitionRef.current !== recognition) return;
      // no-speech / aborted are normal engine teardown; onend decides whether
      // to reconnect. Stopping here races the restart and kills the session.
      if (
        event.error === "not-allowed" ||
        event.error === "service-not-allowed"
      ) {
        stop();
      }
    };

    recognition.onend = () => {
      if (recognitionRef.current !== recognition) return;
      if (!wantRef.current) {
        recognitionRef.current = null;
        setListening(false);
        return;
      }
      // Chrome drops the session after a pause; keep listening until silence.
      const sessionSoFar = [prefixRef.current, committedRef.current]
        .filter((part) => part.length > 0)
        .join(" ");
      prefixRef.current = sessionSoFar;
      committedRef.current = "";
      // Chrome often ends as soon as it starts, especially with start(audioTrack).
      // Do not treat that as a fatal cutoff — the 5s silence timer is the only
      // auto-stop. The restart gap prevents a synchronous onend → start loop.
      scheduleRestart(recognition);
    };

    const begin = (audioTrack?: MediaStreamTrack) => {
      if (!wantRef.current || recognitionRef.current !== recognition) {
        if (audioTrack) stopMediaStream(micStreamRef.current);
        return;
      }
      audioTrackRef.current = audioTrack;
      launchRecognition(recognition, audioTrack);
      if (!wantRef.current) {
        clearSilenceTimer();
        releaseMicStream();
      }
    };

    const shareMic =
      speechRecognitionAcceptsAudioTrack() &&
      typeof navigator.mediaDevices?.getUserMedia === "function";

    setListening(true);
    armSilenceTimer();

    if (!shareMic) {
      begin();
      return;
    }

    void openDictationMicStream().then((stream) => {
      if (!wantRef.current || recognitionRef.current !== recognition) {
        stopMediaStream(stream);
        return;
      }
      micStreamRef.current = stream;
      setMicStream(stream);
      begin(stream?.getAudioTracks()[0]);
    });
  }, [
    armSilenceTimer,
    clearSilenceTimer,
    launchRecognition,
    releaseMicStream,
    scheduleRestart,
    stop,
  ]);

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
      setDevTranscriptSink(null);
      clearSilenceTimer();
      clearRestartTimer();
      stopMediaStream(micStreamRef.current);
      micStreamRef.current = null;
      audioTrackRef.current = undefined;
      const recognition = recognitionRef.current;
      recognitionRef.current = null;
      try {
        recognition?.abort();
      } catch {
        // ignore
      }
    };
  }, [clearRestartTimer, clearSilenceTimer]);

  return { supported, listening, micStream, start, stop, toggle };
}
