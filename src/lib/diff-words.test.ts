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

  it("emits a mismatch (using actual text) when lengths match but a word differs", () => {
    expect(diffWords("the quick red fox", "the quick brown fox")).toEqual([
      { text: "the", status: "match" },
      { text: "quick", status: "match" },
      { text: "brown", status: "mismatch" },
      { text: "fox", status: "match" },
    ]);
  });

  it("treats case and trailing punctuation differences as a match", () => {
    expect(diffWords("jesus wept", "Jesus wept.")).toEqual([
      { text: "Jesus", status: "match" },
      { text: "wept.", status: "match" },
    ]);
  });
});
