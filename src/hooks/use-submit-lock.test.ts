import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useSubmitLock } from "./use-submit-lock";

/** A promise whose settlement we control from the test. */
function deferred() {
  let resolve!: () => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("useSubmitLock", () => {
  it("runs a single submit and reflects pending state across its lifetime", async () => {
    const first = deferred();
    const task = vi.fn(() => first.promise);
    const { result } = renderHook(() => useSubmitLock());

    expect(result.current.pending).toBe(false);

    act(() => {
      result.current.submit(task);
    });

    expect(task).toHaveBeenCalledTimes(1);
    expect(result.current.pending).toBe(true);

    await act(async () => {
      first.resolve();
      await first.promise;
    });

    expect(result.current.pending).toBe(false);
  });

  it("drops a second submit fired while the first is still in flight", async () => {
    const first = deferred();
    const task = vi.fn(() => first.promise);
    const { result } = renderHook(() => useSubmitLock());

    // Both calls happen in the same tick, before any re-render — the synchronous
    // ref guard must reject the second one.
    act(() => {
      result.current.submit(task);
      result.current.submit(task);
    });

    expect(task).toHaveBeenCalledTimes(1);
    expect(result.current.pending).toBe(true);

    await act(async () => {
      first.resolve();
      await first.promise;
    });

    expect(result.current.pending).toBe(false);
  });

  it("allows a new submit once the previous one settles", async () => {
    const first = deferred();
    const second = deferred();
    const task = vi
      .fn<() => Promise<void>>()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const { result } = renderHook(() => useSubmitLock());

    act(() => {
      result.current.submit(task);
    });
    expect(task).toHaveBeenCalledTimes(1);

    await act(async () => {
      first.resolve();
      await first.promise;
    });
    expect(result.current.pending).toBe(false);

    act(() => {
      result.current.submit(task);
    });
    expect(task).toHaveBeenCalledTimes(2);
    expect(result.current.pending).toBe(true);

    await act(async () => {
      second.resolve();
      await second.promise;
    });
    expect(result.current.pending).toBe(false);
  });

  it("releases the lock even when the task rejects", async () => {
    const first = deferred();
    const task = vi
      .fn<() => Promise<void>>()
      .mockReturnValueOnce(first.promise)
      .mockResolvedValueOnce(undefined);
    const { result } = renderHook(() => useSubmitLock());

    act(() => {
      result.current.submit(task);
    });
    expect(result.current.pending).toBe(true);

    await act(async () => {
      first.reject(new Error("boom"));
      await first.promise.catch(() => undefined);
    });

    expect(result.current.pending).toBe(false);

    // A failed attempt must not strand the control: a fresh submit still runs.
    act(() => {
      result.current.submit(task);
    });
    expect(task).toHaveBeenCalledTimes(2);
  });
});
