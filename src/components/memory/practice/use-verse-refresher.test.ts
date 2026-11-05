import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useVerseRefresher } from "./use-verse-refresher";

describe("useVerseRefresher", () => {
  it("opens First letters with a kind, then From memory, then off", () => {
    const { result } = renderHook(() => useVerseRefresher());
    expect(result.current.phase).toBe("off");
    expect(result.current.kind).toBeNull();

    act(() => {
      result.current.open("after-miss");
    });
    expect(result.current.phase).toBe("step1");
    expect(result.current.kind).toBe("after-miss");
    expect(result.current.step).toBe(1);

    act(() => {
      result.current.continueToStep2();
    });
    expect(result.current.phase).toBe("step2");
    expect(result.current.kind).toBe("after-miss");

    act(() => {
      result.current.close();
    });
    expect(result.current.phase).toBe("off");
    expect(result.current.kind).toBeNull();
  });

  it("defaults to a pre-try refresher", () => {
    const { result } = renderHook(() => useVerseRefresher());
    act(() => {
      result.current.open();
    });
    expect(result.current.kind).toBe("pre-try");
  });
});
