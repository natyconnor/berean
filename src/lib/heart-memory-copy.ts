import {
  formatDueDay,
  nextStepCopy,
  type NextStepSchedule,
} from "./memorize-plan";
import { statusLabel } from "./memory-copy";
import type { PassageHeartInfo } from "./passage-heart-info";

/** How memorizing reads on a reader heart, in place of "Heart Verse" / "Unheart". */
export interface HeartMemoryCopy {
  /** "Memorizing · Fill in the blanks". NBSP before · so a wrap never starts with it. */
  tooltip: string;
  /** Full accessible name: "Memorizing: Fill in the blanks. Unheart". */
  ariaLabel: string;
}

export interface VerseHeartLabels {
  tooltip: string;
  ariaLabel: string;
}

function heartCopy(state: string, detail?: string): HeartMemoryCopy {
  return detail
    ? {
        tooltip: `${state}\u00A0· ${detail}`,
        ariaLabel: `${state}: ${detail}. Unheart`,
      }
    : { tooltip: state, ariaLabel: `${state}. Unheart` };
}

/** Visible tooltip and accessible name for a per-verse heart. */
export function verseHeartLabels(
  filled: boolean,
  offerChoices: boolean,
  memoryCopy?: HeartMemoryCopy,
): VerseHeartLabels {
  if (memoryCopy) return memoryCopy;
  if (!filled) return { tooltip: "Heart Verse", ariaLabel: "Heart Verse" };
  if (offerChoices) {
    return { tooltip: "Memorize or unheart", ariaLabel: "Memorize or unheart" };
  }
  return { tooltip: "Unheart", ariaLabel: "Unheart" };
}

/** Tooltip and accessible-name detail for the heart of a verse in Memory. */
export function verseHeartMemoryCopy(
  schedule: NextStepSchedule,
  now: number,
  timeZone?: string,
): HeartMemoryCopy {
  switch (schedule.status) {
    case "mastered":
      return heartCopy(statusLabel("mastered"));
    case "reviewing": {
      const day = formatDueDay(schedule.dueAt, now, timeZone);
      return heartCopy(
        statusLabel("reviewing"),
        day === "today" ? "review due today" : `next review ${day}`,
      );
    }
    case "new":
    case "learning":
      return heartCopy("Memorizing", nextStepCopy(schedule, now, timeZone));
  }
}

export interface PassageHeartCopy {
  /** "Psalm 16 · memorizing · 4 of 11 learned". */
  tooltip: string;
  /** "Psalm 16, hearted. Memorizing: 4 of 11 verses learned. Remove heart". */
  ariaLabel: string;
}

/** Tooltip and accessible name for a memorized passage's one heart. */
export function passageHeartCopy(
  passage: Pick<
    PassageHeartInfo,
    "title" | "status" | "learnedVerses" | "totalVerses" | "dueAt"
  >,
  now: number,
  timeZone?: string,
): PassageHeartCopy {
  const { title } = passage;
  switch (passage.status) {
    case "building": {
      const learned = `${passage.learnedVerses} of ${passage.totalVerses}`;
      return {
        tooltip: `${title} · memorizing · ${learned} learned`,
        ariaLabel: `${title}, hearted. Memorizing: ${learned} verses learned. Remove heart`,
      };
    }
    case "reviewing": {
      const day = formatDueDay(passage.dueAt, now, timeZone);
      return {
        tooltip: `${title} · memorized · next review ${day}`,
        ariaLabel: `${title}, hearted. Memorized: next review ${day}. Remove heart`,
      };
    }
    case "mastered":
      return {
        tooltip: `${title} · mastered`,
        ariaLabel: `${title}, hearted. Mastered. Remove heart`,
      };
  }
}
