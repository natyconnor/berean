import { type JSX, type ReactNode, useState } from "react";

import {
  PracticeBoard,
  type PracticeVerse,
} from "@/components/memory/practice/practice-board";
import type { MemorySessionKind } from "@/lib/memory-session";

interface MemorySessionRunnerProps {
  kind: MemorySessionKind;
  /** Live session queue; only its value at mount is used. */
  verses: ReadonlyArray<PracticeVerse>;
  scopeLabel: string;
  onExit: () => void;
  exitTooltip?: string;
  exitLabel?: string;
  /** Verses still due after this run (Review summary only). */
  remainingDue?: number;
  /** Restart the review queue when more verses are still due. */
  onContinueSession?: () => void;
  /** Shown when the session had nothing to run in the first place. */
  emptyState: ReactNode;
}

/**
 * Freezes a session's verse queue at mount.
 *
 * Both queues are derived from live Convex queries, so a verse drops out the
 * moment its attempt lands — a soft-locked learning verse, or one that just
 * graduated. Rendering straight from that list would tear the board down
 * mid-session and swap the result the learner just earned for the "nothing to
 * do" page. The board tracks its own completion instead, so the caller must
 * only decide whether there was work to begin with.
 *
 * Mount this after the underlying query resolves; an empty queue at mount is
 * treated as an empty session.
 */
export function MemorySessionRunner({
  verses,
  emptyState,
  ...boardProps
}: MemorySessionRunnerProps): JSX.Element {
  const [sessionVerses] = useState(verses);

  if (sessionVerses.length === 0) return <>{emptyState}</>;

  return <PracticeBoard verses={sessionVerses} {...boardProps} />;
}
