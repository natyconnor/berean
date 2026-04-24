import { describe, expect, it } from "vitest";

import { diffWords } from "@/lib/diff-words";
import {
  classifyVerseAttempt,
  hasAttemptErrors,
} from "./study-attempt-quality";

describe("classifyVerseAttempt", () => {
  it("returns null when there are no tokens (nothing typed)", () => {
    expect(classifyVerseAttempt([])).toBeNull();
  });

  it("scores an identical attempt as exact", () => {
    const tokens = diffWords("Jesus wept.", "Jesus wept.");
    expect(classifyVerseAttempt(tokens)).toBe("exact");
  });

  it("ignores case and trailing punctuation like diffWords does", () => {
    const tokens = diffWords("jesus wept", "Jesus wept.");
    expect(classifyVerseAttempt(tokens)).toBe("exact");
  });

  it("treats a single missing word on a long verse as close", () => {
    const actual =
      "For God so loved the world that he gave his only Son that whoever believes in him should not perish but have eternal life";
    const typed =
      "For God so loved the world that he gave his only Son that whoever believes in him should not perish but have life";
    expect(classifyVerseAttempt(diffWords(typed, actual))).toBe("close");
  });

  it("treats a single word mix-up on a long verse as close", () => {
    const actual =
      "The Lord is my shepherd I shall not want he makes me lie down in green pastures";
    const typed =
      "The Lord is my shepherd I shall not want he makes me sit down in green pastures";
    expect(classifyVerseAttempt(diffWords(typed, actual))).toBe("close");
  });

  it("does not count a two-word verse with one wrong word as close", () => {
    const tokens = diffWords("Jesus cried", "Jesus wept");
    expect(classifyVerseAttempt(tokens)).toBe("off");
  });

  it("marks wildly different input as off", () => {
    const actual = "In the beginning was the Word and the Word was with God";
    const typed = "Once upon a time there lived a king";
    expect(classifyVerseAttempt(diffWords(typed, actual))).toBe("off");
  });
});

describe("hasAttemptErrors", () => {
  it("returns false when every token matches", () => {
    const tokens = diffWords("Jesus wept.", "Jesus wept.");
    expect(hasAttemptErrors(tokens)).toBe(false);
  });

  it("returns true when at least one token is a mismatch/missing/extra", () => {
    const tokens = diffWords("Jesus cried", "Jesus wept");
    expect(hasAttemptErrors(tokens)).toBe(true);
  });
});
