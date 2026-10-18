import { useQuery } from "convex-helpers/react/cache";
import type { FunctionReturnType } from "convex/server";

import { api } from "../../convex/_generated/api";
import {
  learnDismissDayKey,
  readLearnPacksDismissedToday,
} from "@/lib/learn-dismissed-packs";
import { applyTodayDismissals } from "@/lib/memory-today";
import { getViewerTimeZone } from "@/lib/viewer-timezone";

export type TodayModelResult = FunctionReturnType<typeof api.memoryHome.today>;
export type TodayGoal = TodayModelResult["goals"][number];

/** `memoryHome.today` for the viewer's local day; `undefined` while loading. */
export function useTodayModel(now: number): TodayModelResult | undefined {
  const raw = useQuery(api.memoryHome.today, {
    now,
    tzOffsetMinutes: new Date(now).getTimezoneOffset(),
    timeZone: getViewerTimeZone(),
  });
  if (raw === undefined) return undefined;
  return applyTodayDismissals(
    raw,
    readLearnPacksDismissedToday(learnDismissDayKey(now)),
  );
}
