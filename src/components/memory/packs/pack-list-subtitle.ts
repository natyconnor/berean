export type PackListRow = {
  kind: "scope" | "custom";
  verseCount: number;
  dueCount: number;
  unifiedReviewEnabled?: boolean;
  passageStatus?: "building" | "reviewing" | "mastered";
  solidCount?: number;
  attachedCount?: number;
  pieceCount?: number;
};

/** Home pack-row subtitle. Passage packs show rope progress, not heart counts. */
export function packListSubtitle(pack: PackListRow): string {
  if (pack.passageStatus) {
    const solid = pack.solidCount ?? 0;
    const attached = pack.attachedCount ?? 0;
    const pieces = pack.pieceCount ?? 0;
    const due = pack.dueCount > 0 ? " · one recitation due" : "";
    return `Passage · ${solid} solid · ${attached} on rope · ${pieces} piece${pieces === 1 ? "" : "s"}${due}`;
  }
  const kindLabel = pack.kind === "scope" ? "Scope" : "Custom";
  const verses = `${pack.verseCount} verse${pack.verseCount !== 1 ? "s" : ""}`;
  const due =
    pack.dueCount === 0
      ? ""
      : pack.unifiedReviewEnabled
        ? " · one recitation due"
        : ` · ${pack.dueCount} due`;
  return `${kindLabel} · ${verses}${due}`;
}
