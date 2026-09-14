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

  it("is incomplete with no books selected in pack-builder mode", () => {
    const { result } = renderHook(() =>
      useScopeForm({ requireChapterSelection: true }),
    );

    expect(result.current.isComplete).toBe(false);
    expect(result.current.selectedBooks).toEqual([]);
  });

  it("treats a listed book with no chapter range as a complete whole-book scope", () => {
    const { result } = renderHook(() =>
      useScopeForm({ requireChapterSelection: true }),
    );

    act(() => {
      result.current.onToggleBook("Genesis");
    });
    expect(result.current.chapterRanges.has("Genesis")).toBe(false);
    expect(result.current.isComplete).toBe(true);

    act(() => {
      result.current.onSetChapterRange("Genesis", { start: 1, end: 1 });
    });
    expect(result.current.isComplete).toBe(true);
  });

  it("allows multi-book scopes without explicit chapter ranges", () => {
    const { result } = renderHook(() =>
      useScopeForm({ requireChapterSelection: true }),
    );

    act(() => {
      result.current.onToggleBook("Genesis");
      result.current.onToggleBook("Exodus");
    });

    expect(result.current.chapterRanges.size).toBe(0);
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

  it("clears a book's chapter range when it is deselected", () => {
    const { result } = renderHook(() =>
      useScopeForm({ requireChapterSelection: true }),
    );

    act(() => {
      result.current.onToggleBook("Genesis");
      result.current.onSetChapterRange("Genesis", { start: 1, end: 1 });
    });
    expect(result.current.chapterRanges.get("Genesis")).toEqual({
      start: 1,
      end: 1,
    });

    act(() => {
      result.current.onToggleBook("Genesis");
    });
    expect(result.current.selectedBooks).toEqual([]);
    expect(result.current.chapterRanges.has("Genesis")).toBe(false);

    act(() => {
      result.current.onToggleBook("Genesis");
    });
    expect(result.current.chapterRanges.has("Genesis")).toBe(false);
    expect(result.current.isComplete).toBe(true);
  });

  it("applies pack-builder presets as whole books with no chapter ranges", () => {
    const { result } = renderHook(() =>
      useScopeForm({ requireChapterSelection: true }),
    );

    act(() => {
      result.current.onSelectPreset(["Genesis", "Exodus"]);
    });

    expect(result.current.selectedBooks).toEqual(["Genesis", "Exodus"]);
    expect(result.current.chapterRanges.size).toBe(0);
    expect(result.current.isComplete).toBe(true);
  });
});
