import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAppVersionMonitor } from "./use-app-version-monitor";

const FIVE_MINUTES_MS = 5 * 60 * 1000;

let servedBuildId = __APP_BUILD_ID__;
const fetchMock = vi.fn(() =>
  Promise.resolve(
    new Response(
      JSON.stringify({ appVersion: "1.23.0", buildId: servedBuildId }),
      { status: 200, headers: { "content-type": "application/json" } },
    ),
  ),
);

async function flush() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  servedBuildId = __APP_BUILD_ID__;
  fetchMock.mockClear();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("useAppVersionMonitor", () => {
  it("reports nothing while the live build is this one", async () => {
    const { result } = renderHook(() => useAppVersionMonitor());
    await flush();

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(result.current.showRefreshPrompt).toBe(false);
  });

  it("keeps checking after a new build and moves on to a later one", async () => {
    servedBuildId = "build-a";
    const { result } = renderHook(() => useAppVersionMonitor());
    await flush();
    expect(result.current.latestVersion?.buildId).toBe("build-a");
    expect(result.current.showRefreshPrompt).toBe(true);

    servedBuildId = "build-b";
    await act(async () => {
      await vi.advanceTimersByTimeAsync(FIVE_MINUTES_MS);
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.current.latestVersion?.buildId).toBe("build-b");
  });

  it("checks again when the network comes back after a new build", async () => {
    servedBuildId = "build-a";
    const { result } = renderHook(() => useAppVersionMonitor());
    await flush();

    servedBuildId = "build-b";
    act(() => {
      window.dispatchEvent(new Event("online"));
    });
    await flush();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.current.latestVersion?.buildId).toBe("build-b");
  });

  it("keeps the same build object when the live build has not changed", async () => {
    servedBuildId = "build-a";
    const { result } = renderHook(() => useAppVersionMonitor());
    await flush();
    const first = result.current.latestVersion;

    await act(async () => {
      await vi.advanceTimersByTimeAsync(FIVE_MINUTES_MS);
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.current.latestVersion).toBe(first);
  });
});
