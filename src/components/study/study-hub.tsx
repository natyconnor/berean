import { useCallback, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Loader2, Plus } from "lucide-react";
import { useMutation, usePaginatedQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { StudySessionCard } from "./study-session-card";
import { DeleteStudySessionDialog } from "./delete-study-session-dialog";
import { formatScopeSummary } from "./study-scope-summary";
import { StudyModeExplainerDialog } from "./study-mode-explainer-dialog";

type DeleteCandidate = {
  id: Id<"studySessions">;
  title: string;
};

const INITIAL_PAGE_SIZE = 20;
const LOAD_MORE_PAGE_SIZE = 20;

export function StudyHub() {
  const { results, status, loadMore } = usePaginatedQuery(
    api.studySessions.listMine,
    {},
    { initialNumItems: INITIAL_PAGE_SIZE },
  );
  const removeSession = useMutation(api.studySessions.remove);

  const [deleteCandidate, setDeleteCandidate] =
    useState<DeleteCandidate | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const requestDelete = useCallback((candidate: DeleteCandidate) => {
    setDeleteCandidate(candidate);
  }, []);

  const cancelDelete = useCallback(() => {
    if (isDeleting) return;
    setDeleteCandidate(null);
  }, [isDeleting]);

  const confirmDelete = useCallback(async () => {
    if (!deleteCandidate || isDeleting) return;
    setIsDeleting(true);
    try {
      await removeSession({ id: deleteCandidate.id });
      setDeleteCandidate(null);
    } finally {
      setIsDeleting(false);
    }
  }, [deleteCandidate, isDeleting, removeSession]);

  const handleDialogOpenChange = useCallback(
    (open: boolean) => {
      if (!open) cancelDelete();
    },
    [cancelDelete],
  );

  const isLoadingFirstPage = status === "LoadingFirstPage";
  const isLoadingMore = status === "LoadingMore";
  const canLoadMore = status === "CanLoadMore";

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <header className="shrink-0 border-b px-5 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Study</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Your study sessions
            </p>
          </div>
          <Button asChild size="sm">
            <Link to="/study/new">
              <Plus className="h-4 w-4 mr-1.5" />
              New session
            </Link>
          </Button>
        </div>
      </header>
      <ScrollArea className="flex-1 min-h-0">
        <div className="max-w-2xl mx-auto px-5 py-6">
          {isLoadingFirstPage ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : results.length === 0 ? (
            <div className="text-center py-16 px-4">
              <p className="text-sm text-muted-foreground mb-4">
                No study sessions yet. Create one to get started.
              </p>
              <Button asChild>
                <Link to="/study/new">
                  <Plus className="h-4 w-4 mr-1.5" />
                  New session
                </Link>
              </Button>
            </div>
          ) : (
            <>
              <ul className="space-y-2">
                {results.map((session, index) => {
                  const title =
                    session.name && session.name.length > 0
                      ? session.name
                      : formatScopeSummary(session.scope);
                  return (
                    <StudySessionCard
                      key={session._id}
                      sessionId={session._id}
                      index={index}
                      name={session.name}
                      scope={session.scope}
                      lastOpenedAt={session.lastOpenedAt}
                      savedVersesCount={session.savedVersesCount}
                      notesCount={session.notesCount}
                      teachPassagesCount={session.teachPassagesCount}
                      lastView={session.lastView}
                      onDelete={() => requestDelete({ id: session._id, title })}
                    />
                  );
                })}
              </ul>
              {(canLoadMore || isLoadingMore) && (
                <div className="mt-4 flex justify-center">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => loadMore(LOAD_MORE_PAGE_SIZE)}
                    disabled={!canLoadMore}
                  >
                    {isLoadingMore ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                        Loading...
                      </>
                    ) : (
                      "Load more"
                    )}
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </ScrollArea>
      <DeleteStudySessionDialog
        candidate={deleteCandidate}
        busy={isDeleting}
        onOpenChange={handleDialogOpenChange}
        onCancel={cancelDelete}
        onConfirm={confirmDelete}
      />
      <StudyModeExplainerDialog />
    </div>
  );
}
