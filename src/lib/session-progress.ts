export interface SessionProgress {
  /** Text beside the bar naming what it measures, e.g. "Today · 4 of 12". */
  label: string;
  /** Share of the whole session behind the learner, 0 to 1. */
  fraction: number;
}

/** How far one run (a verse board) is through its own queue. */
export interface SessionRunProgress {
  done: number;
  total: number;
}

/**
 * Header progress for a run inside a longer session: fixed, or worked out
 * from the run's own position so the bar moves verse by verse.
 */
export type SessionProgressSource =
  SessionProgress | ((run: SessionRunProgress) => SessionProgress);

export function resolveSessionProgress(
  source: SessionProgressSource | undefined,
  run: SessionRunProgress,
): SessionProgress | undefined {
  return typeof source === "function" ? source(run) : source;
}
