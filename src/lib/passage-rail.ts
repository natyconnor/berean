import type {
  PassageHeartProgress,
  PassageVerseState,
} from "./passage-heart-info";

/**
 * How one verse's stretch of a passage rail is drawn in the reader's gutter:
 * solid = memorized, dashed = learning (or today's step), faint = up next.
 */
export type RailStroke = "solid" | "dashed" | "faint";

const STROKE_BY_STATE: Record<PassageVerseState, RailStroke> = {
  memorized: "solid",
  learning: "dashed",
  upNext: "faint",
};

/** One verse's stretch of the rail. Segments break at every verse boundary. */
export interface RailSegment {
  verse: number;
  stroke: RailStroke;
  /** The previous verse is on the rail too, so the rail runs in from above. */
  joinsAbove: boolean;
  /** The passage heart sits level with this verse (first verse, first chapter). */
  heart: boolean;
}

/**
 * The rail for one chapter of a passage, one segment per verse in verse
 * order. A passage that spans chapters shows a slice in each, with the heart
 * only where it starts.
 */
export function passageRailSegments(
  progress: Pick<PassageHeartProgress, "verseStates" | "isFirstChapter">,
): RailSegment[] {
  const states = [...progress.verseStates].sort((a, b) => a.verse - b.verse);
  return states.map(({ verse, state }, index) => ({
    verse,
    stroke: STROKE_BY_STATE[state],
    joinsAbove: index > 0 && states[index - 1]?.verse === verse - 1,
    heart: progress.isFirstChapter && index === 0,
  }));
}
