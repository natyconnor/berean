/**
 * Optional recall dictation helpers.
 *
 * Recording is getUserMedia + MediaRecorder. Transcription is Groq Whisper
 * via a Convex action. The recorder is never given the expected verse as a
 * prompt or hint.
 */

export const SPEECH_SILENCE_TIMEOUT_MS = 5_000;

/** Analyser poll for utterance VAD. Faster than UI; still cheap. */
export const VAD_POLL_MS = 50;

/**
 * Quiet hangover after speech before we `stop()` the recorder and send.
 * Groq is not streaming ASR — this is the honest “words after a pause” beat.
 */
export const UTTERANCE_END_MS = 700;

/** Consecutive speech energy required before opening a recorder (anti-click). */
export const SPEECH_START_MS = 80;

/** Drop accidental Stop taps / aborted noise clips. */
export const MIN_UTTERANCE_MS = 220;

/** Safety valve if VAD never hears a pause (steady noise, stuck energy). */
export const MAX_UTTERANCE_MS = 30_000;

/** Absolute RMS floor. Adaptive noise sits on top of this. */
export const SPEECH_RMS_THRESHOLD = 0.02;

/** Peak must clear the start threshold by this much or the clip is noise. */
export const SPEECH_PEAK_MARGIN = 0.025;

export const NOISE_FLOOR_INIT = 0.012;
export const NOISE_FLOOR_MIN = 0.003;
export const NOISE_FLOOR_MAX = 0.08;
const NOISE_FLOOR_DOWN = 0.18;
const NOISE_FLOOR_UP = 0.04;

/** DEV-only: click "Insert spoken sample" while listening to stream a transcript. */
export const DEV_MOCK_SPEECH_EMIT_EVENT = "berean:mock-speech-emit";

const RECORDER_MIME_CANDIDATES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/ogg;codecs=opus",
  "audio/mp4",
] as const;

export function isSpaceToggleKey(event: {
  repeat: boolean;
  metaKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  key: string;
  code: string;
}): boolean {
  if (event.repeat || event.metaKey || event.ctrlKey || event.altKey) {
    return false;
  }
  return event.key === " " || event.key === "Space" || event.code === "Space";
}

function paramsHaveFlag(source: string, flag: string): boolean {
  const query =
    source.startsWith("#") || source.startsWith("?") ? source.slice(1) : source;
  return new URLSearchParams(query).has(flag);
}

function readDevSpeechFlags(): { hide: boolean; mock: boolean } {
  try {
    const search = window.location.search;
    const hash = window.location.hash;
    const hide =
      paramsHaveFlag(search, "hideSpeech") ||
      paramsHaveFlag(hash, "hideSpeech");
    const mock =
      paramsHaveFlag(search, "mockSpeech") ||
      paramsHaveFlag(hash, "mockSpeech");
    // Hash flags survive TanStack search validation, which strips unknown
    // query keys such as mockSpeech from /memory/learn.
    if (hide && !mock) {
      window.localStorage.setItem("berean:hideSpeech", "1");
      window.localStorage.removeItem("berean:mockSpeech");
    }
    if (mock) {
      window.localStorage.setItem("berean:mockSpeech", "1");
      window.localStorage.removeItem("berean:hideSpeech");
    }
    return {
      hide: window.localStorage.getItem("berean:hideSpeech") === "1",
      mock: window.localStorage.getItem("berean:mockSpeech") === "1",
    };
  } catch {
    return { hide: false, mock: false };
  }
}

if (typeof window !== "undefined") {
  readDevSpeechFlags();
}

export function isDevSpeechMockEnabled(): boolean {
  if (!import.meta.env.DEV || typeof window === "undefined") return false;
  return readDevSpeechFlags().mock;
}

let devTranscriptSink: ((text: string) => void) | null = null;
let devMockKeysBound = false;

const DEV_MOCK_SAMPLE = "The Lord is my shepherd; I shall not want";

function bindDevMockEmitters(): void {
  if (devMockKeysBound || typeof window === "undefined") return;
  devMockKeysBound = true;
  window.addEventListener("keydown", (event) => {
    if (event.key !== "F9") return;
    emitDevMockSpeech();
  });
  window.addEventListener(DEV_MOCK_SPEECH_EMIT_EVENT, () => {
    emitDevMockSpeech();
  });
}

/** DEV-only: stream a sample transcript into the active dictation session. */
export function emitDevMockSpeech(text: string = DEV_MOCK_SAMPLE): boolean {
  if (devTranscriptSink) {
    devTranscriptSink(text);
    return true;
  }
  return false;
}

