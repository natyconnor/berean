/**
 * How "What you're memorizing" fits the Today page, from the page's own
 * width:
 * - `rail`: every goal as a card, two columns, beside a pinned Start
 *   something new.
 * - `grid`: two rows of cards, then the rest as one-line rows.
 * - `shelf`: one row of cards that scrolls sideways.
 */
export type GoalLayout =
  { kind: "rail" } | { kind: "grid"; columns: 2 | 3 } | { kind: "shelf" };

/** Two goal columns plus the rail fit from here. */
const RAIL_MIN_WIDTH = 1120;
/** Three goal columns fit from here. */
const THREE_COLUMN_MIN_WIDTH = 1000;
/** Below this, cards get too narrow for a grid and scroll sideways instead. */
const GRID_MIN_WIDTH = 860;

export function goalLayoutFor(width: number): GoalLayout {
  if (width >= RAIL_MIN_WIDTH) return { kind: "rail" };
  if (width >= GRID_MIN_WIDTH) {
    return { kind: "grid", columns: width >= THREE_COLUMN_MIN_WIDTH ? 3 : 2 };
  }
  return { kind: "shelf" };
}
