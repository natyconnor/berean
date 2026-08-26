import type { HTMLAttributes, ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { FROM_MEMORY_CLOSE_MESSAGE } from "./from-memory-messages";
import { VerseMemoryFeedback } from "./verse-memory-feedback";

vi.mock("framer-motion", () => ({
  useReducedMotion: () => true,
  motion: {
    div: ({
      children,
      ...props
    }: HTMLAttributes<HTMLDivElement> & { children: ReactNode }) => (
      <div {...props}>{children}</div>
    ),
    span: ({
      children,
      ...props
    }: HTMLAttributes<HTMLSpanElement> & { children?: ReactNode }) => (
      <span {...props}>{children}</span>
    ),
  },
}));

describe("VerseMemoryFeedback", () => {
  it("celebrates a near-miss on bands that still accept close recalls", () => {
    render(<VerseMemoryFeedback quality="close" attemptKey="guided-close" />);
    expect(screen.getByRole("status")).toHaveTextContent(
      "Good job — really close!",
    );
  });

  it("explains that From Memory needs 100% before the verse can advance", () => {
    render(
      <VerseMemoryFeedback
        quality="close"
        attemptKey="memory-close"
        requireExactToAdvance
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      FROM_MEMORY_CLOSE_MESSAGE,
    );
    expect(screen.getByRole("status")).not.toHaveTextContent("really close");
  });

  it("keeps the exact celebration unchanged on From Memory", () => {
    render(
      <VerseMemoryFeedback
        quality="exact"
        attemptKey="memory-exact"
        requireExactToAdvance
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent("Exactly right!");
  });
});
