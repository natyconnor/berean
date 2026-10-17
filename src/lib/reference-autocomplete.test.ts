import { describe, expect, it } from "vitest";

import { buildReferenceSuggestions } from "./reference-autocomplete";

function labels(input: string): string[] {
  return buildReferenceSuggestions(input).map((item) => item.label);
}

describe("buildReferenceSuggestions", () => {
  it("suggests nothing for empty text", () => {
    expect(buildReferenceSuggestions("   ")).toEqual([]);
  });

  it("completes book names like the note editor", () => {
    const [peter] = buildReferenceSuggestions("2 pe");
    expect(peter).toEqual({
      key: "book:2 Peter",
      label: "2 Peter",
      description: "3 chapters",
      text: "2 Peter ",
    });
    expect(labels("1")).toEqual(
      expect.arrayContaining(["1 Samuel", "1 Corinthians", "1 Peter"]),
    );
    expect(labels("1")).toHaveLength(6);
    expect(labels("1 j")[0]).toBe("1 John");
  });

  it("keeps suggesting books while the name is ambiguous", () => {
    expect(labels("jo ")).toEqual(
      expect.arrayContaining(["Joshua", "Job", "Joel", "Jonah", "John"]),
    );
  });

  it("types a single psalm after the book", () => {
    expect(buildReferenceSuggestions("psa")[0]).toMatchObject({
      label: "Psalms",
      text: "Psalm ",
    });
  });

  it("lists chapters once the book is settled", () => {
    expect(buildReferenceSuggestions("2 Peter ")).toEqual([
      {
        key: "chapter:2 Peter 1",
        label: "2 Peter 1",
        description: "21 verses",
        text: "2 Peter 1",
      },
      {
        key: "chapter:2 Peter 2",
        label: "2 Peter 2",
        description: "22 verses",
        text: "2 Peter 2",
      },
      {
        key: "chapter:2 Peter 3",
        label: "2 Peter 3",
        description: "18 verses",
        text: "2 Peter 3",
      },
    ]);
    expect(labels("2 pe ")).toEqual(["2 Peter 1", "2 Peter 2", "2 Peter 3"]);
  });

  it("continues a typed chapter number", () => {
    expect(labels("Psalm 11")).toEqual([
      "Psalm 110",
      "Psalm 111",
      "Psalm 112",
      "Psalm 113",
      "Psalm 114",
      "Psalm 115",
    ]);
    expect(labels("2 Peter 4")).toEqual([]);
  });

  it("lists verses after the colon", () => {
    expect(labels("2 Peter 2:")).toEqual([
      "2 Peter 2:1",
      "2 Peter 2:2",
      "2 Peter 2:3",
      "2 Peter 2:4",
      "2 Peter 2:5",
      "2 Peter 2:6",
    ]);
    expect(labels("John 3:1")).toEqual([
      "John 3:10",
      "John 3:11",
      "John 3:12",
      "John 3:13",
      "John 3:14",
      "John 3:15",
    ]);
    expect(labels("2 Peter 9:")).toEqual([]);
  });

  it("finishes a verse range with its size", () => {
    expect(buildReferenceSuggestions("2 Peter 2:9-")[0]).toEqual({
      key: "range:2 Peter 2:9–10",
      label: "2 Peter 2:9–10",
      description: "2 verses",
      text: "2 Peter 2:9–10",
    });
    expect(labels("John 3:16–1")).toEqual([
      "John 3:16–17",
      "John 3:16–18",
      "John 3:16–19",
    ]);
    expect(labels("John 3:36-")).toEqual([]);
  });

  it("ignores text that is not a reference", () => {
    expect(labels("Nowhere 99")).toEqual([]);
    expect(labels("love one another")).toEqual([]);
    expect(labels("2 2")).toEqual([]);
  });
});
