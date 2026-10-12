import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { NoteContent } from "./note-card-primitives";

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
