import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { formatMemoryStatusCaption } from "@/lib/memory-due-label";

import { MemoryStatusCaptionLine } from "./memory-status-caption";

describe("MemoryStatusCaptionLine", () => {
  it("keeps a ready learning caption as plain text", () => {
    const caption = formatMemoryStatusCaption({
      status: "learning",
      statusLabel: "Learning",
      dueAt: new Date(2026, 5, 15, 5, 57).getTime(),
      now: new Date(2026, 5, 15, 6, 10).getTime(),
    });
    render(
      <MemoryStatusCaptionLine
        caption={caption}
        className="block text-xs text-muted-foreground"
      />,
    );
    expect(screen.getByText("Learning")).toBeInTheDocument();
    expect(screen.queryByText(/unlocks/i)).not.toBeInTheDocument();
  });

  it("puts later-today unlock time in title and visually hidden text", () => {
    const caption = formatMemoryStatusCaption({
      status: "learning",
      statusLabel: "Learning",
      dueAt: new Date(2026, 5, 15, 5, 57).getTime(),
      now: new Date(2026, 5, 15, 0, 30).getTime(),
    });
    render(
      <MemoryStatusCaptionLine
        caption={caption}
        className="block text-xs text-muted-foreground"
      />,
    );
    const visible = screen.getByText("Learning · Later today");
    expect(visible).toHaveAttribute("title", "Unlocks at 5:57 AM");
    expect(visible).toHaveAttribute("aria-hidden", "true");
    expect(visible.className).not.toMatch(/truncate/);
    expect(
      screen.getByText("Learning, unlocks later today at 5:57 AM"),
    ).toHaveClass("sr-only");
  });
});
