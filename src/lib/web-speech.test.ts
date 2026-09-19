import { afterEach, describe, expect, it, vi } from "vitest";

import {
  appendSpokenText,
  cloneMediaStreamForAnalysis,
  createUtteranceVad,
  emitDevMockSpeech,
  isDevSpeechMockEnabled,
  isDictationSupported,
  isSpaceToggleKey,
  isWhisperFillerUtterance,
  liveAudioTrack,
  pickRecorderMimeType,
  rmsFromTimeDomain,
  setDevTranscriptSink,
  shouldSendUtterance,
  SPEECH_START_MS,
  spokenFromWhisper,
  stepUtteranceVad,
  stripWhisperTailJunk,
  UTTERANCE_END_MS,
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

  it("opens a clip after speech and closes it after a natural pause", () => {
    let vad = createUtteranceVad();
    let started = false;
    for (let i = 0; i < 4; i += 1) {
      const stepped = stepUtteranceVad(vad, 0.12, 50);
      vad = stepped.vad;
      if (stepped.event === "start") started = true;
    }
    expect(started).toBe(true);
    expect(vad.inUtterance).toBe(true);

    const dip = stepUtteranceVad(vad, 0.004, 200);
    expect(dip.event).toBe("none");
    expect(dip.vad.inUtterance).toBe(true);

    const ended = stepUtteranceVad(dip.vad, 0.004, UTTERANCE_END_MS);
    expect(ended.event).toBe("end");
    expect(ended.vad.inUtterance).toBe(false);
    expect(shouldSendUtterance(ended.vad.peakRms, ended.vad.noiseFloor)).toBe(
      true,
    );
  });

  it("does not treat a brief dip as the end of an utterance", () => {
    let vad = createUtteranceVad();
    let started = false;
    for (let i = 0; i < 4; i += 1) {
      const stepped = stepUtteranceVad(vad, 0.14, 50);
      vad = stepped.vad;
      if (stepped.event === "start") started = true;
    }
    expect(started).toBe(true);
    const dip = stepUtteranceVad(vad, 0.004, 200);
    expect(dip.event).toBe("none");
    const resume = stepUtteranceVad(dip.vad, 0.14, 50);
    expect(resume.event).toBe("none");
    expect(resume.vad.inUtterance).toBe(true);
    expect(resume.vad.silenceRunMs).toBe(0);
  });

  it("does not send a flat noise-floor clip as speech", () => {
    const vad = createUtteranceVad();
    expect(shouldSendUtterance(0.04, vad.noiseFloor)).toBe(false);
    expect(shouldSendUtterance(0.12, vad.noiseFloor)).toBe(true);
  });

  it("requires a short run of speech before starting", () => {
    const first = stepUtteranceVad(
      createUtteranceVad(),
      0.12,
      SPEECH_START_MS - 30,
    );
    expect(first.event).toBe("none");
    expect(first.vad.inUtterance).toBe(false);
    const second = stepUtteranceVad(first.vad, 0.12, 50);
    expect(second.event).toBe("start");
  });

  it("strips stock Whisper tail hallucinations but keeps verse wording", () => {
    expect(
      stripWhisperTailJunk("The Lord is my shepherd thanks for watching."),
    ).toBe("The Lord is my shepherd");
    expect(
      stripWhisperTailJunk("The Lord is my shepherd. Please subscribe!"),
    ).toBe("The Lord is my shepherd.");
    expect(stripWhisperTailJunk("Thanks for watching.")).toBe("");
    expect(stripWhisperTailJunk("Father, I thank you")).toBe(
      "Father, I thank you",
    );
  });

  it("drops filler-only Whisper clips but keeps real commentary and verses", () => {
    expect(isWhisperFillerUtterance("Mm-hmm.")).toBe(true);
    expect(isWhisperFillerUtterance("Okay")).toBe(true);
    expect(isWhisperFillerUtterance("Yes.")).toBe(true);
    expect(spokenFromWhisper("  mm-hmm.  ")).toBe("");
    expect(spokenFromWhisper("Oooo that's really bad")).toBe(
      "Oooo that's really bad",
    );
    expect(spokenFromWhisper("Blessed is the man")).toBe("Blessed is the man");
    expect(spokenFromWhisper("Yes, it is the man")).toBe("Yes, it is the man");
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
