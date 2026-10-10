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

  it("caps compose and focus notes, then gives that width back", () => {
    expect(COMPOSE_PASSAGE_COLUMNS_CLASS).toBe(
      "grid-cols-[minmax(24rem,1fr)_minmax(17.5rem,27.5rem)] gap-5",
    );
    expect(passageColumnsClass(false)).toBe(COMPOSE_PASSAGE_COLUMNS_CLASS);
    expect(COMPOSE_PASSAGE_COLUMNS_CLASS).not.toContain("360px");
  });
});
