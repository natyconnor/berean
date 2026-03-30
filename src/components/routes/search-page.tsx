import { useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { SearchWorkspace } from "@/components/search/search-workspace";
import { logInteraction } from "@/lib/dev-log";
import { readSearchWorkspaceState } from "@/lib/search-workspace-state";
import { Route } from "@/routes/search";

export function SearchPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();

  useEffect(() => {
    const hasRouteState =
      !!search.q || !!search.tags || !!search.noteId || search.mode === "all";
    if (hasRouteState) return;

    const saved = readSearchWorkspaceState();
    const savedParams = saved.params;
    const hasSavedState =
      !!savedParams.q ||
      !!savedParams.tags ||
      !!savedParams.noteId ||
      savedParams.mode === "all";
    if (!hasSavedState) return;

    logInteraction("search", "workspace-restored", {
      hasNoteId: !!savedParams.noteId,
      hasQuery: !!savedParams.q,
      matchMode: savedParams.mode ?? "any",
      selectedTagCount: savedParams.tags
        ? savedParams.tags.split(",").filter(Boolean).length
        : 0,
    });
    void navigate({
      to: "/search",
      search: {
        q: savedParams.q,
        tags: savedParams.tags,
        mode: savedParams.mode ?? "any",
        noteId: savedParams.noteId,
      },
      replace: true,
    });
  }, [navigate, search.noteId, search.q, search.tags, search.mode]);

  return <SearchWorkspace search={search} />;
}
