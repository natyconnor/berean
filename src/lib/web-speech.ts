/**
 * Optional recall dictation helpers.
 *
 * Recording is getUserMedia + MediaRecorder. Transcription is Groq Whisper
 * via a Convex action. The recorder is never given the expected verse as a
 * prompt or hint.
 */

export const SPEECH_SILENCE_TIMEOUT_MS = 5_000;

/** Complete MediaRecorder files are rotated this often so words appear while speaking. */
export const DICTATION_CHUNK_MS = 2_500;

/** Time-domain RMS above this counts as speech for the 5s silence timer. */
export const SPEECH_RMS_THRESHOLD = 0.02;

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
