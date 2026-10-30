import { describe, expect, it } from "vitest";

import {
  FINISH_LABEL,
  PRACTICE_AGAIN_LABEL,
  PRACTICE_NEXT_VERSE_LABEL,
  practiceEndKind,
  practiceEndLabel,
} from "./practice-end-label";

describe("practiceEndKind", () => {
  it("names a single verse or passage Practice again", () => {
    expect(
      practiceEndKind({ kind: "practice", total: 1, remainingAfter: 0 }),
    ).toBe("again");
    expect(practiceEndLabel("again")).toBe(PRACTICE_AGAIN_LABEL);
  });

  it("names the next verse while cards remain", () => {
    expect(
      practiceEndKind({ kind: "practice", total: 4, remainingAfter: 2 }),
    ).toBe("next");
    expect(practiceEndLabel("next")).toBe(PRACTICE_NEXT_VERSE_LABEL);
  });

  it("names Finish on the last card of a multi-verse practice", () => {
    expect(
      practiceEndKind({ kind: "practice", total: 3, remainingAfter: 0 }),
    ).toBe("finish");
    expect(practiceEndLabel("finish")).toBe(FINISH_LABEL);
  });

  it("leaves Review and Learn on their own Continue labels", () => {
    expect(
      practiceEndKind({ kind: "review", total: 1, remainingAfter: 0 }),
    ).toBeNull();
    expect(
      practiceEndKind({ kind: "learning", total: 2, remainingAfter: 1 }),
    ).toBeNull();
  });
});
