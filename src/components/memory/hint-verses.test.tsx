import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { maskVerseText, plainVerseHint } from "@/lib/verse-hint";

import { CHAPTER_GAP_CLASS, HintVerses, VERSE_GAP_CLASS } from "./hint-verses";

// Jude 1:1 as the ESV text gives it: a paragraph break inside the verse.
const JUDE_1 =
  "Jude, a servant of Jesus Christ and brother of James,\n\nTo those who are called, beloved in God the Father and kept for Jesus Christ:";
const JUDE_2 = "May mercy, peace, and love be multiplied to you.";
const PS131_1 =
  "O Lord, my heart is not lifted up;\n    my eyes are not raised too high;";

function paragraphs(container: HTMLElement) {
  return Array.from(container.querySelectorAll("p"));
}

describe("HintVerses (#378)", () => {
  it("uses about half a line between verses and one and a half at a chapter", () => {
    expect(VERSE_GAP_CLASS).toBe("mt-[0.5em]");
    expect(CHAPTER_GAP_CLASS).toBe("mt-[1.5em]");
  });

  it("gives each verse its own paragraph, a small gap above each later verse", () => {
    const { container } = render(
      <HintVerses
        verses={[
          plainVerseHint("Jude|1", maskVerseText(JUDE_1, "hidden")),
          plainVerseHint("Jude|1", maskVerseText(JUDE_2, "first-letters")),
        ]}
        label="Hint"
      />,
    );
    const [one, two] = paragraphs(container);
    expect(paragraphs(container)).toHaveLength(2);
    expect(one?.className).toBe("");
    expect(two?.className).toBe(VERSE_GAP_CLASS);
    // Gaps are spacing, not text: no blank line anywhere in the hint.
    expect(container.textContent).not.toMatch(/\n\s*\n/);
  });

  it("turns Jude 1:1's paragraph break into one line break inside the verse", () => {
    const { container } = render(
      <HintVerses
        verses={[
          plainVerseHint("Jude|1", maskVerseText(JUDE_1, "first-letters")),
          {
            chapter: "Jude|1",
            tokens: maskVerseText(JUDE_2, "first-letters"),
          },
        ]}
      />,
    );
    const [one] = paragraphs(container);
    // Still one paragraph for the verse, so a screen reader hears one verse.
    expect(paragraphs(container)).toHaveLength(2);
    const lettered = maskVerseText(JUDE_1, "first-letters")
      .map((token) => token.text)
      .join("");
    expect(lettered).toMatch(/,\n\nT_ /);
    expect(one?.textContent).toBe(lettered.replace(",\n\nT_ ", ",\nT_ "));
  });

  it("does the same for a styled token hint (a learning piece)", () => {
    const { container } = render(
      <HintVerses
        verses={[{ chapter: "", tokens: maskVerseText(JUDE_1, "hidden") }]}
      />,
    );
    expect(container.textContent).toMatch(/,\n_/);
    expect(container.textContent).not.toMatch(/\n\n/);
    expect(container.querySelector(".font-mono")).not.toBeNull();
  });

  it("keeps a poetry line break and its indent inside the verse", () => {
    const { container } = render(
      <HintVerses
        verses={[
          {
            chapter: "Psalms|131",
            tokens: [{ text: PS131_1, word: false, masked: false }],
          },
        ]}
      />,
    );
    expect(paragraphs(container)[0]?.textContent).toBe(PS131_1);
  });

  it("puts a larger gap, and no heading, above the first verse of a new chapter", () => {
    const { container } = render(
      <HintVerses
        verses={[
          plainVerseHint("Psalms|130", maskVerseText("And he will", "hidden")),
          plainVerseHint("Psalms|131", maskVerseText(PS131_1, "hidden")),
          plainVerseHint("Psalms|131", maskVerseText("But I have", "hidden")),
        ]}
      />,
    );
    expect(paragraphs(container).map((p) => p.className)).toEqual([
      "",
      CHAPTER_GAP_CLASS,
      VERSE_GAP_CLASS,
    ]);
    expect(container.textContent).not.toMatch(/Psalm|\d/);
  });

  it("leaves a one-verse hint with no gap above or below", () => {
    const { container } = render(
      <HintVerses
        verses={[plainVerseHint("Jude|1", maskVerseText(JUDE_2, "hidden"))]}
      />,
    );
    expect(paragraphs(container)).toHaveLength(1);
    expect(paragraphs(container)[0]?.className).toBe("");
  });
});
