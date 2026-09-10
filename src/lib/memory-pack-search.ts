export type MemoryPackSearch = {
  /** Legacy / ineligible-scope create: point at auto-heart on the pack page. */
  heartHint?: boolean;
  /** One-shot builder shortcut: start passage mode once after create. */
  startPassage?: boolean;
};

function isTruthySearchFlag(value: unknown): boolean {
  return value === true || value === 1 || value === "1" || value === "true";
}

/**
 * Pack-page search. Eligible create uses optional `startPassage` instead of
 * auto-heart. `heartHint` is still parsed for old links and ineligible scopes.
 */
export function validateMemoryPackSearch(
  search: Record<string, unknown>,
): MemoryPackSearch {
  const next: MemoryPackSearch = {};
  if (isTruthySearchFlag(search.heartHint)) {
    next.heartHint = true;
  }
  if (isTruthySearchFlag(search.startPassage)) {
    next.startPassage = true;
  }
  return next;
}

/**
 * Search to land on after creating a pack. Eligible scopes stay collections
 * (`{}`) unless the optional start shortcut is used. Ineligible scopes keep
 * the auto-heart pointer.
 */
export function memoryPackSearchAfterCreate(args: {
  kind: "scope" | "custom";
  allowsPassage: boolean;
  startPassage?: boolean;
}): MemoryPackSearch {
  if (args.kind !== "scope") return {};
  if (args.allowsPassage) {
    return args.startPassage === true ? { startPassage: true } : {};
  }
  return { heartHint: true };
}
