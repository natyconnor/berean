import { useQuery } from "convex-helpers/react/cache";
import type { FunctionReturnType } from "convex/server";

import { api } from "../../convex/_generated/api";
import { getViewerTimeZone } from "@/lib/viewer-timezone";

export type TodayModelResult = FunctionReturnType<typeof api.memoryHome.today>;
export type TodayGoal = TodayModelResult["goals"][number];

/** `memoryHome.today` for the viewer's local day; `undefined` while loading. */
export function useTodayModel(now: number): TodayModelResult | undefined {
  return useQuery(api.memoryHome.today, {
    now,
    tzOffsetMinutes: new Date(now).getTimezoneOffset(),
    timeZone: getViewerTimeZone(),
  });
}
