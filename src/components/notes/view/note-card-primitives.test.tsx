import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { NoteContent, NoteTagList } from "./note-card-primitives";

vi.mock("@/lib/tag-color-styles", () => ({
  useStarterTagBadgeStyle: () => () => undefined,
}));

const LONG_URL =
  "https://example.com/a/very/long/url/without/any/breaks/in/it/at/all";

describe("NoteContent wrapping", () => {
  it("lets long unbroken strings wrap while keeping pre-wrap newlines", () => {
    const { container } = render(
      <NoteContent content={`${LONG_URL}\nsecond line`} />,
    );

    const body = container.firstElementChild;
    expect(body).toHaveClass(
      "min-w-0",
      "wrap-break-word",
      "whitespace-pre-wrap",
    );
    expect(container.querySelector("br")).not.toBeNull();
    expect(container.textContent).toContain(LONG_URL);
    expect(container.textContent).toContain("second line");
  });

  it("keeps wrap classes on truncated previews", () => {
    const { container } = render(
      <NoteContent content={LONG_URL} truncateAt={24} />,
    );

    expect(container.firstElementChild).toHaveClass(
      "min-w-0",
      "wrap-break-word",
      "whitespace-pre-wrap",
    );
    expect(container.textContent).toMatch(/\.\.\.$/);
  });
});

describe("NoteTagList wrapping", () => {
  it("keeps a long unbroken tag inside the chip row", () => {
    const longTag = "a".repeat(48);
    const { container } = render(<NoteTagList tags={[longTag]} />);

    const row = container.firstElementChild;
    expect(row).toHaveClass("min-w-0", "max-w-full", "flex-wrap");

    const chip = container.querySelector("[data-slot='badge']");
    expect(chip).toHaveClass("max-w-full", "min-w-0");
    expect(chip).toHaveAttribute("title", longTag);
    expect(chip?.querySelector("span")).toHaveClass("truncate");
    expect(container.textContent).toBe(longTag);
  });
});
