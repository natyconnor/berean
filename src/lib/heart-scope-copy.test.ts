import { describe, expect, it } from "vitest";

import {
  heartScopeActionLabel,
  heartScopeConfirmLabel,
  heartScopeCoverageCopy,
  heartScopeDialogTitle,
  heartScopeHasExisting,
  heartScopeHintCopy,
  heartScopeProposedLabel,
  heartScopeTooltip,
} from "./heart-scope-copy";

describe("heartScopeActionLabel", () => {
  it("says Heart all verses when nothing in the scope is hearted", () => {
    expect(heartScopeHasExisting(0)).toBe(false);
    expect(heartScopeActionLabel(false)).toBe("Heart all verses");
    expect(heartScopeDialogTitle(false)).toBe("Heart all verses");
  });

  it("says Heart remaining once some verses are already hearted", () => {
    expect(heartScopeHasExisting(2)).toBe(true);
    expect(heartScopeActionLabel(true)).toBe("Heart remaining");
    expect(heartScopeDialogTitle(true)).toBe("Heart remaining verses");
  });
});

describe("heartScopeCoverageCopy", () => {
  it("names an empty scope", () => {
    expect(heartScopeCoverageCopy(0, 0)).toBe(
      "This scope has no verses to heart.",
    );
  });

  it("says none are hearted yet", () => {
    expect(heartScopeCoverageCopy(0, 6)).toBe(
      "None of these 6 verses are hearted yet. If you want to memorize the whole chapter (or all the chapters) together, we can auto-heart them as short memory units so you can start learning.",
    );
  });

  it("counts a partial fill", () => {
    expect(heartScopeCoverageCopy(2, 6)).toBe(
      "2 of 6 verses are already hearted. If you want to memorize the rest of this chapter (or these chapters) together, we can auto-heart the remaining verses as short memory units so you can start learning.",
    );
  });

  it("names a complete fill", () => {
    expect(heartScopeCoverageCopy(6, 6)).toBe(
      "All 6 verses are already hearted.",
    );
  });
});

describe("heartScopeTooltip", () => {
  it("explains all vs remaining", () => {
    expect(heartScopeTooltip(false)).toMatch(/every verse/i);
    expect(heartScopeTooltip(true)).toMatch(/rest of this scope/i);
  });
});

describe("heartScopeHintCopy", () => {
  it("points at Heart all vs Heart remaining", () => {
    expect(heartScopeHintCopy(false)).toMatch(
      /Heart all verses fills this pack/,
    );
    expect(heartScopeHintCopy(true)).toMatch(
      /Heart remaining fills in the rest/,
    );
  });
});

describe("heartScopeConfirmLabel", () => {
  it("names new passages, not units", () => {
    expect(heartScopeProposedLabel(1)).toBe("1 new passage");
    expect(heartScopeProposedLabel(4)).toBe("4 new passages");
    expect(heartScopeConfirmLabel(4)).toBe("Heart 4 new passages");
  });
});
