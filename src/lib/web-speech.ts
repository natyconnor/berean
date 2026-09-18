/**
 * Browser Web Speech API helpers for optional recall dictation.
 *
 * Intentionally tiny: feature-detect, join spoken phrases onto existing text,
 * and share the silence timeout. The recognizer is never given the expected
 * verse as a grammar, prompt, or hint.
 */

export const SPEECH_SILENCE_TIMEOUT_MS = 5_000;

/**
 * Minimum delay before calling `start()` again after `onend`.
 * A synchronous onend → start() loop is what makes the Mac menu-bar mic flicker.
 */
export const SPEECH_RESTART_GAP_MS = 250;

/** Chrome 135+ `SpeechRecognition.start(audioTrack)`. */
export const SPEECH_AUDIO_TRACK_MIN_CHROME = 135;

/** DEV-only: click "Insert spoken sample" while listening to stream a transcript. */
export const DEV_MOCK_SPEECH_EMIT_EVENT = "berean:mock-speech-emit";

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

export interface BrowserSpeechRecognitionEvent {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

export interface BrowserSpeechRecognitionErrorEvent {
  error: string;
}

/**
 * The subset of the Web Speech recognizer we actually use. TypeScript's DOM
 * lib ships result types but not the recognizer itself.
 */
export interface BrowserSpeechRecognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: BrowserSpeechRecognitionEvent) => void) | null;
  onerror: ((event: BrowserSpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  onspeechstart: (() => void) | null;
  /** Chrome 135+: pass a live audio track so recognition shares getUserMedia. */
  start(audioTrack?: MediaStreamTrack): void;
  stop(): void;
  abort(): void;
}

export type BrowserSpeechRecognitionCtor = new () => BrowserSpeechRecognition;

type SpeechWindow = Window & {
  SpeechRecognition?: BrowserSpeechRecognitionCtor;
  webkitSpeechRecognition?: BrowserSpeechRecognitionCtor;
};

let lastDevMock: DevMockSpeechRecognition | null = null;
let devTranscriptSink: ((text: string) => void) | null = null;
let devMockKeysBound = false;

const DEV_MOCK_SAMPLE = "The Lord is my shepherd; I shall not want";

function rememberDevMock(recognition: DevMockSpeechRecognition): void {
  lastDevMock = recognition;
}

class DevMockSpeechRecognition implements BrowserSpeechRecognition {
  continuous = false;
  interimResults = false;
  lang = "";
  onresult: ((event: BrowserSpeechRecognitionEvent) => void) | null = null;
  onerror: ((event: BrowserSpeechRecognitionErrorEvent) => void) | null = null;
  onend: (() => void) | null = null;
  onspeechstart: (() => void) | null = null;

  start(): void {
    rememberDevMock(this);
  }

  stop(): void {
    this.onend?.();
  }

  abort(): void {
    this.onend?.();
  }

  emit(text: string): void {
    const alternative = { transcript: text, confidence: 1 };
    const result = Object.assign([alternative], {
      isFinal: false,
      item: () => alternative,
    });
    const results = Object.assign([result], {
      item: () => result,
    }) as unknown as SpeechRecognitionResultList;
    this.onresult?.({ resultIndex: 0, results });
  }
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

/** DEV-only: stream a sample transcript into the active mock recognizer. */
export function emitDevMockSpeech(text: string = DEV_MOCK_SAMPLE): boolean {
  if (lastDevMock) {
    lastDevMock.emit(text);
    return true;
  }
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

export function getSpeechRecognitionCtor(): BrowserSpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  if (import.meta.env.DEV) {
    const { hide, mock } = readDevSpeechFlags();
    if (hide) return null;
    if (mock) {
      bindDevMockEmitters();
      return DevMockSpeechRecognition;
    }
  }
  const speechWindow = window as SpeechWindow;
  return (
    speechWindow.SpeechRecognition ??
    speechWindow.webkitSpeechRecognition ??
    null
  );
}

export function isSpeechRecognitionSupported(): boolean {
  return getSpeechRecognitionCtor() !== null;
}

/**
 * Safari exposes only `webkitSpeechRecognition` and does not keep a
 * `continuous: true` session alive. Restarting that immediately in `onend`
 * start/stops the mic in a tight loop and never delivers a transcript.
 * Chrome/Edge expose the unprefixed constructor and can use continuous mode.
 */
export function preferContinuousSpeechRecognition(): boolean {
  if (typeof window === "undefined") return false;
  const speechWindow = window as SpeechWindow;
  return typeof speechWindow.SpeechRecognition === "function";
}

/**
 * Unprefixed `SpeechRecognition` is not enough: extra `start()` arguments are
 * ignored before Chrome 135, so opening getUserMedia would steal the mic.
 * iOS Chrome/Edge still use WebKit and must not take this path.
 */
export function chromiumMajorForSpeechTrack(): number | null {
  if (typeof navigator === "undefined") return null;
  const ua = navigator.userAgent;
  if (/CriOS|FxiOS|EdgiOS/i.test(ua)) return null;
  const match = ua.match(/(?:Chrome|Chromium|Edg)\/(\d+)/);
  if (!match?.[1]) return null;
  const major = Number(match[1]);
  return Number.isFinite(major) ? major : null;
}

/**
 * Chrome/Edge 135+ accept `start(audioTrack)` so one getUserMedia stream can
 * feed both the waveform analyser and SpeechRecognition. Safari's webkit-only
 * constructor ignores extra `start()` arguments and will open a second capture
 * (and starve recognition) if JS already holds the mic.
 */
export function speechRecognitionAcceptsAudioTrack(): boolean {
  if (!preferContinuousSpeechRecognition()) return false;
  const major = chromiumMajorForSpeechTrack();
  return major !== null && major >= SPEECH_AUDIO_TRACK_MIN_CHROME;
}

/** First live audio track on a capture, if any. */
export function liveAudioTrack(
  stream: MediaStream | null | undefined,
): MediaStreamTrack | undefined {
  if (!stream) return undefined;
  return stream.getAudioTracks().find((track) => track.readyState === "live");
}

/**
 * Independent MediaStream for Web Audio. SpeechRecognition.start(audioTrack)
 * and createMediaStreamSource must not share a MediaStreamTrack: Chrome ends
 * the recognizer immediately, which produced a deaf session and a ~300ms cutoff.
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
  if (typeof navigator === "undefined") return null;
  const mediaDevices = navigator.mediaDevices;
  if (!mediaDevices?.getUserMedia) return null;
  try {
    return await mediaDevices.getUserMedia({ audio: true, video: false });
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
