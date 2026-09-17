import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { WAVE_BAR_COUNT, WAVE_MIN_HEIGHT_PX } from "./mic-amplitude";
import { RecallDictationMic } from "./recall-dictation-mic";

type MicHarness = {
  analyser: {
    fftSize: number;
    smoothingTimeConstant: number;
    getByteTimeDomainData: ReturnType<typeof vi.fn>;
  };
  frames: FrameRequestCallback[];
  getUserMedia: ReturnType<typeof vi.fn>;
  stopTrack: ReturnType<typeof vi.fn>;
  timeDomain: Uint8Array;
};

function installMicMocks(): MicHarness {
  const stopTrack = vi.fn();
  const stream = { getTracks: () => [{ stop: stopTrack }] };
  const timeDomain = new Uint8Array(1024).fill(128);
  const analyser = {
    fftSize: 1024,
    smoothingTimeConstant: 0,
    getByteTimeDomainData: vi.fn((buffer: Uint8Array) => {
      const n = Math.min(buffer.length, timeDomain.length);
      for (let i = 0; i < n; i += 1) {
        buffer[i] = timeDomain[i] ?? 128;
      }
    }),
  };
  const source = { connect: vi.fn(), disconnect: vi.fn() };
  const context = {
    state: "running",
    createMediaStreamSource: vi.fn(() => source),
    createAnalyser: vi.fn(() => analyser),
    resume: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
  };
  const getUserMedia = vi.fn().mockResolvedValue(stream);

  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: { getUserMedia },
  });
  vi.stubGlobal(
    "AudioContext",
    vi.fn(function AudioContext() {
      return context;
    }),
  );

  const frames: FrameRequestCallback[] = [];
  vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
    frames.push(cb);
    return frames.length;
  });
  vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});

  return { analyser, frames, getUserMedia, stopTrack, timeDomain };
}

function barHeights(): number[] {
  return [
    ...document.querySelectorAll('[data-slot="dictation-waveform"] span'),
  ].map((bar) => Number.parseInt((bar as HTMLElement).style.height, 10));
}

describe("RecallDictationMic live waveform", () => {
  const originalMedia = navigator.mediaDevices;

  beforeEach(() => {
    window.localStorage.removeItem("berean:mockSpeech");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: originalMedia,
    });
  });

  it("keeps the idle Speak control and does not open the mic", () => {
    const onToggle = vi.fn();
    const { getUserMedia } = installMicMocks();
    render(<RecallDictationMic listening={false} onToggle={onToggle} />);

    expect(
      screen.getByRole("button", { name: "Dictate verse" }),
    ).toHaveTextContent("Speak the verse");
    expect(
      document.querySelector('[data-slot="dictation-waveform"]'),
    ).toBeNull();
    expect(getUserMedia).not.toHaveBeenCalled();
  });

  it("shows a prominent stop button and follows analyser amplitude on one stream", async () => {
    const onToggle = vi.fn();
    const { frames, getUserMedia, stopTrack, timeDomain } = installMicMocks();
    const { rerender } = render(
      <RecallDictationMic listening onToggle={onToggle} />,
    );

    const stop = screen.getByRole("button", { name: "Stop dictation" });
    expect(stop).toHaveTextContent("Stop listening");
    expect(stop).toHaveClass("bg-red-600");
    expect(
      document.querySelector('[data-slot="dictation-waveform"]'),
    ).not.toBeNull();
    expect(barHeights()).toHaveLength(WAVE_BAR_COUNT);

    await waitFor(() => {
      expect(getUserMedia).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(document.querySelector('[data-mic="live"]')).not.toBeNull();
    });

    rerender(<RecallDictationMic listening onToggle={onToggle} />);
    expect(getUserMedia).toHaveBeenCalledTimes(1);

    timeDomain.fill(0);
    act(() => {
      frames.at(-1)?.(0);
    });
    expect(Math.max(...barHeights())).toBeGreaterThan(WAVE_MIN_HEIGHT_PX);

    timeDomain.fill(128);
    act(() => {
      frames.at(-1)?.(0);
    });
    expect(barHeights().every((h) => h === WAVE_MIN_HEIGHT_PX)).toBe(true);

    rerender(<RecallDictationMic listening={false} onToggle={onToggle} />);
    await waitFor(() => {
      expect(stopTrack).toHaveBeenCalledTimes(1);
    });
    expect(
      document.querySelector('[data-slot="dictation-waveform"]'),
    ).toBeNull();
  });

  it("still shows listening chrome if getUserMedia fails", async () => {
    installMicMocks();
    const getUserMedia = vi.fn().mockRejectedValue(new Error("denied"));
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia },
    });

    render(<RecallDictationMic listening onToggle={() => {}} />);
    expect(
      screen.getByRole("button", { name: "Stop dictation" }),
    ).toBeVisible();
    await waitFor(() => {
      expect(getUserMedia).toHaveBeenCalled();
    });
    expect(document.querySelector('[data-mic="live"]')).toBeNull();
    expect(barHeights().every((h) => h === WAVE_MIN_HEIGHT_PX)).toBe(true);
  });

  it("toggles via the stop button", async () => {
    const onToggle = vi.fn();
    installMicMocks();
    const user = userEvent.setup();
    render(<RecallDictationMic listening onToggle={onToggle} />);
    await user.click(screen.getByRole("button", { name: "Stop dictation" }));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });
});
