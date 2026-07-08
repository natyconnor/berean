import { useCallback, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useQuery } from "convex-helpers/react/cache";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ScopeForm } from "./scope-form";
import { useScopeForm } from "./use-scope-form";
import { StudyModeExplainerDialog } from "./study-mode-explainer-dialog";

export function StudyScopeBuilder() {
  const navigate = useNavigate();
  const createSession = useMutation(api.studySessions.create);
  const [isCreating, setIsCreating] = useState(false);

  const {
    selectedBooks,
    chapterRanges,
    selectedTags,
    tagMatchMode,
    onToggleBook,
    onSetBooks,
    onSetChapterRange,
    onSelectPreset,
    onToggleTag,
    onClearTags,
    onSetTagMatchMode,
    scopeForPreview,
    summaryText,
  } = useScopeForm();

  const preview = useQuery(api.studySessions.previewCounts, {
    scope: scopeForPreview,
  });

  const handleCreate = useCallback(async () => {
    setIsCreating(true);
    try {
      const id = await createSession({
        name: summaryText,
        scope: scopeForPreview,
      });
      void navigate({
        to: "/study/$sessionId",
        params: { sessionId: id },
      });
    } finally {
      setIsCreating(false);
    }
  }, [createSession, navigate, scopeForPreview, summaryText]);

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
        <h1 className="text-lg font-semibold tracking-tight">
          New Study Session
        </h1>
      </header>

      <ScrollArea className="flex-1 min-h-0">
        <div className="max-w-2xl mx-auto px-5 py-6 space-y-8">
          <ScopeForm
            selectedBooks={selectedBooks}
            chapterRanges={chapterRanges}
            selectedTags={selectedTags}
            tagMatchMode={tagMatchMode}
            onToggleBook={onToggleBook}
            onSetBooks={onSetBooks}
            onSetChapterRange={onSetChapterRange}
            onSelectPreset={onSelectPreset}
            onToggleTag={onToggleTag}
            onClearTags={onClearTags}
            onSetTagMatchMode={onSetTagMatchMode}
          />
        </div>
      </ScrollArea>

      <footer className="shrink-0 border-t bg-muted/30 px-5 py-3">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium truncate">{summaryText}</p>
            {preview && (
              <p className="text-xs text-muted-foreground">
                {preview.notesCount} note{preview.notesCount !== 1 ? "s" : ""}
                {", "}
                {preview.savedVersesCount} hearted verse
                {preview.savedVersesCount !== 1 ? "s" : ""}
                {", "}
                {preview.teachPassagesCount} passage
                {preview.teachPassagesCount !== 1 ? "s" : ""}
              </p>
            )}
          </div>
          <Button onClick={handleCreate} disabled={isCreating}>
            {isCreating ? "Creating\u2026" : "Start Session"}
          </Button>
        </div>
      </footer>
      <StudyModeExplainerDialog />
    </div>
  );
}
