import { useCallback, useEffect, useRef, useState } from "react";

import {
  getSpeechRecognitionCtor,
  isSpeechRecognitionSupported,
  preferContinuousSpeechRecognition,
  setDevTranscriptSink,
  SPEECH_QUICK_END_MS,
  SPEECH_RESTART_GAP_MS,
  SPEECH_SILENCE_TIMEOUT_MS,
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
  const heardSpeechRef = useRef(false);
  const quickEndsRef = useRef(0);

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
    if (!recognition) return;
    try {
      recognition.stop();
    } catch {
      recognitionRef.current = null;
    }
  }, [clearRestartTimer, clearSilenceTimer]);

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
    (recognition: BrowserSpeechRecognition) => {
      lastStartAtRef.current = Date.now();
      heardSpeechRef.current = false;
      try {
        recognition.start();
      } catch {
        stop();
      }
    },
    [stop],
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
        launchRecognition(recognition);
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
    heardSpeechRef.current = false;
    quickEndsRef.current = 0;
    recognitionRef.current = recognition;
    wantRef.current = true;
    setDevTranscriptSink((spoken) => {
      onTranscriptRef.current(spoken);
    });

    recognition.onresult = (event) => {
      if (recognitionRef.current !== recognition || !wantRef.current) return;
      heardSpeechRef.current = true;
      quickEndsRef.current = 0;
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
        event.error === "service-not-allowed" ||
        event.error === "audio-capture"
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
      const elapsed = Date.now() - lastStartAtRef.current;
      if (elapsed < SPEECH_QUICK_END_MS && !heardSpeechRef.current) {
        quickEndsRef.current += 1;
        if (quickEndsRef.current >= 2) {
          stop();
          return;
        }
      } else {
        quickEndsRef.current = 0;
      }
      scheduleRestart(recognition);
    };

    launchRecognition(recognition);
    if (!wantRef.current) {
      clearSilenceTimer();
      return;
    }

    setListening(true);
    armSilenceTimer();
  }, [
    armSilenceTimer,
    clearSilenceTimer,
    launchRecognition,
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
      const recognition = recognitionRef.current;
      recognitionRef.current = null;
      try {
        recognition?.abort();
      } catch {
        // ignore
      }
    };
  }, [clearRestartTimer, clearSilenceTimer]);

  return { supported, listening, start, stop, toggle };
}
