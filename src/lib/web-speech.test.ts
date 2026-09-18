import { afterEach, describe, expect, it, vi } from "vitest";

import {
  appendSpokenText,
  cloneMediaStreamForAnalysis,
  emitDevMockSpeech,
  getSpeechRecognitionCtor,
  isDevSpeechMockEnabled,
  isSpaceToggleKey,
  isSpeechRecognitionSupported,
  liveAudioTrack,
  preferContinuousSpeechRecognition,
  speechRecognitionAcceptsAudioTrack,
} from "./web-speech";

describe("web-speech helpers", () => {
  afterEach(() => {
    window.localStorage.removeItem("berean:hideSpeech");
    window.localStorage.removeItem("berean:mockSpeech");
    window.history.replaceState({}, "", "/");
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

  it("detects the vendor-prefixed constructor when the standard one is missing", () => {
    const speechWindow = window as Window & {
      SpeechRecognition?: unknown;
      webkitSpeechRecognition?: unknown;
    };
    const original = speechWindow.SpeechRecognition;
    const originalWebkit = speechWindow.webkitSpeechRecognition;
    class Fake {}
    delete speechWindow.SpeechRecognition;
    speechWindow.webkitSpeechRecognition = Fake;

    expect(isSpeechRecognitionSupported()).toBe(true);
    expect(getSpeechRecognitionCtor()).toBe(Fake);
    expect(preferContinuousSpeechRecognition()).toBe(false);
    expect(speechRecognitionAcceptsAudioTrack()).toBe(false);

    speechWindow.SpeechRecognition = original;
    speechWindow.webkitSpeechRecognition = originalWebkit;
  });

  it("uses continuous mode when the unprefixed constructor exists", () => {
    const speechWindow = window as Window & {
      SpeechRecognition?: unknown;
    };
    const original = speechWindow.SpeechRecognition;
    speechWindow.SpeechRecognition = class Fake {};
    expect(preferContinuousSpeechRecognition()).toBe(true);
    speechWindow.SpeechRecognition = original;
  });

  it("shares a MediaStreamTrack only on Chrome 135+", () => {
    const speechWindow = window as Window & {
      SpeechRecognition?: unknown;
    };
    const original = speechWindow.SpeechRecognition;
    const originalUa = navigator.userAgent;
    speechWindow.SpeechRecognition = class Fake {};

    Object.defineProperty(navigator, "userAgent", {
      configurable: true,
      get: () =>
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
    });
    expect(speechRecognitionAcceptsAudioTrack()).toBe(true);

    Object.defineProperty(navigator, "userAgent", {
      configurable: true,
      get: () =>
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36",
    });
    expect(speechRecognitionAcceptsAudioTrack()).toBe(false);

    Object.defineProperty(navigator, "userAgent", {
      configurable: true,
      get: () =>
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/140.0.7339.122 Mobile/15E148 Safari/604.1",
    });
    expect(speechRecognitionAcceptsAudioTrack()).toBe(false);

    speechWindow.SpeechRecognition = original;
    Object.defineProperty(navigator, "userAgent", {
      configurable: true,
      get: () => originalUa,
    });
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

  it("reads mockSpeech from the hash when search params were stripped", () => {
    window.history.replaceState({}, "", "/memory/learn#mockSpeech");
    expect(isDevSpeechMockEnabled()).toBe(true);
    expect(isSpeechRecognitionSupported()).toBe(true);

    const Ctor = getSpeechRecognitionCtor();
    expect(Ctor).not.toBeNull();
    const recognition = new Ctor!();
    const onresult = vi.fn();
    recognition.onresult = onresult;
    recognition.start();
    expect(emitDevMockSpeech()).toBe(true);
    expect(onresult).toHaveBeenCalled();
  });

  it("hides support when neither constructor exists", () => {
    const speechWindow = window as Window & {
      SpeechRecognition?: unknown;
      webkitSpeechRecognition?: unknown;
    };
    const original = speechWindow.SpeechRecognition;
    const originalWebkit = speechWindow.webkitSpeechRecognition;
    delete speechWindow.SpeechRecognition;
    delete speechWindow.webkitSpeechRecognition;

    expect(isSpeechRecognitionSupported()).toBe(false);
    expect(getSpeechRecognitionCtor()).toBeNull();

    speechWindow.SpeechRecognition = original;
    speechWindow.webkitSpeechRecognition = originalWebkit;
  });

  it("hides the API when hideSpeech is in the hash", () => {
    const speechWindow = window as Window & {
      SpeechRecognition?: unknown;
      webkitSpeechRecognition?: unknown;
    };
    speechWindow.SpeechRecognition = class Fake {};
    window.history.replaceState({}, "", "/memory/learn#hideSpeech");
    expect(isSpeechRecognitionSupported()).toBe(false);
    expect(isDevSpeechMockEnabled()).toBe(false);
  });
});
