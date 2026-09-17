import { afterEach, describe, expect, it, vi } from "vitest";

import {
  appendSpokenText,
  emitDevMockSpeech,
  getSpeechRecognitionCtor,
  isDevSpeechMockEnabled,
  isSpaceToggleKey,
  isSpeechRecognitionSupported,
  preferContinuousSpeechRecognition,
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