/** DEV-only: fallback so Insert spoken sample still fills the box. */
export function setDevTranscriptSink(
  sink: ((text: string) => void) | null,
): void {
  devTranscriptSink = sink;
}

export function isGetUserMediaSupported(): boolean {
  return (
    typeof navigator !== "undefined" &&
    typeof navigator.mediaDevices?.getUserMedia === "function"
  );
}

export function isMediaRecorderSupported(): boolean {
  return typeof MediaRecorder === "function";
}

/**
 * Hide the mic only when the browser cannot record, or when DEV hideSpeech
 * is set. Firefox is supported (MediaRecorder + Groq).
 */
export function isDictationSupported(): boolean {
  if (typeof window === "undefined") return false;
  if (import.meta.env.DEV) {
    const { hide, mock } = readDevSpeechFlags();
    if (hide) return false;
    if (mock) {
      bindDevMockEmitters();
      return true;
    }
  }
  return isGetUserMediaSupported() && isMediaRecorderSupported();
}

export function pickRecorderMimeType(): string {
  if (typeof MediaRecorder === "undefined") return "";
  if (typeof MediaRecorder.isTypeSupported !== "function") return "";
  return (
    RECORDER_MIME_CANDIDATES.find((type) =>
      MediaRecorder.isTypeSupported(type),
    ) ?? ""
  );
}

/** First live audio track on a capture, if any. */
export function liveAudioTrack(
  stream: MediaStream | null | undefined,
): MediaStreamTrack | undefined {
  if (!stream) return undefined;
  return stream.getAudioTracks().find((track) => track.readyState === "live");
}

/**
 * Independent MediaStream for Web Audio so the analyser does not attach a
 * sink to the same MediaStreamTrack MediaRecorder is using.
 */
export function cloneMediaStreamForAnalysis(
  stream: MediaStream,
): MediaStream | null {
  if (typeof stream.clone !== "function") return null;
  try {
    const cloned = stream.clone();
    return cloned && cloned !== stream ? cloned : null;
  } catch {
    return null;
  }
}

export function stopMediaStream(stream: MediaStream | null | undefined): void {
  if (!stream) return;
  for (const track of stream.getTracks()) {
    track.stop();
  }
}

/** One getUserMedia capture for a dictation session. Caller must stop tracks. */
export async function openDictationMicStream(): Promise<MediaStream | null> {
  if (!isGetUserMediaSupported()) return null;
  try {
    return await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: false,
    });
  } catch {
    return null;
  }
}

/** Join a newly recognized phrase onto text already in the recall box. */
export function appendSpokenText(base: string, spoken: string): string {
  const next = spoken.trim();
  if (!next) return base;
  const left = base.trimEnd();
  if (!left) return next;
  return `${left} ${next}`;
}

export type UtteranceVad = {
  noiseFloor: number;
  speechRunMs: number;
  silenceRunMs: number;
  inUtterance: boolean;
  peakRms: number;
};

export type UtteranceVadEvent = "none" | "start" | "end";

export function createUtteranceVad(): UtteranceVad {
  return {
    noiseFloor: NOISE_FLOOR_INIT,
    speechRunMs: 0,
    silenceRunMs: 0,
    inUtterance: false,
    peakRms: 0,
  };
}

export function speechThresholds(noiseFloor: number): {
  start: number;
  continue: number;
} {
  const start = Math.max(
    SPEECH_RMS_THRESHOLD,
    noiseFloor * 2.2,
    noiseFloor + 0.018,
  );
  const continueAt = Math.min(
    start * 0.75,
    Math.max(
      SPEECH_RMS_THRESHOLD * 0.35,
      noiseFloor * 1.35,
      noiseFloor + 0.006,
    ),
  );
  return { start, continue: continueAt };
}

function clampNoiseFloor(value: number): number {
  return Math.min(NOISE_FLOOR_MAX, Math.max(NOISE_FLOOR_MIN, value));
}

function adaptNoiseFloor(floor: number, rms: number): number {
  const alpha = rms < floor ? NOISE_FLOOR_DOWN : NOISE_FLOOR_UP;
  return clampNoiseFloor(floor * (1 - alpha) + rms * alpha);
}

/**
 * Frame-level utterance VAD. Speech opens a clip; a natural pause closes it.
 * One complete MediaRecorder `start()` → `stop()` per event pair — never
 * overlapping windows.
 */
