import type { MemoryStatus } from "./memory-scheduler";

export type MemorizeSpanResult = "added" | "resumed" | "promoted" | "already";

export type MemorizeTransition = {
  result: MemorizeSpanResult;
  /** Status after memorizing. Moving from `new` to `learning` also makes it due now. */
  status: MemoryStatus;
  /**
   * Where the verse was in the in-Memory stats before: `null` when it was not
   * in Memory. Equal to `status` when nothing changes.
   */
  statsFrom: MemoryStatus | null;
};

/**
 * What memorizing a span does to its `verseMemory` row.
 *
 * - No row: added as `learning`, or `new` (Up next) when `upNext`.
 * - Not in Memory: resumed with its schedule; `new` starts learning unless
 *   `upNext`.
 * - In Memory as `new` and not `upNext`: promoted to `learning`.
 * - Otherwise: already memorizing, nothing changes.
 */
export function planMemorizeTransition(
  existing: { status: MemoryStatus; inMemory?: boolean } | null,
  upNext: boolean,
): MemorizeTransition {
  if (!existing) {
    return {
      result: "added",
      status: upNext ? "new" : "learning",
      statsFrom: null,
    };
  }

  const startLearning = existing.status === "new" && !upNext;
  const status = startLearning ? "learning" : existing.status;

  if (existing.inMemory !== true) {
    return { result: "resumed", status, statsFrom: null };
  }
  if (startLearning) {
    return { result: "promoted", status, statsFrom: "new" };
  }
  return { result: "already", status, statsFrom: status };
}
