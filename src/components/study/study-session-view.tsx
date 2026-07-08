import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  BookHeart,
  GraduationCap,
  Loader2,
  SearchX,
} from "lucide-react";
import { useQuery } from "convex-helpers/react/cache";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatScopeSummary } from "./study-scope-summary";
import { sortByVerseRef } from "../../../shared/compare-verse-refs";
import { countDistinctTeachPassageRefs } from "./study-card-model";
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

function normalizeSessionView(
  value: string | undefined,
): SessionView | undefined {
  if (!value) return undefined;
  // Backwards-compatible: sessions persisted before the rename used "explain".
  if (value === "teach" || value === "explain") return "teach";
  if (value === "overview") return "overview";
  // Legacy verse-memory views ("verse-memory" / "mixed-review") are no longer a
  // Study activity, so they fall back to the overview.
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
  const createPack = useMutation(api.packs.create);
  const navigate = useNavigate();

  const hasTouched = useRef(false);
  useEffect(() => {
    if (session && !hasTouched.current) {
      hasTouched.current = true;
      void touchSession({ id: sessionId as Id<"studySessions"> });
    }
  }, [session, sessionId, touchSession]);

  const [view, setView] = useState<SessionView>(DEFAULT_VIEW);
  const [didInitFromSession, setDidInitFromSession] = useState(false);
  const [isCreatingPack, setIsCreatingPack] = useState(false);
  const [scopeError, setScopeError] = useState<string | null>(null);

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

  const savedVerses = useMemo(
    () => sortByVerseRef(resolved?.savedVerses ?? []),
    [resolved],
  );
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
        notesCount: notes.length,
        teachPassagesCount,
      }),
    [notes.length, teachPassagesCount],
  );
  const teachOption = activityOptions.find((o) => o.view === "teach");
  const teachAvailable = teachOption?.available ?? false;
  const teachDisabledReason = teachOption?.disabledReason;

  function handleViewChange(next: SessionView) {
    setView(next);
    void touchSession({
      id: sessionId as Id<"studySessions">,
      lastView: next,
    });
  }

  async function handleMemorizeScope() {
    if (!session || isCreatingPack) return;
    setIsCreatingPack(true);
    setScopeError(null);
    // Track whether the create landed so we can tell the two failure modes
    // apart: a failed create is safe to retry, but a failed navigate means the
    // pack already exists and must not be created a second time.
    let packId: Id<"packs"> | undefined;
    try {
      packId = await createPack({
        name: session.name || formatScopeSummary(session.scope),
        kind: "scope",
        scope: session.scope,
      });
      await navigate({ to: "/memory/$packId", params: { packId } });
    } catch {
      setScopeError(
        packId
          ? "Created the pack, but couldn't open it. You can find it in Memory."
          : "Couldn't start memorizing this scope. Please try again.",
      );
      setIsCreatingPack(false);
    }
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
            Back to Study Sessions
          </Link>
        </div>
      </div>
    );
  }

  const summaryText = session.name || formatScopeSummary(session.scope);

  const teachButton = (
    <Button
      type="button"
      size="sm"
      disabled={!teachAvailable}
      onClick={() => handleViewChange("teach")}
    >
      <GraduationCap className="h-4 w-4 mr-1.5" />
      Teach
    </Button>
  );

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <header className="shrink-0 border-b px-5 py-3">
        <Link
          to="/study"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-1"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Study Sessions
        </Link>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-lg font-semibold tracking-tight">
              {summaryText}
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {notes.length} note{notes.length !== 1 ? "s" : ""},{" "}
              {savedVerses.length} hearted verse
              {savedVerses.length !== 1 ? "s" : ""}, {teachPassagesCount}{" "}
              passage
              {teachPassagesCount !== 1 ? "s" : ""}
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="shrink-0"
            disabled={isCreatingPack}
            onClick={() => void handleMemorizeScope()}
          >
            {isCreatingPack ? (
              <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
            ) : (
              <BookHeart className="h-4 w-4 mr-1.5" />
            )}
            Memorize verses in this scope
          </Button>
        </div>
        {scopeError && (
          <p className="mt-2 text-sm text-destructive" role="alert">
            {scopeError}
          </p>
        )}
      </header>

      <ScrollArea className="flex-1 min-h-0">
        <div className="max-w-6xl mx-auto px-5 py-6">
          {view === "teach" ? (
            <div className="mx-auto w-full max-w-5xl space-y-4">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-foreground"
                onClick={() => handleViewChange("overview")}
              >
                <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />
                Back to overview
              </Button>
              <StudySessionActivityView
                key={view}
                notes={notes}
                scopeLabel={formatScopeSummary(session.scope)}
              />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex justify-end">
                {teachAvailable || !teachDisabledReason ? (
                  teachButton
                ) : (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span>{teachButton}</span>
                    </TooltipTrigger>
                    <TooltipContent>{teachDisabledReason}</TooltipContent>
                  </Tooltip>
                )}
              </div>
              <StudySessionOverview
                savedVerses={savedVerses}
                notes={notes}
                teachPassagesCount={teachPassagesCount}
                isResolved={resolved !== undefined}
              />
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
