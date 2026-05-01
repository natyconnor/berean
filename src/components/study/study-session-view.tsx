import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, SearchX } from "lucide-react";
import { useQuery } from "convex-helpers/react/cache";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatScopeSummary } from "./study-scope-summary";
import {
  countDistinctTeachPassageRefs,
  type ActivityType,
} from "./study-card-model";
import { StudyActivitySwitcher } from "./study-activity-switcher";
import {
  buildActivityOptions,
  type SessionView,
} from "./study-activity-options";
import { StudySessionOverview } from "./study-session-overview";
import { StudySessionActivityView } from "./study-session-activity-view";

interface StudySessionViewProps {
  sessionId: string;
}

const DEFAULT_VIEW: SessionView = "overview";
const ACTIVITY_TYPES: ActivityType[] = ["verse-memory", "teach"];

function normalizeSessionView(
  value: string | undefined,
): SessionView | undefined {
  if (!value) return undefined;
  // Backwards-compatible: sessions persisted before the rename used "explain".
  if (value === "explain") return "teach";
  if (value === "mixed-review") return "verse-memory";
  if (value === "overview" || ACTIVITY_TYPES.includes(value as ActivityType)) {
    return value as SessionView;
  }
  return undefined;
}

export function StudySessionView({ sessionId }: StudySessionViewProps) {
  const session = useQuery(api.studySessions.get, {
    id: sessionId as Id<"studySessions">,
  });
  const resolved = useQuery(api.studySessions.resolveScope, {
    id: sessionId as Id<"studySessions">,
  });
  const touchSession = useMutation(api.studySessions.touch);

  const hasTouched = useRef(false);
  useEffect(() => {
    if (session && !hasTouched.current) {
      hasTouched.current = true;
      void touchSession({ id: sessionId as Id<"studySessions"> });
    }
  }, [session, sessionId, touchSession]);

  const [view, setView] = useState<SessionView>(DEFAULT_VIEW);
  const [didInitFromSession, setDidInitFromSession] = useState(false);

  // When the session first loads, adopt its persisted lastView once. We use a
  // render-time conditional setState (the React-recommended pattern for
  // resetting state from props) instead of an effect to avoid cascading
  // renders.
  if (session && !didInitFromSession) {
    setDidInitFromSession(true);
    const normalized = normalizeSessionView(session.lastView);
    if (normalized) {
      setView(normalized);
    }
  }

  const savedVerses = useMemo(() => resolved?.savedVerses ?? [], [resolved]);
  const notes = useMemo(() => resolved?.notes ?? [], [resolved]);
  const teachPassagesCount = useMemo(() => {
    if (resolved?.teachPassagesCount !== undefined) {
      return resolved.teachPassagesCount;
    }
    return countDistinctTeachPassageRefs(notes);
  }, [resolved, notes]);

  const activityOptions = useMemo(
    () =>
      buildActivityOptions({
        savedVersesCount: savedVerses.length,
        notesCount: notes.length,
        teachPassagesCount,
      }),
    [savedVerses.length, notes.length, teachPassagesCount],
  );

  function handleViewChange(next: SessionView) {
    setView(next);
    void touchSession({
      id: sessionId as Id<"studySessions">,
      lastView: next,
    });
  }

  // `useQuery` returns undefined while the query is loading and null when the
  // query resolves to "no access / not found" (invalid id, deleted session, or
  // another user's session). We distinguish them so a bad id shows a real
  // not-found state instead of an indefinite loading spinner.
  if (session === undefined) {
    return (
      <div className="flex h-full items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Loading session...</p>
      </div>
    );
  }

  if (session === null) {
    return (
      <div className="flex h-full items-center justify-center bg-background px-6">
        <div className="max-w-sm space-y-3 text-center">
          <SearchX
            aria-hidden
            className="mx-auto h-8 w-8 text-muted-foreground/70"
          />
          <h1 className="text-base font-semibold tracking-tight">
            Study session not found
          </h1>
          <p className="text-sm text-muted-foreground">
            This session may have been deleted, or the link is pointing at a
            session that isn&apos;t yours.
          </p>
          <Link
            to="/study"
            className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Study
          </Link>
        </div>
      </div>
    );
  }

  const summaryText = session.name || formatScopeSummary(session.scope);

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <header className="shrink-0 border-b px-5 py-3">
        <Link
          to="/study"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-1"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Study
        </Link>
        <h1 className="text-lg font-semibold tracking-tight">{summaryText}</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          {notes.length} note{notes.length !== 1 ? "s" : ""},{" "}
          {savedVerses.length} hearted verse
          {savedVerses.length !== 1 ? "s" : ""}, {teachPassagesCount} passage
          {teachPassagesCount !== 1 ? "s" : ""}
        </p>
        <div className="mt-3">
          <StudyActivitySwitcher
            active={view}
            options={activityOptions}
            onChange={handleViewChange}
          />
        </div>
      </header>

      <ScrollArea className="flex-1 min-h-0">
        <div className="max-w-6xl mx-auto px-5 py-6">
          {view === "overview" ? (
            <StudySessionOverview
              savedVerses={savedVerses}
              notes={notes}
              teachPassagesCount={teachPassagesCount}
              isResolved={resolved !== undefined}
            />
          ) : (
            <div className="max-w-5xl mx-auto">
              <StudySessionActivityView
                key={view}
                activity={view}
                savedVerses={savedVerses}
                notes={notes}
                scopeLabel={formatScopeSummary(session.scope)}
              />
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
