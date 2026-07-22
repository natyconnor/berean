import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { VerseRefPreviewContent } from "./verse-ref-hover-preview";

describe("VerseRefPreviewContent", () => {
  it("shows the first verses and an ellipsis for chapter links", () => {
    render(
      <VerseRefPreviewContent
        refValue={{
          book: "John",
          chapter: 3,
          startVerse: 1,
          endVerse: 1,
          scope: "chapter",
        }}
        loading={false}
        error={null}
        verses={[
          { number: 1, text: "First." },
          { number: 2, text: "Second." },
          { number: 3, text: "Third." },
        ]}
        showChapterEllipsis
        showClickHint
      />,
    );

    expect(screen.getByText("John 3")).toBeInTheDocument();
    expect(screen.getByText("First.")).toBeInTheDocument();
    expect(screen.getByText("Second.")).toBeInTheDocument();
    expect(screen.getByText("Third.")).toBeInTheDocument();
    expect(screen.getByText("…")).toBeInTheDocument();
    expect(screen.getByText("Click to go to chapter")).toBeInTheDocument();
  });

  it("does not show an ellipsis for verse links", () => {
    render(
      <VerseRefPreviewContent
        refValue={{
          book: "John",
          chapter: 3,
          startVerse: 16,
          endVerse: 16,
        }}
        loading={false}
        error={null}
        verses={[{ number: 16, text: "For God so loved the world..." }]}
        showClickHint
      />,
    );

    expect(screen.getByText("John 3:16")).toBeInTheDocument();
    expect(screen.queryByText("…")).not.toBeInTheDocument();
    expect(screen.getByText("Click to go to verse")).toBeInTheDocument();
  });
});
