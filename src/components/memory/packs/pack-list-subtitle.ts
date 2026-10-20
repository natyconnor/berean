import { calendarDaysBetween, formatDueDay } from "@/lib/memorize-plan";
import type { PackListSummary } from "@/lib/pack-list-summary";

function percent(fraction: number): number {
  return Math.round(Math.min(Math.max(fraction, 0), 1) * 100);
}

/**
 * The line under a passage or pack in "Passages and packs". Learning and
 * mastery are always separate facts, never one number.
 */
export function packListSubtitle(
  summary: PackListSummary,
  now: number,
  timeZone?: string,
): string {
  if (summary.kind === "pack") {
    if (summary.verseCount === 0) return "No verses yet";
    const today = summary.today > 0 ? ` · ${summary.today} today` : "";
    return `${summary.learned} of ${summary.verseCount} learned · ${summary.mastered} mastered${today}`;
  }

  switch (summary.status) {
    case "mastered":
      return "Mastered";
    case "reviewing":
      if (summary.hasWorkToday || summary.nextDueAt === null) {
        return "Memorized · review today";
      }
      return `Memorized · next review ${formatDueDay(
        summary.nextDueAt,
        now,
        timeZone,
      )} · mastery ${percent(summary.masteryFraction)}%`;
    case "building": {
      const noun = summary.verseCount === 1 ? "verse" : "verses";
      const base = `Learning · ${summary.learnedVerses} of ${summary.verseCount} ${noun} learned`;
      if (summary.hasWorkToday) return `${base} · today`;
      if (
        summary.nextDueAt !== null &&
        calendarDaysBetween(now, summary.nextDueAt, timeZone) === 1
      ) {
        return `${base} · more tomorrow`;
      }
      return base;
    }
  }
}
