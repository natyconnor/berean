import { localDayIndex } from "@/lib/passage-frontier";

/**
 * Packs the learner set aside from global Learn for the current local day.
 *
 * A building pack stays in `dueForLearning` while it still has unstarted
 * verses and introduce budget, which is exactly when "That's enough for
 * today" appears. Remembering the dismissal here lets the next visit open
 * the following pack, or the single-verse session, instead of the same
 * prompt. A missing pack uses the same record so Back cannot offer it again.
 */
const LEARN_DISMISSED_PACKS_KEY = "berean:learn-dismissed-packs";

type DismissedPacksRecord = {
  day: number;
  packIds: string[];
};

export function learnDismissDayKey(now: number): number {
  return localDayIndex(now, new Date(now).getTimezoneOffset());
}

export function readLearnPacksDismissedToday(dayKey: number): Set<string> {
  const stored = readRecord();
  if (!stored || stored.day !== dayKey) return new Set();
  return new Set(stored.packIds);
}

export function dismissLearnPackForToday(packId: string, dayKey: number): void {
  const packIds = readLearnPacksDismissedToday(dayKey);
  packIds.add(packId);
  writeRecord({ day: dayKey, packIds: [...packIds] });
}

function readRecord(): DismissedPacksRecord | null {
  try {
    const raw = sessionStorage.getItem(LEARN_DISMISSED_PACKS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    const day = (parsed as { day?: unknown }).day;
    const packIds = (parsed as { packIds?: unknown }).packIds;
    if (typeof day !== "number" || !Array.isArray(packIds)) return null;
    return {
      day,
      packIds: packIds.filter((id): id is string => typeof id === "string"),
    };
  } catch {
    return null;
  }
}

function writeRecord(record: DismissedPacksRecord): void {
  try {
    sessionStorage.setItem(LEARN_DISMISSED_PACKS_KEY, JSON.stringify(record));
  } catch {
    // Ignore quota and private-mode failures. This visit still exits.
  }
}
