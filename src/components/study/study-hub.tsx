import { useCallback, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { useQuery } from "convex-helpers/react/cache";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { StudySessionCard } from "./study-session-card";
import { DeleteStudySessionDialog } from "./delete-study-session-dialog";
import { formatScopeSummary } from "./study-scope-summary";

type DeleteCandidate = {
  id: Id<"studySessions">;
  title: string;
};

export function StudyHub() {
  const sessions = useQuery(api.studySessions.listMine, {});
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
          {!sessions || sessions.length === 0 ? (
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
            <ul className="space-y-2">
              {sessions.map((session, index) => {
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
    </div>
  );
}
