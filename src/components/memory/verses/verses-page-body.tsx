import { useNavigate } from "@tanstack/react-router";

import { useMemoryPanelFrame } from "@/components/memory/drawer/memory-panel-context";
import { MemoryLibrary } from "@/components/memory/memory-library";
import { PackList } from "@/components/memory/packs/pack-list";
import type { PracticeVerse } from "@/components/memory/practice/practice-board";
import { useLiveNow } from "@/hooks/use-live-now";
import { withReturn } from "@/lib/memory-return";
import {
  memoryVerseSessionHref,
  type MemorySessionKind,
} from "@/lib/memory-session-path";

/**
 * The full Your verses page: every verse with its filters beside Passages and
 * packs (one column on small screens). Sessions return here.
 */
export function VersesPageBody() {
  const now = useLiveNow();
  const navigate = useNavigate();
  const frame = useMemoryPanelFrame();

  const startSession = (kind: MemorySessionKind) => (verse: PracticeVerse) => {
    void navigate({
      href: withReturn(
        memoryVerseSessionHref(kind, verse.reference),
        frame.returnTo,
      ),
    });
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] lg:items-start lg:gap-6">
      <MemoryLibrary
        now={now}
        onOpenVerse={(verseRefId) => {
          void navigate({
            href: frame.hrefFor(
              { kind: "verse", verseRefId },
              { from: "verses" },
            ),
          });
        }}
        onLearnVerse={startSession("learn")}
        onReviewVerse={startSession("review")}
        onPracticeVerse={startSession("practice")}
      />
      <PackList now={now} title="Passages and packs" />
    </div>
  );
}
