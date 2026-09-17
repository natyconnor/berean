import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  SPEECH_RESTART_GAP_MS,
  SPEECH_SILENCE_TIMEOUT_MS,
  type BrowserSpeechRecognition,
  type BrowserSpeechRecognitionErrorEvent,
  type BrowserSpeechRecognitionEvent,
} from "@/lib/web-speech";

import { useWebSpeechDictation } from "./use-web-speech-dictation";

class MockSpeechRecognition implements BrowserSpeechRecognition {
  continuous = false;
  interimResults = false;
  lang = "";
  grammars: unknown = undefined;
  onresult: ((event: BrowserSpeechRecognitionEvent) => void) | null = null;
  onerror: ((event: BrowserSpeechRecognitionErrorEvent) => void) | null = null;
  onend: (() => void) | null = null;
  onspeechstart: (() => void) | null = null;
  startCount = 0;

  start(): void {
    this.startCount += 1;
  }

  stop(): void {
    this.onend?.();
  }

  abort(): void {
    this.onend?.();
  }

  emit(
    items: Array<{ transcript: string; isFinal: boolean }>,
    resultIndex = 0,
  ): void {
    const results = items.map((item) => {
      const alternative = {
        transcript: item.transcript,
        confidence: 1,
      };
      return Object.assign([alternative], {
        isFinal: item.isFinal,
        item: () => alternative,
      });
    });
    const list = Object.assign(results, {
      item: (index: number) => results[index] ?? results[0],
    }) as unknown as SpeechRecognitionResultList;
    this.onresult?.({ resultIndex, results: list });
  }
}

const instances: MockSpeechRecognition[] = [];

function installMock() {
  const speechWindow = window as Window & {
    SpeechRecognition?: new () => BrowserSpeechRecognition;
    webkitSpeechRecognition?: new () => BrowserSpeechRecognition;
  };
  speechWindow.SpeechRecognition = class extends MockSpeechRecognition {
    constructor() {
      super();
      instances.push(this);
    }
  };
}

function lastRecognition(): MockSpeechRecognition {
  const recognition = instances.at(-1);
  if (!recognition) throw new Error("expected a SpeechRecognition instance");
  return recognition;
}

