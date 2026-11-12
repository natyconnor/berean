import { useMemo, useSyncExternalStore } from "react";

import {
  learnDismissDayKey,
  readLearnPacksDismissedToday,
  subscribeLearnPackDismissals,
} from "@/lib/learn-dismissed-packs";

/**
 * Pack ids set aside with "That's enough for today" on `now`'s local day,
 * sorted so query args stay stable; `undefined` when there are none. Updates
 * when a pack is set aside, and resets when `now` moves to a new day.
 */
export function useLearnPacksDismissedToday(now: number): string[] | undefined {
  const dayKey = learnDismissDayKey(now);
  const snapshot = useSyncExternalStore(subscribeLearnPackDismissals, () =>
    [...readLearnPacksDismissedToday(dayKey)].sort().join(","),
  );
  return useMemo(
    () => (snapshot === "" ? undefined : snapshot.split(",")),
    [snapshot],
  );
}
