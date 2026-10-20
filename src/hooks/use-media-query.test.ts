import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  MOBILE_MEDIA_QUERY,
  useIsMobile,
  useMediaQuery,
} from "./use-media-query";

type Listener = () => void;

/** A `matchMedia` stub whose `matches` the test flips. */
function stubMatchMedia(initial: boolean) {
  let matches = initial;
  const listeners = new Set<Listener>();
  const queries: string[] = [];
  const matchMedia = vi.fn((query: string) => {
    queries.push(query);
    return {
      get matches() {
        return matches;
      },
      media: query,
      addEventListener: (_type: string, listener: Listener) =>
        listeners.add(listener),
      removeEventListener: (_type: string, listener: Listener) =>
        listeners.delete(listener),
    } as unknown as MediaQueryList;
  });
  vi.stubGlobal("matchMedia", matchMedia);
  return {
    queries,
    listeners,
    set(next: boolean) {
      matches = next;
      for (const listener of listeners) listener();
    },
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useMediaQuery", () => {
  it("is false when matchMedia is unavailable", () => {
    vi.stubGlobal("matchMedia", undefined);
    const { result } = renderHook(() => useMediaQuery("(min-width: 1px)"));
    expect(result.current).toBe(false);
  });

  it("follows the media query as it changes and unsubscribes on unmount", () => {
    const media = stubMatchMedia(false);
    const { result, unmount } = renderHook(() =>
      useMediaQuery("(min-width: 900px)"),
    );
    expect(result.current).toBe(false);
    expect(media.queries).toContain("(min-width: 900px)");

    act(() => media.set(true));
    expect(result.current).toBe(true);

    act(() => media.set(false));
    expect(result.current).toBe(false);

    unmount();
    expect(media.listeners.size).toBe(0);
  });
});

describe("useIsMobile", () => {
  it("checks the below-640px query", () => {
    const media = stubMatchMedia(true);
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(true);
    expect(media.queries).toContain(MOBILE_MEDIA_QUERY);
  });
});
