import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  DICTATION_CHUNK_MS,
  DICTATION_FIRST_CHUNK_MS,
  SPEECH_SILENCE_TIMEOUT_MS,
} from "@/lib/web-speech";

import {
  useWebSpeechDictation,
  type TranscribeAudioFn,
} from "./use-web-speech-dictation";

type RecorderHarness = {
  instances: MockMediaRecorder[];
  getUserMedia: ReturnType<typeof vi.fn>;
  stopTrack: ReturnType<typeof vi.fn>;
  stream: MediaStream;
  timeDomain: Uint8Array;
};

class MockMediaRecorder {
  static isTypeSupported(): boolean {
    return true;
  }

  mimeType = "audio/webm";
  state: RecordingState = "inactive";
  ondataavailable: ((event: BlobEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onstop: (() => void) | null = null;
  startCount = 0;

  start(): void {
    this.startCount += 1;
    this.state = "recording";
  }

  requestData(): void {
    if (this.state !== "recording") return;
    this.ondataavailable?.({
      data: new Blob([new Uint8Array(128).fill(1)], { type: this.mimeType }),
    } as BlobEvent);
  }

  stop(): void {
    this.requestData();
    this.state = "inactive";
    this.onstop?.();
  }
}

function installDictationMocks(): RecorderHarness {
  const instances: MockMediaRecorder[] = [];
  const stopTrack = vi.fn();
  const track = {
    kind: "audio",
    readyState: "live",
    stop: stopTrack,
  } as unknown as MediaStreamTrack;
  const stream = {
    getAudioTracks: () => [track],
    getTracks: () => [track],
    clone: () => stream,
  } as unknown as MediaStream;
  const getUserMedia = vi.fn().mockResolvedValue(stream);
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: { getUserMedia },
  });

  class FakeMediaRecorder extends MockMediaRecorder {
    constructor() {
      super();
      instances.push(this);
    }
  }
  vi.stubGlobal("MediaRecorder", FakeMediaRecorder);

  const timeDomain = new Uint8Array(1024).fill(128);
  const analyser = {
    fftSize: 1024,
    smoothingTimeConstant: 0,
    getByteTimeDomainData: (buffer: Uint8Array) => {
      const n = Math.min(buffer.length, timeDomain.length);
      for (let i = 0; i < n; i += 1) buffer[i] = timeDomain[i] ?? 128;
    },
  };
  const source = { connect: vi.fn(), disconnect: vi.fn() };
  class FakeAudioContext {
    state = "running";
    createMediaStreamSource = vi.fn(() => source);
    createAnalyser = vi.fn(() => analyser);
    resume = vi.fn().mockResolvedValue(undefined);
    close = vi.fn().mockResolvedValue(undefined);
  }
  vi.stubGlobal("AudioContext", FakeAudioContext);

  return { instances, getUserMedia, stopTrack, stream, timeDomain };
}

