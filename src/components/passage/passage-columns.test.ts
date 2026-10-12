import { describe, expect, it } from "vitest";
import {
  COMPOSE_PASSAGE_COLUMNS_CLASS,
  READ_PASSAGE_COLUMNS_CLASS,
  passageColumnsClass,
} from "./passage-columns";

describe("passage column tracks", () => {
  it("restores the wide read 1fr / 1.4fr split and still lets notes shrink first", () => {
    expect(READ_PASSAGE_COLUMNS_CLASS).toBe(
      "grid-cols-[minmax(22rem,1fr)_minmax(17.5rem,1.4fr)] gap-6",
    );
    expect(passageColumnsClass(true)).toBe(READ_PASSAGE_COLUMNS_CLASS);
    expect(READ_PASSAGE_COLUMNS_CLASS).toContain("1.4fr");
    expect(READ_PASSAGE_COLUMNS_CLASS).toContain("17.5rem");
    expect(READ_PASSAGE_COLUMNS_CLASS).not.toContain("34rem");
    expect(READ_PASSAGE_COLUMNS_CLASS).not.toContain("520px");
  });

  it("restores the wide compose 440px notes cap and still lets notes shrink first", () => {
    expect(COMPOSE_PASSAGE_COLUMNS_CLASS).toBe(
      "grid-cols-[minmax(24rem,1.1fr)_minmax(17.5rem,440px)] gap-5",
    );
    expect(passageColumnsClass(false)).toBe(COMPOSE_PASSAGE_COLUMNS_CLASS);
    expect(COMPOSE_PASSAGE_COLUMNS_CLASS).toContain("440px");
    expect(COMPOSE_PASSAGE_COLUMNS_CLASS).toContain("17.5rem");
    expect(COMPOSE_PASSAGE_COLUMNS_CLASS).not.toContain("2.5fr");
    expect(COMPOSE_PASSAGE_COLUMNS_CLASS).not.toContain("360px");
  });
});
