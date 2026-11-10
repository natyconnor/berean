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
    expect(result.current.firstLetters).toBe(true);
    expect([result.current.step, result.current.total]).toEqual([1, 2]);

    act(() => {
      result.current.continueToNext();
    });
    expect(result.current.phase).toBe("step2");
    expect(result.current.kind).toBe("after-miss");
    expect(result.current.firstLetters).toBe(false);
    expect([result.current.step, result.current.total]).toEqual([2, 2]);

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

  it("grows to 1 of 3 after a step 1 miss, then every-word, then From memory", () => {
    const { result } = renderHook(() => useVerseRefresher("practice"));
    const weak = [{ chapter: 1, verse: 2 }];

    act(() => {
      result.current.needEveryWord(weak);
    });
    expect(result.current.phase).toBe("step1");
    expect([result.current.step, result.current.total]).toEqual([1, 3]);

    act(() => {
      result.current.continueToNext();
    });
    expect(result.current.phase).toBe("every-word");
    expect(result.current.firstLetters).toBe(true);
    expect(result.current.everyWordVerses).toEqual(weak);
    expect([result.current.step, result.current.total]).toEqual([2, 3]);

    // An every-word retry is not a new step 1 miss: it adds nothing.
    act(() => {
      result.current.needEveryWord([]);
    });
    expect(result.current.everyWordVerses).toEqual(weak);

    act(() => {
      result.current.continueToNext();
    });
    expect(result.current.phase).toBe("step2");
    expect([result.current.step, result.current.total]).toEqual([3, 3]);
  });

  it("starts over at 1 of 2 with a new seed when opened again", () => {
    const seeds = [0.25, 0.75];
    const random = () => seeds.shift() ?? 0;
    const { result } = renderHook(() => useVerseRefresher("pre-try", random));
    const firstSeed = result.current.seed;

    act(() => {
      result.current.needEveryWord();
      result.current.continueToNext();
    });
    expect(result.current.phase).toBe("every-word");

    act(() => {
      result.current.open("practice");
    });
    expect(result.current.phase).toBe("step1");
    expect([result.current.step, result.current.total]).toEqual([1, 2]);
    expect(result.current.everyWordVerses).toEqual([]);
    expect(result.current.seed).not.toBe(firstSeed);
  });
});
