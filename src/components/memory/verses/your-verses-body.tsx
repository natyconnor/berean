import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Search } from "lucide-react";

import { useMemoryPanelFrame } from "@/components/memory/drawer/memory-panel-context";
import { MemoryLibrary } from "@/components/memory/memory-library";
import type { PracticeVerse } from "@/components/memory/practice/practice-board";
import { Input } from "@/components/ui/input";
import { useLiveNow } from "@/hooks/use-live-now";
import { useTodayModel } from "@/hooks/use-today-model";
import { withReturn } from "@/lib/memory-return";
import {
  memoryVerseSessionHref,
  type MemorySessionKind,
} from "@/lib/memory-session-path";
import { getViewerTimeZone } from "@/lib/viewer-timezone";

import { GoalCollection } from "./goal-collection";
import { LibraryOverview } from "./library-overview";

const SEARCH_LABEL = "Search your verses, passages and packs";

/**
 * Your verses, in the drawer and on its page: an overview of every verse by
 * status, one search, every passage and pack as a row, then the Library with
 * every verse. Any row can start a session, due or not. The page adds the
 * passage and pack filters and sort. Sessions return to where this is shown.
 */
export function YourVersesBody({ controls }: { controls: boolean }) {
  const now = useLiveNow();
  const timeZone = getViewerTimeZone();
  const today = useTodayModel(now);
  const navigate = useNavigate();
  const frame = useMemoryPanelFrame();
  const [query, setQuery] = useState("");

  if (today === undefined) return <YourVersesSkeleton />;
  if (today.state === "firstRun") {
    return (
      <div className="rounded-xl border border-dashed bg-card/50 px-6 py-12 text-center">
        <p className="text-sm text-muted-foreground">
          Nothing here yet. What you memorize shows up here.
        </p>
      </div>
    );
  }

  const startSession = (kind: MemorySessionKind) => (verse: PracticeVerse) => {
    void navigate({
      href: withReturn(
        memoryVerseSessionHref(kind, verse.reference),
        frame.returnTo,
      ),
    });
  };

  return (
    <div className="@container space-y-6">
      <LibraryOverview today={today} />
      <div className="relative">
        <Search
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={`${SEARCH_LABEL}…`}
          aria-label={SEARCH_LABEL}
          className="h-10 pl-9"
        />
      </div>
      <GoalCollection
        today={today}
        now={now}
        timeZone={timeZone}
        query={query}
        controls={controls}
      />
      <MemoryLibrary
        now={now}
        returnTo={frame.returnTo}
        search={query}
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
    </div>
  );
}

function YourVersesSkeleton() {
  return (
    <div
      className="space-y-6"
      aria-busy="true"
      aria-label="Loading your verses"
    >
      <div className="h-20 animate-pulse rounded-xl bg-muted" aria-hidden />
      <div className="h-10 animate-pulse rounded-md bg-muted" aria-hidden />
      <div className="space-y-1.5" aria-hidden>
        {[0, 1, 2, 3].map((key) => (
          <div key={key} className="h-14 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
    </div>
  );
}
