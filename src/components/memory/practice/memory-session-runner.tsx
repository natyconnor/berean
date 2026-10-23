import { type JSX, type ReactNode, useState } from "react";

import {
  PracticeBoard,
  type PracticeRunState,
  type PracticeSessionResult,
  type PracticeVerse,
} from "@/components/memory/practice/practice-board";
import type { SessionProgressSource } from "@/lib/session-progress";
import type { MemorySessionKind } from "@/lib/memory-session";
import type { PracticeOrder } from "@/lib/practice-order";

interface MemorySessionRunnerProps {
  kind: MemorySessionKind;
  /** Live session queue; only its value at mount is used. */
  verses: ReadonlyArray<PracticeVerse>;
  scopeLabel: string;
  onExit: () => void;
  /** Header back button text, e.g. "Back to Memory". */
  backLabel?: string;
  /** Where Back goes. Home shows when this is not `/memory`. */
  exitHref?: string;
  /** The summary's primary action. */
  exitLabel?: string;
  /** Where the session returns; Extra practice returns there too. */
  returnTo?: string;
  /** Something is memorized, so the summary can offer Extra practice. */
  hasMemorized?: boolean;
  /** Verses still due after this run (Review summary only). */
  remainingDue?: number;
  /** Restart the review queue when more verses are still due. */
  onContinueSession?: () => void;
  /** Header text and overall bar when this run is one part of a session. */
  progress?: SessionProgressSource;
  /** One part of a longer session: hand the results up instead of a summary. */
  onComplete?: (result: PracticeSessionResult) => void;
  /** Shown above the verse rail, e.g. an overview of the whole session. */
  railHeader?: ReactNode;
  /** Replaces the board's own sidebar. */
  rail?:
    | ReactNode
    | ((api: { changeOrder: (order: PracticeOrder) => void }) => ReactNode);
  /** Card id to open first; the first card in order when absent. */
  initialVerseId?: string;
  /** The card now on screen, after a rail pick, Next, or Shuffle. */
  onCurrentVerseId?: (id: string) => void;
  /** When set, this run reads card order from the session instead of its own. */
  orderedIds?: readonly string[];
  /** When set, this is the card on screen. */
  shownId?: string;
  /** Ask the session to show another card from the shared list. */
  onShow?: (id: string) => void;
  /** Ask the session to reshuffle or restore Scripture order. */
  onSessionOrderChange?: (order: PracticeOrder) => void;
  /** Pick a run back up where it was left. Read once, at mount. */
  runState?: PracticeRunState;
  /** Every change to the run's state, with the results so far. */
  onRunStateChange?: (
    state: PracticeRunState,
    result: PracticeSessionResult,
  ) => void;
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
