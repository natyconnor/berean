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

/** Sessions that die faster than this, with no speech, are treated as engine refusal. */
export const SPEECH_QUICK_END_MS = 200;

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
  start(): void;
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

/** Join a newly recognized phrase onto text already in the recall box. */
export function appendSpokenText(base: string, spoken: string): string {
  const next = spoken.trim();
  if (!next) return base;
  const left = base.trimEnd();
  if (!left) return next;
  return `${left} ${next}`;
}