describe("useWebSpeechDictation", () => {
  beforeEach(() => {
    instances.length = 0;
    window.localStorage.removeItem("berean:hideSpeech");
    window.localStorage.removeItem("berean:mockSpeech");
    vi.useFakeTimers();
    installMock();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    const speechWindow = window as Window & {
      SpeechRecognition?: unknown;
      webkitSpeechRecognition?: unknown;
    };
    delete speechWindow.SpeechRecognition;
    delete speechWindow.webkitSpeechRecognition;
  });

  it("reports unsupported when the API is missing", () => {
    const speechWindow = window as Window & {
      SpeechRecognition?: unknown;
      webkitSpeechRecognition?: unknown;
    };
    delete speechWindow.SpeechRecognition;
    delete speechWindow.webkitSpeechRecognition;
    const { result } = renderHook(() =>
      useWebSpeechDictation({ onTranscript: () => {} }),
    );
    expect(result.current.supported).toBe(false);
  });

  it("streams interim and final words without grading", () => {
    const onTranscript = vi.fn();
    const { result } = renderHook(() =>
      useWebSpeechDictation({ onTranscript }),
    );

    act(() => {
      result.current.start();
    });
    expect(result.current.listening).toBe(true);

    const recognition = lastRecognition();
    expect(recognition.continuous).toBe(true);
    expect(recognition.interimResults).toBe(true);
    expect(recognition.lang).toBe("en-US");
    expect(recognition.grammars).toBeUndefined();

    act(() => {
      recognition.emit([{ transcript: "The Lord", isFinal: false }]);
    });
    expect(onTranscript).toHaveBeenLastCalledWith("The Lord");

    act(() => {
      recognition.emit([
        { transcript: "The Lord", isFinal: true },
        { transcript: "is my shepherd", isFinal: false },
      ]);
    });
    expect(onTranscript).toHaveBeenLastCalledWith("The Lord is my shepherd");
    expect(result.current.listening).toBe(true);
  });

  it("turns the mic off after 5 seconds with no speech", () => {
    const { result } = renderHook(() =>
      useWebSpeechDictation({ onTranscript: () => {} }),
    );
    act(() => {
      result.current.start();
    });
    expect(result.current.listening).toBe(true);

    act(() => {
      vi.advanceTimersByTime(SPEECH_SILENCE_TIMEOUT_MS - 1);
    });
    expect(result.current.listening).toBe(true);

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current.listening).toBe(false);
  });

  it("resets the silence timer when speech arrives", () => {
    const { result } = renderHook(() =>
      useWebSpeechDictation({ onTranscript: () => {} }),
    );
    act(() => {
      result.current.start();
    });
    act(() => {
      vi.advanceTimersByTime(4_000);
    });
    act(() => {
      lastRecognition().emit([{ transcript: "The", isFinal: false }]);
    });
    act(() => {
      vi.advanceTimersByTime(4_000);
    });
    expect(result.current.listening).toBe(true);
    act(() => {
      vi.advanceTimersByTime(1_000);
    });
    expect(result.current.listening).toBe(false);
  });

  it("keeps earlier words when Chrome ends the session mid-verse", () => {
    const onTranscript = vi.fn();
    const { result } = renderHook(() =>
      useWebSpeechDictation({ onTranscript }),
    );
    act(() => {
      result.current.start();
    });
    const first = lastRecognition();
    act(() => {
      first.emit([{ transcript: "The Lord", isFinal: true }]);
    });
    act(() => {
      first.onend?.();
    });
    expect(first.startCount).toBe(1);
    expect(result.current.listening).toBe(true);

    act(() => {
      vi.advanceTimersByTime(SPEECH_RESTART_GAP_MS);
    });
    expect(first.startCount).toBe(2);
    expect(result.current.listening).toBe(true);

    act(() => {
      first.emit([{ transcript: "is my shepherd", isFinal: true }]);
    });
    expect(onTranscript).toHaveBeenLastCalledWith("The Lord is my shepherd");
  });

  it("does not restart SpeechRecognition synchronously from onend", () => {
    const { result } = renderHook(() =>
      useWebSpeechDictation({ onTranscript: () => {} }),
    );
    act(() => {
      result.current.start();
    });
    const recognition = lastRecognition();
    act(() => {
      recognition.onend?.();
    });
    expect(recognition.startCount).toBe(1);
    expect(result.current.listening).toBe(true);
  });

  it("stops after two immediate onend cycles instead of looping the mic", () => {
    const { result } = renderHook(() =>
      useWebSpeechDictation({ onTranscript: () => {} }),
    );
    act(() => {
      result.current.start();
    });
    const recognition = lastRecognition();
    act(() => {
      recognition.onend?.();
    });
    act(() => {
      vi.advanceTimersByTime(SPEECH_RESTART_GAP_MS);
    });
    expect(recognition.startCount).toBe(2);
    expect(result.current.listening).toBe(true);

    act(() => {
      recognition.onend?.();
    });
    expect(result.current.listening).toBe(false);
    expect(recognition.startCount).toBe(2);

    act(() => {
      vi.advanceTimersByTime(SPEECH_RESTART_GAP_MS);
    });
    expect(recognition.startCount).toBe(2);
    expect(result.current.listening).toBe(false);
  });

  it("does not reset the 5s silence clock when Chrome reconnects", () => {
    const { result } = renderHook(() =>
      useWebSpeechDictation({ onTranscript: () => {} }),
    );
    act(() => {
      result.current.start();
    });
    act(() => {
      vi.advanceTimersByTime(SPEECH_SILENCE_TIMEOUT_MS - SPEECH_RESTART_GAP_MS);
    });
    act(() => {
      lastRecognition().onend?.();
    });
    act(() => {
      vi.advanceTimersByTime(SPEECH_RESTART_GAP_MS);
    });
    expect(result.current.listening).toBe(false);
  });

  it("keeps listening through a no-speech error until the silence timer", () => {
    const { result } = renderHook(() =>
      useWebSpeechDictation({ onTranscript: () => {} }),
    );
    act(() => {
      result.current.start();
    });
    act(() => {
      lastRecognition().onerror?.({ error: "no-speech" });
    });
    expect(result.current.listening).toBe(true);
    act(() => {
      vi.advanceTimersByTime(SPEECH_SILENCE_TIMEOUT_MS);
    });
    expect(result.current.listening).toBe(false);
  });

  it("uses single-shot recognition when only the webkit constructor exists", () => {
    const speechWindow = window as Window & {
      SpeechRecognition?: unknown;
      webkitSpeechRecognition?: new () => BrowserSpeechRecognition;
    };
    delete speechWindow.SpeechRecognition;
    speechWindow.webkitSpeechRecognition = class extends MockSpeechRecognition {
      constructor() {
        super();
        instances.push(this);
      }
    };
    const { result } = renderHook(() =>
      useWebSpeechDictation({ onTranscript: () => {} }),
    );
    act(() => {
      result.current.start();
    });
    expect(lastRecognition().continuous).toBe(false);
  });

  it("stops on Space while listening without starting a new session", () => {
    const { result } = renderHook(() =>
      useWebSpeechDictation({ onTranscript: () => {} }),
    );
    act(() => {
      result.current.start();
    });
    act(() => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", { key: " ", bubbles: true }),
      );
    });
    expect(result.current.listening).toBe(false);
  });
});
