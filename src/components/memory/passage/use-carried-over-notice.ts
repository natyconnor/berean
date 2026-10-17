import { useEffect, useState } from "react";

import { carriedOverSessionNotice } from "@/lib/carried-over-copy";
import type { PassagePiece } from "@/lib/passage-pieces";

/**
 * Passages that have shown their carried-over notice on this device. It
 * shows through the first session that has one, then not again, so a
 * learner who never dismisses it isn't told twice.
 */
export const CARRIED_OVER_SEEN_KEY_PREFIX = "berean:carried-over-seen:";

function seenKey(passageId: string): string {
  return `${CARRIED_OVER_SEEN_KEY_PREFIX}${passageId}`;
}

function hasSeen(passageId: string): boolean {
  try {
    return localStorage.getItem(seenKey(passageId)) === "1";
  } catch {
    return false;
  }
}

function markSeen(passageId: string): void {
  try {
    localStorage.setItem(seenKey(passageId), "1");
  } catch {
    // Ignore quota and private-mode failures; it may show again next time.
  }
}

/**
 * The building session's one-line note about pieces a passage kept from
 * verses memorized on their own (see `carriedOverSessionNotice`), or `null`.
 * Decided once when the session opens; dismissing hides it for the rest.
 */
export function useCarriedOverNotice(
  passageId: string,
  pieces: readonly PassagePiece[],
  building: boolean,
): { notice: string | null; dismiss: () => void } {
  const [open, setOpen] = useState(
    () =>
      building &&
      carriedOverSessionNotice(pieces) !== null &&
      !hasSeen(passageId),
  );

  useEffect(() => {
    if (open) markSeen(passageId);
  }, [open, passageId]);

  const notice = open && building ? carriedOverSessionNotice(pieces) : null;
  return { notice, dismiss: () => setOpen(false) };
}
