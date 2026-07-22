import { renderHook, act } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useVerseLinkNavigation } from "@/hooks/use-verse-link-navigation";

const openTab = vi.fn();
const navigateActiveTab = vi.fn();

vi.mock("@/lib/use-tabs", () => ({
  useTabs: () => ({
    openTab,
    navigateActiveTab,
  }),
}));

describe("useVerseLinkNavigation", () => {
  beforeEach(() => {
    openTab.mockReset();
    navigateActiveTab.mockReset();
  });

  it("navigates chapter links without verse focus in the same chapter", () => {
    const { result } = renderHook(() =>
      useVerseLinkNavigation({ book: "John", chapter: 3 }),
    );

    act(() => {
      result.current({
        book: "John",
        chapter: 3,
        startVerse: 1,
        endVerse: 1,
        scope: "chapter",
      });
    });

    expect(navigateActiveTab).toHaveBeenCalledWith("John-3", "John 3", {});
    expect(openTab).not.toHaveBeenCalled();
  });

  it("opens a new tab for chapter links without verse focus", () => {
    const { result } = renderHook(() =>
      useVerseLinkNavigation({ book: "John", chapter: 2 }),
    );

    act(() => {
      result.current({
        book: "John",
        chapter: 3,
        startVerse: 1,
        endVerse: 1,
        scope: "chapter",
      });
    });

    expect(openTab).toHaveBeenCalledWith("John-3", "John 3", {});
  });
});