export function stepUtteranceVad(
  vad: UtteranceVad,
  rms: number,
  dtMs: number,
): { vad: UtteranceVad; event: UtteranceVadEvent } {
  const { start, continue: cont } = speechThresholds(vad.noiseFloor);
  let noiseFloor = vad.noiseFloor;
  if (!vad.inUtterance) {
    noiseFloor = adaptNoiseFloor(noiseFloor, rms);
  }

  if (!vad.inUtterance) {
    if (rms >= start) {
      const speechRunMs = vad.speechRunMs + dtMs;
      if (speechRunMs >= SPEECH_START_MS) {
        return {
          vad: {
            noiseFloor,
            speechRunMs: 0,
            silenceRunMs: 0,
            inUtterance: true,
            peakRms: rms,
          },
          event: "start",
        };
      }
      return {
        vad: {
          noiseFloor,
          speechRunMs,
          silenceRunMs: 0,
          inUtterance: false,
          peakRms: 0,
        },
        event: "none",
      };
    }
    return {
      vad: {
        noiseFloor,
        speechRunMs: 0,
        silenceRunMs: 0,
        inUtterance: false,
        peakRms: 0,
      },
      event: "none",
    };
  }

  const peakRms = Math.max(vad.peakRms, rms);
  if (rms >= cont) {
    return {
      vad: {
        noiseFloor,
        speechRunMs: 0,
        silenceRunMs: 0,
        inUtterance: true,
        peakRms,
      },
      event: "none",
    };
  }
  const silenceRunMs = vad.silenceRunMs + dtMs;
  if (silenceRunMs >= UTTERANCE_END_MS) {
    return {
      vad: {
        noiseFloor,
        speechRunMs: 0,
        silenceRunMs: 0,
        inUtterance: false,
        peakRms,
      },
      event: "end",
    };
  }
  return {
    vad: {
      noiseFloor,
      speechRunMs: 0,
      silenceRunMs,
      inUtterance: true,
      peakRms,
    },
    event: "none",
  };
}

export function forceEndUtteranceVad(vad: UtteranceVad): UtteranceVad {
  return {
    ...vad,
    inUtterance: false,
    speechRunMs: 0,
    silenceRunMs: 0,
  };
}

/** True when the clip peaked like voice, not a flat noise floor. */
export function shouldSendUtterance(
  peakRms: number,
  noiseFloor: number,
): boolean {
  const { start } = speechThresholds(noiseFloor);
  return peakRms >= start + SPEECH_PEAK_MARGIN;
}

export function raiseNoiseFloorFromRejectedClip(
  vad: UtteranceVad,
): UtteranceVad {
  return {
    ...createUtteranceVad(),
    noiseFloor: clampNoiseFloor(Math.max(vad.noiseFloor, vad.peakRms * 0.9)),
  };
}

const WHISPER_TAIL_JUNK =
  /\s+(?:thank you for watching|thanks for watching|thanks for listening|please subscribe|subscribe)(?:[.!?])?$/i;

/**
 * Drop common Whisper end-hallucinations. Only YouTube/podcast stock phrases
 * as a suffix — never the expected verse, and not a bare "thank you"
 * (that can be scripture).
 */
export function stripWhisperTailJunk(text: string): string {
  let next = text.trim();
  if (!next) return "";
  for (let i = 0; i < 3; i += 1) {
    const stripped = next.replace(WHISPER_TAIL_JUNK, "").trim();
    if (stripped === next) break;
    next = stripped;
  }
  if (
    /^(?:thank you for watching|thanks for watching|thanks for listening|please subscribe|subscribe)(?:[.!?])?$/i.test(
      next,
    )
  ) {
    return "";
  }
  return next;
}

const WHISPER_FILLER_UTTERANCE =
  /^(?:(?:uh+|um+|er+|ah+|oh+|ooh+|mm+(?:-hmm)?|mhm|hmm+|huh|okay|ok|yeah|yep|yup|yes)(?:\.{2,}|\.|!|\?|,|'s)?(?:\s+|$))+$/i;

/** Whole-clip Whisper throat-clearing. Never strips mixed sentences. */
export function isWhisperFillerUtterance(text: string): boolean {
  const next = text.trim();
  if (!next) return true;
  return WHISPER_FILLER_UTTERANCE.test(next);
}

/** Clean a Groq transcript before it hits the recall box. */
export function spokenFromWhisper(text: string): string {
  const stripped = stripWhisperTailJunk(text);
  if (!stripped || isWhisperFillerUtterance(stripped)) return "";
  return stripped;
}

/** RMS of analyser time-domain PCM (0–255, 128 = silence). */
export function rmsFromTimeDomain(samples: ArrayLike<number>): number {
  if (samples.length === 0) return 0;
  let sumSq = 0;
  for (let i = 0; i < samples.length; i += 1) {
    const centered = ((samples[i] ?? 128) - 128) / 128;
    sumSq += centered * centered;
  }
  return Math.sqrt(sumSq / samples.length);
}

export async function blobToBase64(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}
