import { describe, expect, it } from "vitest";
import {
  COMPOSE_PASSAGE_COLUMNS_CLASS,
  READ_PASSAGE_COLUMNS_CLASS,
  passageColumnsClass,
} from "./passage-columns";

describe("passage column tracks", () => {
  it("holds the scripture column in read mode and lets notes shrink first", () => {
    expect(READ_PASSAGE_COLUMNS_CLASS).toBe(
      "grid-cols-[minmax(22rem,34rem)_minmax(17.5rem,1fr)] gap-6",
    );
    expect(passageColumnsClass(true)).toBe(READ_PASSAGE_COLUMNS_CLASS);
    expect(READ_PASSAGE_COLUMNS_CLASS).not.toContain("520px");
  });

  it("lets compose and focus notes shrink before the passage track", () => {
    expect(COMPOSE_PASSAGE_COLUMNS_CLASS).toBe(
      "grid-cols-[minmax(24rem,2.5fr)_minmax(17.5rem,1fr)] gap-5",
    );
    expect(passageColumnsClass(false)).toBe(COMPOSE_PASSAGE_COLUMNS_CLASS);
    expect(COMPOSE_PASSAGE_COLUMNS_CLASS).not.toContain("360px");
  });
});
