import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useScopeForm } from "./use-scope-form";

describe("useScopeForm", () => {
  it("treats a listed book as complete when chapter selection is not required", () => {
    const { result } = renderHook(() => useScopeForm());

    act(() => {
      result.current.onToggleBook("Genesis");
    });

    expect(result.current.isComplete).toBe(true);
    expect(result.current.chapterRanges.has("Genesis")).toBe(false);
  });

  it("requires a chapter range for multi-chapter books in pack-builder mode", () => {
    const { result } = renderHook(() =>
      useScopeForm({ requireChapterSelection: true }),
    );

    act(() => {
      result.current.onToggleBook("Genesis");
    });
    expect(result.current.isComplete).toBe(false);

    act(() => {
      result.current.onSetChapterRange("Genesis", { start: 1, end: 1 });
    });
    expect(result.current.isComplete).toBe(true);
  });

  it("treats a one-chapter book as complete without a range", () => {
    const { result } = renderHook(() =>
      useScopeForm({ requireChapterSelection: true }),
    );

    act(() => {
      result.current.onToggleBook("Jude");
    });

    expect(result.current.isComplete).toBe(true);
  });

  it("fills explicit full ranges when a pack-builder preset is applied", () => {
    const { result } = renderHook(() =>
      useScopeForm({ requireChapterSelection: true }),
    );

    act(() => {
      result.current.onSelectPreset(["Genesis", "Exodus"]);
    });

    expect(result.current.chapterRanges.get("Genesis")).toEqual({
      start: 1,
      end: 50,
    });
    expect(result.current.chapterRanges.get("Exodus")).toEqual({
      start: 1,
      end: 40,
    });
    expect(result.current.isComplete).toBe(true);
  });
});
