import { afterEach, describe, expect, it, vi } from "vitest";

import {
  appendSpokenText,
  cloneMediaStreamForAnalysis,
  emitDevMockSpeech,
  isDevSpeechMockEnabled,
  isDictationSupported,
  isSpaceToggleKey,
  liveAudioTrack,
  pickRecorderMimeType,
  rmsFromTimeDomain,
  setDevTranscriptSink,
} from "./web-speech";

describe("dictation helpers", () => {
  afterEach(() => {
    window.localStorage.removeItem("berean:hideSpeech");
    window.localStorage.removeItem("berean:mockSpeech");
    window.history.replaceState({}, "", "/");
    vi.unstubAllGlobals();
  });

  it("treats Space by key or code as the mic toggle", () => {
    expect(isSpaceToggleKey(new KeyboardEvent("keydown", { key: " " }))).toBe(
      true,
    );
    expect(
      isSpaceToggleKey(new KeyboardEvent("keydown", { code: "Space" })),
    ).toBe(true);
    expect(
      isSpaceToggleKey(new KeyboardEvent("keydown", { key: "Space" })),
    ).toBe(true);
    expect(
      isSpaceToggleKey(new KeyboardEvent("keydown", { key: "Enter" })),
    ).toBe(false);
  });

  it("joins spoken phrases onto existing recall text", () => {
    expect(appendSpokenText("", "  The Lord  ")).toBe("The Lord");
    expect(appendSpokenText("The Lord", "is my shepherd")).toBe(
      "The Lord is my shepherd",
    );
    expect(appendSpokenText("The Lord ", "is my shepherd")).toBe(
      "The Lord is my shepherd",
    );
    expect(appendSpokenText("The Lord", "   ")).toBe("The Lord");
  });

  it("hides support when getUserMedia or MediaRecorder is missing", () => {
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: undefined,
    });
    vi.stubGlobal("MediaRecorder", undefined);
    expect(isDictationSupported()).toBe(false);
  });

  it("shows support when getUserMedia and MediaRecorder exist", () => {
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: vi.fn() },
    });
    vi.stubGlobal(
      "MediaRecorder",
      class {
        static isTypeSupported() {
          return true;
        }
      },
    );
    expect(isDictationSupported()).toBe(true);
  });

  it("picks a supported MediaRecorder mime type", () => {
    vi.stubGlobal(
      "MediaRecorder",
      class {
        static isTypeSupported(type: string) {
          return type === "audio/webm";
        }
      },
    );
    expect(pickRecorderMimeType()).toBe("audio/webm");
  });

  it("clones a stream for analysis and finds a live audio track", () => {
    const stopOriginal = vi.fn();
    const stopClone = vi.fn();
    const originalTrack = {
      kind: "audio",
      readyState: "live",
      stop: stopOriginal,
    } as unknown as MediaStreamTrack;
    const cloneTrack = {
      kind: "audio",
      readyState: "live",
      stop: stopClone,
    } as unknown as MediaStreamTrack;
    const cloned = {
      getAudioTracks: () => [cloneTrack],
      getTracks: () => [cloneTrack],
    } as unknown as MediaStream;
    const stream = {
      getAudioTracks: () => [originalTrack],
      getTracks: () => [originalTrack],
      clone: () => cloned,
    } as unknown as MediaStream;

    expect(liveAudioTrack(stream)).toBe(originalTrack);
    expect(cloneMediaStreamForAnalysis(stream)).toBe(cloned);
    expect(cloneMediaStreamForAnalysis({} as MediaStream)).toBeNull();
  });

  it("treats 128 PCM as silence and loud samples as speech", () => {
    expect(rmsFromTimeDomain(new Uint8Array(32).fill(128))).toBe(0);
    expect(rmsFromTimeDomain(new Uint8Array(32).fill(0))).toBeGreaterThan(0.5);
  });

  it("reads mockSpeech from the hash when search params were stripped", () => {
    window.history.replaceState({}, "", "/memory/learn#mockSpeech");
    expect(isDevSpeechMockEnabled()).toBe(true);
    expect(isDictationSupported()).toBe(true);

    const sink = vi.fn();
    setDevTranscriptSink(sink);
    expect(emitDevMockSpeech()).toBe(true);
    expect(sink).toHaveBeenCalledWith(
      "The Lord is my shepherd; I shall not want",
    );
    setDevTranscriptSink(null);
  });

  it("hides the mic when hideSpeech is in the hash", () => {
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: vi.fn() },
    });
    vi.stubGlobal(
      "MediaRecorder",
      class {
        static isTypeSupported() {
          return true;
        }
      },
    );
    window.history.replaceState({}, "", "/memory/learn#hideSpeech");
    expect(isDictationSupported()).toBe(false);
    expect(isDevSpeechMockEnabled()).toBe(false);
  });
});
