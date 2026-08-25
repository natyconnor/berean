import { describe, expect, it } from "vitest";

import {
  HEART_SCOPE_ACTION_LABEL,
  HEART_SCOPE_TOOLTIP,
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
  it("is Memorize whole passage whether some verses are already hearted or not", () => {
    expect(heartScopeHasExisting(0)).toBe(false);
    expect(heartScopeHasExisting(2)).toBe(true);
    expect(heartScopeActionLabel()).toBe(HEART_SCOPE_ACTION_LABEL);
    expect(heartScopeDialogTitle()).toBe("Memorize whole passage");
  });
});

describe("heartScopeCoverageCopy", () => {
  it("names an empty scope", () => {
    expect(heartScopeCoverageCopy(0, 0, 1)).toBe(
      "This scope has no verses to heart.",
    );
  });

  it("says none are hearted yet in a single chapter", () => {
    expect(heartScopeCoverageCopy(0, 6, 1)).toBe(
      "None of these 6 verses are hearted yet. If you want to memorize the whole chapter together, we can auto-heart them as short memory passages so you can start learning.",
    );
  });

  it("says none are hearted yet across several chapters", () => {
    expect(heartScopeCoverageCopy(0, 50, 3)).toBe(
      "None of these 50 verses are hearted yet. If you want to memorize these chapters together, we can auto-heart them as short memory passages so you can start learning.",
    );
  });

  it("counts a partial fill in a single chapter", () => {
    expect(heartScopeCoverageCopy(1, 31, 1)).toBe(
      "1 of 31 verses is already hearted. If you want to memorize the rest of this chapter together, we can auto-heart the remaining verses as short memory passages so you can start learning.",
    );
  });

  it("counts a partial fill across several chapters", () => {
    expect(heartScopeCoverageCopy(2, 50, 3)).toBe(
      "2 of 50 verses are already hearted. If you want to memorize the rest of these chapters together, we can auto-heart the remaining verses as short memory passages so you can start learning.",
    );
  });

  it("names a complete fill", () => {
    expect(heartScopeCoverageCopy(6, 6, 1)).toBe(
      "All 6 verses are already hearted.",
    );
  });
});

describe("heartScopeTooltip", () => {
  it("invites auto-hearting the whole passage", () => {
    expect(heartScopeTooltip()).toBe(HEART_SCOPE_TOOLTIP);
    expect(heartScopeHintCopy()).toBe(HEART_SCOPE_TOOLTIP);
  });
});

describe("heartScopeConfirmLabel", () => {
  it("names new passages, not units", () => {
    expect(heartScopeProposedLabel(1)).toBe("1 new passage");
    expect(heartScopeProposedLabel(4)).toBe("4 new passages");
    expect(heartScopeConfirmLabel(4)).toBe("Heart 4 new passages");
  });
});
