import { afterEach, describe, expect, it, vi } from "vitest";

import {
  barHeightsFromTimeDomain,
  openLiveMicAnalyser,
  WAVE_MIN_HEIGHT_PX,
} from "./mic-amplitude";

describe("barHeightsFromTimeDomain", () => {
  it("keeps silent PCM at the rest height", () => {
    const samples = new Uint8Array(48).fill(128);
    expect(
      barHeightsFromTimeDomain(samples, 4).every(
        (h) => h === WAVE_MIN_HEIGHT_PX,
      ),
    ).toBe(true);
  });

  it("maps full-scale amplitude near the max height", () => {
    const samples = new Uint8Array(24).fill(0);
    const heights = barHeightsFromTimeDomain(samples, 4);
    expect(Math.min(...heights)).toBeGreaterThan(WAVE_MIN_HEIGHT_PX);
    expect(heights.every((h) => h === heights[0])).toBe(true);
  });

  it("makes louder slices taller than quiet slices", () => {
    const samples = new Uint8Array(48);
    samples.fill(128, 0, 24);
    samples.fill(0, 24, 48);
    const [quiet, loud] = barHeightsFromTimeDomain(samples, 2);
    expect(quiet).toBe(WAVE_MIN_HEIGHT_PX);
    expect(loud).toBeGreaterThan(WAVE_MIN_HEIGHT_PX);
  });

  it("returns rest heights for an empty buffer", () => {
    expect(barHeightsFromTimeDomain([], 3)).toEqual([
      WAVE_MIN_HEIGHT_PX,
      WAVE_MIN_HEIGHT_PX,
      WAVE_MIN_HEIGHT_PX,
    ]);
  });
});

describe("openLiveMicAnalyser", () => {
  const originalMedia = navigator.mediaDevices;

  afterEach(() => {
    vi.unstubAllGlobals();
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: originalMedia,
    });
  });

  it("returns null when getUserMedia is unavailable", async () => {
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: undefined,
    });
    expect(await openLiveMicAnalyser()).toBeNull();
  });

  it("returns null when the permission prompt is denied", async () => {
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: vi.fn().mockRejectedValue(new Error("denied")),
      },
    });
    expect(await openLiveMicAnalyser()).toBeNull();
  });

  it("opens one stream and stops tracks exactly once", async () => {
    const stopTrack = vi.fn();
    const stream = { getTracks: () => [{ stop: stopTrack }] };
    const getUserMedia = vi.fn().mockResolvedValue(stream);
    const source = { connect: vi.fn(), disconnect: vi.fn() };
    const analyser = { fftSize: 0, smoothingTimeConstant: 0 };
    const context = {
      state: "running",
      createMediaStreamSource: vi.fn(() => source),
      createAnalyser: vi.fn(() => analyser),
      resume: vi.fn(),
      close: vi.fn().mockResolvedValue(undefined),
    };

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

    const session = await openLiveMicAnalyser();
    expect(session).not.toBeNull();
    expect(getUserMedia).toHaveBeenCalledTimes(1);
    expect(getUserMedia).toHaveBeenCalledWith({ audio: true, video: false });
    expect(context.createMediaStreamSource).toHaveBeenCalledWith(stream);
    expect(source.connect).toHaveBeenCalledWith(analyser);
    expect(analyser.fftSize).toBe(1024);

    session?.stop();
    session?.stop();
    expect(stopTrack).toHaveBeenCalledTimes(1);
    expect(source.disconnect).toHaveBeenCalledTimes(1);
    expect(context.close).toHaveBeenCalledTimes(1);
  });
});
