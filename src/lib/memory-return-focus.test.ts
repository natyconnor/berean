import { afterEach, describe, expect, it } from "vitest";

import {
  markMemoryReturnFocus,
  takeMemoryReturnFocus,
} from "./memory-return-focus";

afterEach(() => {
  sessionStorage.clear();
});

describe("memory return focus", () => {
  it("hands focus intent to the next page once", () => {
    expect(takeMemoryReturnFocus()).toBe(false);
    markMemoryReturnFocus();
    expect(takeMemoryReturnFocus()).toBe(true);
    expect(takeMemoryReturnFocus()).toBe(false);
  });
});
