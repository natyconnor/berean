import { describe, expect, it } from "vitest";

import {
  FROM_MEMORY_CLOSE_MESSAGE,
  FROM_MEMORY_FIRST_ROUND_PROMPT,
  FROM_MEMORY_SECOND_ROUND_PROMPT,
  fromMemoryPromptLine,
  isFromMemoryLearning,
  requiresExactToAdvance,
} from "./from-memory-messages";

describe("isFromMemoryLearning", () => {
  it("is true only on the From Memory band while still learning", () => {
    expect(isFromMemoryLearning(3, "learning")).toBe(true);
    expect(isFromMemoryLearning(3, "new")).toBe(true);
    expect(isFromMemoryLearning(2, "learning")).toBe(false);
    expect(isFromMemoryLearning(3, "reviewing")).toBe(false);
    expect(isFromMemoryLearning(3, "mastered")).toBe(false);
  });
});

describe("fromMemoryPromptLine", () => {
  it("asks for a first recall before any From Memory exact is banked", () => {
    expect(fromMemoryPromptLine(0)).toBe(FROM_MEMORY_FIRST_ROUND_PROMPT);
  });

  it("asks for one more recall after the first From Memory rep", () => {
    expect(fromMemoryPromptLine(1)).toBe(FROM_MEMORY_SECOND_ROUND_PROMPT);
  });
});

describe("requiresExactToAdvance", () => {
  it("is only true on the graduating From Memory recall", () => {
    expect(requiresExactToAdvance(3, "learning", 0)).toBe(false);
    expect(requiresExactToAdvance(3, "learning", 1)).toBe(true);
    expect(requiresExactToAdvance(2, "learning", 3)).toBe(false);
    expect(requiresExactToAdvance(3, "reviewing", 1)).toBe(false);
  });
});

describe("FROM_MEMORY_CLOSE_MESSAGE", () => {
  it("tells the learner that 100% is required to lock the verse in", () => {
    expect(FROM_MEMORY_CLOSE_MESSAGE).toMatch(/100%/);
    expect(FROM_MEMORY_CLOSE_MESSAGE).toMatch(/lock this verse in/i);
  });
});
