import {
  formatDueDay,
  nextStepCopy,
  type NextStepSchedule,
} from "./memorize-plan";
import { statusLabel } from "./memory-copy";
import type { PassageHeartInfo } from "./passage-heart-info";

/** How memorizing reads on a reader heart, in place of "Heart" / "Unheart". */
export interface HeartMemoryCopy {
  /** "Memorizing · Day 2 of 3: fill in the blanks". */
  tooltip: string;
  /** Appended to the heart's accessible name: "(memorizing, Day 2 of 3: …)". */
  ariaSuffix: string;
}

function heartCopy(state: string, detail?: string): HeartMemoryCopy {
  return detail
    ? {
        tooltip: `${state} · ${detail}`,
        ariaSuffix: `(${state.toLowerCase()}, ${detail})`,
      }
    : { tooltip: state, ariaSuffix: `(${state.toLowerCase()})` };
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
        tooltip: `${title} · memorized · recite again ${day}`,
        ariaLabel: `${title}, hearted. Memorized: recite again ${day}. Remove heart`,
      };
    }
    case "mastered":
      return {
        tooltip: `${title} · mastered`,
        ariaLabel: `${title}, hearted. Mastered. Remove heart`,
      };
  }
}
