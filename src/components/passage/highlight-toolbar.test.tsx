import { act, render, screen } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { HighlightToolbar } from "./highlight-toolbar";

describe("HighlightToolbar", () => {
  it("names each color swatch", () => {
    const verse = document.createElement("span");
    verse.textContent = "In the beginning";
    document.body.appendChild(verse);
    const range = document.createRange();
    range.selectNodeContents(verse);
    range.getBoundingClientRect = () => new DOMRect(10, 100, 70, 20);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);

    const verseTextRef = createRef<HTMLSpanElement>();
    verseTextRef.current = verse;

    render(
      <HighlightToolbar verseTextRef={verseTextRef} onHighlight={vi.fn()} />,
    );

    act(() => {
      document.dispatchEvent(new Event("selectionchange"));
    });

    expect(
      screen.getByRole("button", { name: "Highlight Yellow" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Highlight Green" }),
    ).toBeInTheDocument();

    verse.remove();
    selection?.removeAllRanges();
  });
});
