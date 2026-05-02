import { describe, expect, it } from "vitest";
import { diffWords } from "./diff-words";

describe("diffWords", () => {
  it("returns an empty array when typed is empty or whitespace", () => {
    expect(diffWords("", "Jesus wept.")).toEqual([]);
    expect(diffWords("   \n  ", "Jesus wept.")).toEqual([]);
  });

  it("marks every token as match when typed equals actual", () => {
    expect(diffWords("Jesus wept.", "Jesus wept.")).toEqual([
      { text: "Jesus", status: "match" },
      { text: "wept.", status: "match" },
    ]);
  });

  it("emits a missing token when typed omits a word at the end", () => {
    expect(diffWords("the quick brown", "the quick brown fox")).toEqual([
      { text: "the", status: "match" },
      { text: "quick", status: "match" },
      { text: "brown", status: "match" },
      { text: "fox", status: "missing" },
    ]);
  });

  it("emits an extra token when typed adds a word after actual", () => {
    expect(diffWords("the quick brown fox", "the quick brown")).toEqual([
      { text: "the", status: "match" },
      { text: "quick", status: "match" },
      { text: "brown", status: "match" },
      { text: "fox", status: "extra" },
    ]);
  });

  it("emits a mismatch using typed text when a word differs", () => {
    expect(diffWords("the quick red fox", "the quick brown fox")).toEqual([
      { text: "the", status: "match" },
      { text: "quick", status: "match" },
      { text: "red", expectedText: "brown", status: "mismatch" },
      { text: "fox", status: "match" },
    ]);
  });

  it("keeps later words matched when typed omits words in the middle", () => {
    expect(
      diffWords(
        "Moses and the prophets wrote Jesus of Nazareth",
        "Moses in the Law and also the prophets wrote Jesus of Nazareth",
      ),
    ).toEqual([
      { text: "Moses", status: "match" },
      { text: "in", status: "missing" },
      { text: "the", status: "missing" },
      { text: "Law", status: "missing" },
      { text: "and", status: "match" },
      { text: "also", status: "missing" },
      { text: "the", status: "match" },
      { text: "prophets", status: "match" },
      { text: "wrote", status: "match" },
      { text: "Jesus", status: "match" },
      { text: "of", status: "match" },
      { text: "Nazareth", status: "match" },
    ]);
  });

  it("keeps later words matched when typed adds a word in the middle", () => {
    expect(
      diffWords("the quick very brown fox", "the quick brown fox"),
    ).toEqual([
      { text: "the", status: "match" },
      { text: "quick", status: "match" },
      { text: "very", status: "extra" },
      { text: "brown", status: "match" },
      { text: "fox", status: "match" },
    ]);
  });

  it("keeps later words matched in an equal-length shifted attempt", () => {
    expect(
      diffWords("one extra four five six", "one two three four five"),
    ).toEqual([
      { text: "one", status: "match" },
      { text: "two", status: "missing" },
      { text: "extra", expectedText: "three", status: "mismatch" },
      { text: "four", status: "match" },
      { text: "five", status: "match" },
      { text: "six", status: "extra" },
    ]);
  });

  it("renders the user's typo instead of striking through the correct word", () => {
    expect(diffWords("Jesus answerd him", "Jesus answered him")).toEqual([
      { text: "Jesus", status: "match" },
      { text: "answerd", expectedText: "answered", status: "mismatch" },
      { text: "him", status: "match" },
    ]);
  });

  it("treats case and trailing punctuation differences as a match", () => {
    expect(diffWords("jesus wept", "Jesus wept.")).toEqual([
      { text: "Jesus", status: "match" },
      { text: "wept.", status: "match" },
    ]);
  });
});
