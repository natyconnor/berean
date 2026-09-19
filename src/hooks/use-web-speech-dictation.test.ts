import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { clearDevLog, getDevLogEntries } from "@/lib/dev-log";
import { STT_DEBUG_STORAGE_KEY } from "@/lib/stt-log";
import {
  SPEECH_SILENCE_TIMEOUT_MS,
  UTTERANCE_END_MS,
  VAD_POLL_MS,
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
  timesliceMs: number | undefined;
  requestDataCount = 0;

  start(timeslice?: number): void {
    this.timesliceMs = timeslice;
    this.startCount += 1;
    this.state = "recording";
  }

  requestData(): void {
    this.requestDataCount += 1;
    if (this.state !== "recording") return;
    this.ondataavailable?.({
      data: new Blob([new Uint8Array(512).fill(1)], { type: this.mimeType }),
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

async function startListening(result: {
  current: ReturnType<typeof useWebSpeechDictation>;
}): Promise<void> {
  await act(async () => {
    result.current.start();
    await Promise.resolve();
  });
}

async function hearSpeech(harness: RecorderHarness, ms: number): Promise<void> {
  harness.timeDomain.fill(0);
  await act(async () => {
    vi.advanceTimersByTime(ms);
    await Promise.resolve();
  });
}

async function hearSilence(
  harness: RecorderHarness,
  ms: number,
): Promise<void> {
  harness.timeDomain.fill(128);
  await act(async () => {
    vi.advanceTimersByTime(ms);
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("useWebSpeechDictation", () => {
  const originalMediaDevices = navigator.mediaDevices;
  let transcribeAudio: ReturnType<typeof vi.fn<TranscribeAudioFn>>;

  beforeEach(() => {
    window.localStorage.removeItem("berean:hideSpeech");
    window.localStorage.removeItem("berean:mockSpeech");
    window.localStorage.removeItem(STT_DEBUG_STORAGE_KEY);
    clearDevLog();
    transcribeAudio = vi
      .fn<TranscribeAudioFn>()
      .mockResolvedValue({ text: "" });
    vi.useFakeTimers({
      toFake: [
        "setTimeout",
        "setInterval",
        "clearTimeout",
        "clearInterval",
        "Date",
      ],
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

  it("opens one getUserMedia stream for the waveform and waits for speech", async () => {
    const harness = installDictationMocks();
    const { result } = renderHook(() =>
      useWebSpeechDictation({ onTranscript: () => {}, transcribeAudio }),
    );

    await startListening(result);

    expect(harness.getUserMedia).toHaveBeenCalledTimes(1);
    expect(harness.getUserMedia).toHaveBeenCalledWith({
      audio: true,
      video: false,
    });
    expect(result.current.listening).toBe(true);
    expect(result.current.micStream).toBe(harness.stream);
    expect(harness.instances).toHaveLength(0);

    act(() => {
      result.current.stop();
    });
    expect(harness.stopTrack).toHaveBeenCalledTimes(1);
    expect(result.current.micStream).toBeNull();
    expect(result.current.listening).toBe(false);
  });

  it("does not start a second overlapping recorder", async () => {
    const harness = installDictationMocks();
    const { result } = renderHook(() =>
      useWebSpeechDictation({ onTranscript: () => {}, transcribeAudio }),
    );
    await startListening(result);
    await hearSpeech(harness, 250);
    expect(harness.instances).toHaveLength(1);
    await hearSpeech(harness, 400);
    expect(harness.instances).toHaveLength(1);
    expect(harness.instances[0]?.timesliceMs).toBeUndefined();
    expect(harness.instances[0]?.state).toBe("recording");
  });

  it("sends one complete stop() file after a pause and streams words without grading", async () => {
    const harness = installDictationMocks();
    transcribeAudio.mockResolvedValue({ text: "The Lord is my shepherd" });
    const onTranscript = vi.fn();
    const { result } = renderHook(() =>
      useWebSpeechDictation({ onTranscript, transcribeAudio }),
    );

    await startListening(result);
    await hearSpeech(harness, 300);
    expect(harness.instances).toHaveLength(1);
    await hearSilence(harness, UTTERANCE_END_MS);

    expect(transcribeAudio).toHaveBeenCalledTimes(1);
    const args = transcribeAudio.mock.calls[0]?.[0];
    expect(args?.mimeType).toMatch(/audio\//);
    expect(args?.audioBase64.length).toBeGreaterThan(0);
    expect(onTranscript).toHaveBeenLastCalledWith("The Lord is my shepherd");
    expect(result.current.listening).toBe(true);
    expect(harness.instances[0]?.state).toBe("inactive");
  });

  it("appends the next utterance without rewriting the first", async () => {
    const harness = installDictationMocks();
    transcribeAudio
      .mockResolvedValueOnce({ text: "Blessed is the man" })
      .mockResolvedValueOnce({
        text: "Blessed is the man. Yes, it is the man.",
      });
    const onTranscript = vi.fn();
    const { result } = renderHook(() =>
      useWebSpeechDictation({ onTranscript, transcribeAudio }),
    );

    await startListening(result);
    await hearSpeech(harness, 300);
    await hearSilence(harness, UTTERANCE_END_MS);
    expect(onTranscript).toHaveBeenLastCalledWith("Blessed is the man");

    await hearSpeech(harness, 300);
    await hearSilence(harness, UTTERANCE_END_MS);
    expect(onTranscript).toHaveBeenLastCalledWith(
      "Blessed is the man Blessed is the man. Yes, it is the man.",
    );
    expect(transcribeAudio).toHaveBeenCalledTimes(2);
    expect(harness.instances).toHaveLength(2);
    const previous = onTranscript.mock.calls.map((call) => call[0] as string);
    for (let i = 1; i < previous.length; i += 1) {
      expect(previous[i]?.startsWith(previous[i - 1] ?? "")).toBe(true);
    }
  });

  it("turns the mic off after 5 seconds with no speech", async () => {
    installDictationMocks();
    const { result } = renderHook(() =>
      useWebSpeechDictation({ onTranscript: () => {}, transcribeAudio }),
    );
    await startListening(result);
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
    await startListening(result);
    act(() => {
      vi.advanceTimersByTime(4_000);
    });
    await hearSpeech(harness, 200);
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

  it("does not send silent clips or start a recorder without speech", async () => {
    const harness = installDictationMocks();
    const { result } = renderHook(() =>
      useWebSpeechDictation({ onTranscript: () => {}, transcribeAudio }),
    );
    await startListening(result);
    await hearSilence(harness, 1_200);
    expect(harness.instances).toHaveLength(0);
    expect(transcribeAudio).not.toHaveBeenCalled();
    expect(result.current.listening).toBe(true);
  });

  it("does not keep sending after the mic goes quiet", async () => {
    const harness = installDictationMocks();
    transcribeAudio.mockResolvedValue({ text: "The Lord is my shepherd" });
    const { result } = renderHook(() =>
      useWebSpeechDictation({ onTranscript: () => {}, transcribeAudio }),
    );
    await startListening(result);
    await hearSpeech(harness, 300);
    await hearSilence(harness, UTTERANCE_END_MS);
    expect(transcribeAudio).toHaveBeenCalledTimes(1);
    await hearSilence(harness, VAD_POLL_MS * 20);
    expect(transcribeAudio).toHaveBeenCalledTimes(1);
    expect(result.current.listening).toBe(true);
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
    await startListening(result);
    await hearSpeech(harness, 300);
    await hearSilence(harness, UTTERANCE_END_MS);
    expect(onTranscript).toHaveBeenLastCalledWith("The Lord is my shepherd");
  });

  it("drops filler-only Whisper clips instead of writing them into the box", async () => {
    const harness = installDictationMocks();
    transcribeAudio.mockResolvedValue({ text: "Mm-hmm." });
    const onTranscript = vi.fn();
    const { result } = renderHook(() =>
      useWebSpeechDictation({ onTranscript, transcribeAudio }),
    );
    await startListening(result);
    await hearSpeech(harness, 300);
    await hearSilence(harness, UTTERANCE_END_MS);
    expect(transcribeAudio).toHaveBeenCalled();
    expect(onTranscript).not.toHaveBeenCalled();
  });

  it("flushes the last spoken utterance on Stop", async () => {
    const harness = installDictationMocks();
    transcribeAudio.mockResolvedValue({ text: "I shall not want" });
    const onTranscript = vi.fn();
    const { result } = renderHook(() =>
      useWebSpeechDictation({ onTranscript, transcribeAudio }),
    );
    await startListening(result);
    await hearSpeech(harness, 400);
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
    await startListening(result);
    act(() => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", { key: " ", bubbles: true }),
      );
    });
    expect(result.current.listening).toBe(false);
  });

  it("logs listen start/stop when STT debug is on", async () => {
    window.localStorage.setItem(STT_DEBUG_STORAGE_KEY, "1");
    installDictationMocks();
    const { result } = renderHook(() =>
      useWebSpeechDictation({ onTranscript: () => {}, transcribeAudio }),
    );
    await startListening(result);
    act(() => {
      result.current.stop();
    });

    const bodies = getDevLogEntries().map((entry) => entry.body);
    expect(bodies.some((body) => body.includes("listen-start"))).toBe(true);
    expect(
      bodies.some(
        (body) =>
          body.includes("listen-stop") && body.includes('"reason":"stop"'),
      ),
    ).toBe(true);
  });

  it("logs append and Groq transcript fields after a spoken utterance", async () => {
    window.localStorage.setItem(STT_DEBUG_STORAGE_KEY, "1");
    const harness = installDictationMocks();
    transcribeAudio.mockResolvedValue({
      text: "The Lord is my shepherd",
      requestId: "req_test_1",
      model: "whisper-large-v3",
      httpStatus: 200,
      latencyMs: 42,
    });
    const { result } = renderHook(() =>
      useWebSpeechDictation({ onTranscript: () => {}, transcribeAudio }),
    );
    await startListening(result);
    await hearSpeech(harness, 300);
    await hearSilence(harness, UTTERANCE_END_MS);

    const bodies = getDevLogEntries().map((entry) => entry.body);
    expect(bodies.some((body) => body.includes("clip-send"))).toBe(true);
    expect(bodies.some((body) => body.includes("transcribe-result"))).toBe(
      true,
    );
    expect(bodies.some((body) => body.includes("req_test_1"))).toBe(true);
    expect(
      bodies.some((body) => body.includes("The Lord is my shepherd")),
    ).toBe(true);
    expect(bodies.some((body) => body.includes("stitch"))).toBe(true);
  });
});