describe("useWebSpeechDictation", () => {
  const originalMediaDevices = navigator.mediaDevices;
  let transcribeAudio: ReturnType<typeof vi.fn<TranscribeAudioFn>>;

  beforeEach(() => {
    window.localStorage.removeItem("berean:hideSpeech");
    window.localStorage.removeItem("berean:mockSpeech");
    transcribeAudio = vi
      .fn<TranscribeAudioFn>()
      .mockResolvedValue({ text: "" });
    vi.useFakeTimers({
      toFake: ["setTimeout", "setInterval", "clearTimeout", "clearInterval"],
    });
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: originalMediaDevices,
    });
  });

  it("reports unsupported when MediaRecorder is missing", () => {
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: undefined,
    });
    vi.stubGlobal("MediaRecorder", undefined);
    const { result } = renderHook(() =>
      useWebSpeechDictation({ onTranscript: () => {}, transcribeAudio }),
    );
    expect(result.current.supported).toBe(false);
  });

  it("opens one getUserMedia stream for the waveform and MediaRecorder", async () => {
    const harness = installDictationMocks();
    const { result } = renderHook(() =>
      useWebSpeechDictation({ onTranscript: () => {}, transcribeAudio }),
    );

    await act(async () => {
      result.current.start();
      await Promise.resolve();
    });

    expect(harness.getUserMedia).toHaveBeenCalledTimes(1);
    expect(harness.getUserMedia).toHaveBeenCalledWith({
      audio: true,
      video: false,
    });
    expect(result.current.listening).toBe(true);
    expect(result.current.micStream).toBe(harness.stream);
    expect(harness.instances).toHaveLength(1);
    expect(harness.instances[0]?.startCount).toBe(1);

    act(() => {
      result.current.stop();
    });
    expect(harness.stopTrack).toHaveBeenCalledTimes(1);
    expect(result.current.micStream).toBeNull();
    expect(result.current.listening).toBe(false);
  });

  it("sends a complete chunk to Groq and streams words without grading", async () => {
    const harness = installDictationMocks();
    transcribeAudio.mockResolvedValue({ text: "The Lord is my shepherd" });
    const onTranscript = vi.fn();
    const { result } = renderHook(() =>
      useWebSpeechDictation({ onTranscript, transcribeAudio }),
    );

    await act(async () => {
      result.current.start();
      await Promise.resolve();
    });
    harness.timeDomain.fill(0);
    act(() => {
      vi.advanceTimersByTime(200);
    });
    await act(async () => {
      vi.advanceTimersByTime(DICTATION_FIRST_CHUNK_MS);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(transcribeAudio).toHaveBeenCalledTimes(1);
    const args = transcribeAudio.mock.calls[0]?.[0];
    expect(args?.mimeType).toMatch(/audio\//);
    expect(args?.audioBase64.length).toBeGreaterThan(0);
    expect(onTranscript).toHaveBeenLastCalledWith("The Lord is my shepherd");
    expect(result.current.listening).toBe(true);
  });

  it("later snapshots replace with the growing transcript", async () => {
    const harness = installDictationMocks();
    transcribeAudio
      .mockResolvedValueOnce({ text: "The Lord" })
      .mockResolvedValueOnce({ text: "The Lord is my shepherd" });
    const onTranscript = vi.fn();
    const { result } = renderHook(() =>
      useWebSpeechDictation({ onTranscript, transcribeAudio }),
    );

    await act(async () => {
      result.current.start();
      await Promise.resolve();
    });
    harness.timeDomain.fill(0);
    act(() => {
      vi.advanceTimersByTime(200);
    });
    await act(async () => {
      vi.advanceTimersByTime(DICTATION_FIRST_CHUNK_MS);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(onTranscript).toHaveBeenLastCalledWith("The Lord");

    harness.timeDomain.fill(0);
    act(() => {
      vi.advanceTimersByTime(200);
    });
    await act(async () => {
      vi.advanceTimersByTime(DICTATION_CHUNK_MS);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(onTranscript).toHaveBeenLastCalledWith("The Lord is my shepherd");
    expect(harness.instances[0]?.startCount).toBe(1);
    const firstLen =
      transcribeAudio.mock.calls[0]?.[0]?.audioBase64.length ?? 0;
    const secondLen =
      transcribeAudio.mock.calls[1]?.[0]?.audioBase64.length ?? 0;
    expect(secondLen).toBeGreaterThan(firstLen);
  });

  it("turns the mic off after 5 seconds with no speech", async () => {
    installDictationMocks();
    const { result } = renderHook(() =>
      useWebSpeechDictation({ onTranscript: () => {}, transcribeAudio }),
    );
    await act(async () => {
      result.current.start();
      await Promise.resolve();
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

  it("resets the silence timer when the mic hears speech", async () => {
    const harness = installDictationMocks();
    const { result } = renderHook(() =>
      useWebSpeechDictation({ onTranscript: () => {}, transcribeAudio }),
    );
    await act(async () => {
      result.current.start();
      await Promise.resolve();
    });
    act(() => {
      vi.advanceTimersByTime(4_000);
    });
    harness.timeDomain.fill(0);
    act(() => {
      vi.advanceTimersByTime(200);
    });
    harness.timeDomain.fill(128);
    act(() => {
      vi.advanceTimersByTime(4_000);
    });
    expect(result.current.listening).toBe(true);
    act(() => {
      vi.advanceTimersByTime(1_000);
    });
    expect(result.current.listening).toBe(false);
  });

  it("does not send silent snapshots", async () => {
    installDictationMocks();
    const { result } = renderHook(() =>
      useWebSpeechDictation({ onTranscript: () => {}, transcribeAudio }),
    );
    await act(async () => {
      result.current.start();
      await Promise.resolve();
    });
    await act(async () => {
      vi.advanceTimersByTime(DICTATION_FIRST_CHUNK_MS);
      await Promise.resolve();
    });
    expect(transcribeAudio).not.toHaveBeenCalled();
    expect(result.current.listening).toBe(true);
  });

  it("does not send a near-silent tail after speech already flushed", async () => {
    const harness = installDictationMocks();
    transcribeAudio.mockResolvedValue({ text: "The Lord is my shepherd" });
    const { result } = renderHook(() =>
      useWebSpeechDictation({ onTranscript: () => {}, transcribeAudio }),
    );
    await act(async () => {
      result.current.start();
      await Promise.resolve();
    });
    harness.timeDomain.fill(0);
    act(() => {
      vi.advanceTimersByTime(200);
    });
    await act(async () => {
      vi.advanceTimersByTime(DICTATION_FIRST_CHUNK_MS);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(transcribeAudio).toHaveBeenCalledTimes(1);
    harness.timeDomain.fill(128);
    await act(async () => {
      vi.advanceTimersByTime(400);
      await Promise.resolve();
      await Promise.resolve();
    });
    const afterQuietOnset = transcribeAudio.mock.calls.length;
    await act(async () => {
      vi.advanceTimersByTime(DICTATION_CHUNK_MS);
      await Promise.resolve();
    });
    expect(transcribeAudio).toHaveBeenCalledTimes(afterQuietOnset);
  });

  it("flushes once when speech goes quiet, then skips silent tails", async () => {
    const harness = installDictationMocks();
    transcribeAudio
      .mockResolvedValueOnce({ text: "The Lord" })
      .mockResolvedValueOnce({ text: "The Lord is my shepherd" });
    const onTranscript = vi.fn();
    const { result } = renderHook(() =>
      useWebSpeechDictation({ onTranscript, transcribeAudio }),
    );
    await act(async () => {
      result.current.start();
      await Promise.resolve();
    });
    harness.timeDomain.fill(0);
    act(() => {
      vi.advanceTimersByTime(200);
    });
    await act(async () => {
      vi.advanceTimersByTime(DICTATION_FIRST_CHUNK_MS);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(transcribeAudio).toHaveBeenCalledTimes(1);

    harness.timeDomain.fill(0);
    act(() => {
      vi.advanceTimersByTime(200);
    });
    harness.timeDomain.fill(128);
    await act(async () => {
      vi.advanceTimersByTime(400);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(transcribeAudio).toHaveBeenCalledTimes(2);
    expect(onTranscript).toHaveBeenLastCalledWith("The Lord is my shepherd");

    await act(async () => {
      vi.advanceTimersByTime(DICTATION_CHUNK_MS);
      await Promise.resolve();
    });
    expect(transcribeAudio).toHaveBeenCalledTimes(2);
  });

  it("strips stock Whisper tail hallucinations from a Groq result", async () => {
    const harness = installDictationMocks();
    transcribeAudio.mockResolvedValue({
      text: "The Lord is my shepherd thanks for watching",
    });
    const onTranscript = vi.fn();
    const { result } = renderHook(() =>
      useWebSpeechDictation({ onTranscript, transcribeAudio }),
    );
    await act(async () => {
      result.current.start();
      await Promise.resolve();
    });
    harness.timeDomain.fill(0);
    act(() => {
      vi.advanceTimersByTime(200);
    });
    await act(async () => {
      vi.advanceTimersByTime(DICTATION_FIRST_CHUNK_MS);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(onTranscript).toHaveBeenLastCalledWith("The Lord is my shepherd");
  });

  it("flushes the last spoken chunk on Stop", async () => {
    const harness = installDictationMocks();
    transcribeAudio.mockResolvedValue({ text: "I shall not want" });
    const onTranscript = vi.fn();
    const { result } = renderHook(() =>
      useWebSpeechDictation({ onTranscript, transcribeAudio }),
    );
    await act(async () => {
      result.current.start();
      await Promise.resolve();
    });
    harness.timeDomain.fill(0);
    act(() => {
      vi.advanceTimersByTime(200);
    });
    await act(async () => {
      result.current.stop();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(transcribeAudio).toHaveBeenCalledTimes(1);
    expect(onTranscript).toHaveBeenLastCalledWith("I shall not want");
    expect(result.current.listening).toBe(false);
  });

  it("stops on Space while listening without starting a new session", async () => {
    installDictationMocks();
    const { result } = renderHook(() =>
      useWebSpeechDictation({ onTranscript: () => {}, transcribeAudio }),
    );
    await act(async () => {
      result.current.start();
      await Promise.resolve();
    });
    act(() => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", { key: " ", bubbles: true }),
      );
    });
    expect(result.current.listening).toBe(false);
  });
});
