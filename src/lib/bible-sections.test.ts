import { describe, expect, it } from "vitest";

import { BIBLE_BOOKS } from "./bible-books";
import {
  BIBLE_SECTIONS,
  bibleSectionOf,
  groupByBibleSection,
} from "./bible-sections";
import {
  HUNDRED_VERSES_PRESET_ID,
  getMemoryPreset,
} from "../../shared/memory-presets";

describe("bible sections", () => {
  it("lists the sections in canonical order", () => {
    expect(BIBLE_SECTIONS.map((section) => section.title)).toEqual([
      "Law",
      "History",
      "Wisdom & Poetry",
      "Prophets",
      "Gospels & Acts",
      "Letters",
      "Revelation",
    ]);
  });

  it("covers every book exactly once, in canon order", () => {
    expect(BIBLE_SECTIONS.flatMap((section) => section.books)).toEqual(
      BIBLE_BOOKS.map((book) => book.name),
    );
  });

  it("bounds each section by its first and last book", () => {
    const bounds = BIBLE_SECTIONS.map((section) => [
      section.books[0],
      section.books.at(-1),
    ]);
    expect(bounds).toEqual([
      ["Genesis", "Deuteronomy"],
      ["Joshua", "Esther"],
      ["Job", "Song of Solomon"],
      ["Isaiah", "Malachi"],
      ["Matthew", "Acts"],
      ["Romans", "Jude"],
      ["Revelation", "Revelation"],
    ]);
  });

  it("finds a book's section by its canonical name", () => {
    expect(bibleSectionOf("Psalms")?.id).toBe("wisdom");
    expect(bibleSectionOf("Lamentations")?.id).toBe("prophets");
    expect(bibleSectionOf("Acts")?.id).toBe("gospels");
    expect(bibleSectionOf("Hebrews")?.id).toBe("letters");
    expect(bibleSectionOf("3 John")?.id).toBe("letters");
    expect(bibleSectionOf("Psalm")).toBeUndefined();
  });

  it("groups items by section in canonical order, keeping item order", () => {
    const items = [
      { id: "rev", book: "Revelation" },
      { id: "john-3", book: "John" },
      { id: "gen", book: "Genesis" },
      { id: "john-1", book: "John" },
      { id: "nope", book: "Hezekiah" },
    ];

    const groups = groupByBibleSection(items, (item) => item.book);

    expect(
      groups.map(({ section, items: grouped }) => [
        section.id,
        grouped.map((item) => item.id),
      ]),
    ).toEqual([
      ["law", ["gen"]],
      ["gospels", ["john-3", "john-1"]],
      ["revelation", ["rev"]],
    ]);
  });

  it("places every suggested passage in a section", () => {
    const preset = getMemoryPreset(HUNDRED_VERSES_PRESET_ID);
    if (preset?.kind !== "collection") throw new Error("missing collection");

    for (const passage of preset.passages) {
      expect(bibleSectionOf(passage.book), passage.id).toBeDefined();
    }
  });
});
