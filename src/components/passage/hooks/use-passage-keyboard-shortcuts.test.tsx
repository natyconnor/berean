import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { usePassageKeyboardShortcuts } from "./use-passage-keyboard-shortcuts";

function dispatchKey(init: KeyboardEventInit) {
  document.dispatchEvent(
    new KeyboardEvent("keydown", { bubbles: true, ...init }),
  );
}

describe("usePassageKeyboardShortcuts", () => {
  it("toggles section headers on H via event.code", () => {
    const onToggleSectionHeaders = vi.fn();

    renderHook(() =>
      usePassageKeyboardShortcuts({
        previous: null,
        next: null,
        navigateActiveTab: vi.fn(),
        setViewMode: vi.fn(),
        onToggleSectionHeaders,
      }),
    );

    act(() => {
      dispatchKey({ code: "KeyH", key: "Unidentified" });
    });

    expect(onToggleSectionHeaders).toHaveBeenCalledTimes(1);
  });

  it("toggles section headers on H via event.key", () => {
    const onToggleSectionHeaders = vi.fn();

    renderHook(() =>
      usePassageKeyboardShortcuts({
        previous: null,
        next: null,
        navigateActiveTab: vi.fn(),
        setViewMode: vi.fn(),
        onToggleSectionHeaders,
      }),
    );

    act(() => {
      dispatchKey({ code: "", key: "h" });
    });

    expect(onToggleSectionHeaders).toHaveBeenCalledTimes(1);
  });

  it("does not toggle headers while typing in an input", () => {
    const onToggleSectionHeaders = vi.fn();
    const input = document.createElement("input");
    document.body.appendChild(input);

    renderHook(() =>
      usePassageKeyboardShortcuts({
        previous: null,
        next: null,
        navigateActiveTab: vi.fn(),
        setViewMode: vi.fn(),
        onToggleSectionHeaders,
      }),
    );

    act(() => {
      input.dispatchEvent(
        new KeyboardEvent("keydown", {
          bubbles: true,
          code: "KeyH",
          key: "h",
        }),
      );
    });

    expect(onToggleSectionHeaders).not.toHaveBeenCalled();
    input.remove();
  });
});
