import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import {
  SearchWorkspace,
  type SearchWorkspaceRouteState,
} from "@/components/search/search-workspace";
import { readSearchWorkspaceState } from "@/lib/search-workspace-state";

function normalizeSearchState(
  search: Record<string, unknown>,
): SearchWorkspaceRouteState {
  const q = typeof search.q === "string" ? search.q : undefined;
  const tags = typeof search.tags === "string" ? search.tags : undefined;
  const mode = search.mode === "all" ? "all" : "any";
  const noteId = typeof search.noteId === "string" ? search.noteId : undefined;

  return {
    q: q && q.trim().length > 0 ? q : undefined,
    tags: tags && tags.trim().length > 0 ? tags : undefined,
    mode,
    noteId: noteId && noteId.trim().length > 0 ? noteId : undefined,
  };
}

export const Route = createFileRoute("/search")({
  validateSearch: normalizeSearchState,
  component: SearchPage,
});

function SearchPage() {
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
