import { localDayIndex } from "@/lib/passage-frontier";

/**
 * Packs the learner set aside from global Learn for the current local day.
 *
 * A building pack stays in `dueForLearning` while it still has unstarted
 * verses and introduce budget, which is exactly when "That's enough for
 * today" appears. The record lives in localStorage, keyed by the local day,
 * so a new tab or a browser restart still skips those packs until the day
 * changes. A previous day's entry is removed on the next read. A missing
 * pack uses the same record so Back cannot offer it again.
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
  if (!stored) return new Set();
  if (stored.day !== dayKey) {
    clearRecord();
    return new Set();
  }
  return new Set(stored.packIds);
}

export function dismissLearnPackForToday(packId: string, dayKey: number): void {
  const packIds = readLearnPacksDismissedToday(dayKey);
  packIds.add(packId);
  writeRecord({ day: dayKey, packIds: [...packIds] });
}

function localStore(): Storage | null {
  try {
    if (typeof localStorage === "undefined") return null;
    return localStorage;
  } catch {
    return null;
  }
}

function readRecord(): DismissedPacksRecord | null {
  const store = localStore();
  if (!store) return null;
  try {
    const raw = store.getItem(LEARN_DISMISSED_PACKS_KEY);
    if (!raw) return null;
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw) as unknown;
    } catch {
      clearRecord();
      return null;
    }
    const record = toDismissedPacksRecord(parsed);
    if (!record) {
      clearRecord();
      return null;
    }
    return record;
  } catch {
    return null;
  }
}

function toDismissedPacksRecord(value: unknown): DismissedPacksRecord | null {
  if (!value || typeof value !== "object") return null;
  const day = (value as { day?: unknown }).day;
  const packIds = (value as { packIds?: unknown }).packIds;
  if (typeof day !== "number" || !Array.isArray(packIds)) return null;
  return {
    day,
    packIds: packIds.filter((id): id is string => typeof id === "string"),
  };
}

function writeRecord(record: DismissedPacksRecord): void {
  try {
    localStore()?.setItem(LEARN_DISMISSED_PACKS_KEY, JSON.stringify(record));
  } catch {
    // Ignore quota and private-mode failures. This visit still exits.
  }
}

function clearRecord(): void {
  try {
    localStore()?.removeItem(LEARN_DISMISSED_PACKS_KEY);
  } catch {
    // localStorage unavailable
  }
}
