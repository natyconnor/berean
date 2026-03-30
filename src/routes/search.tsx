import { createFileRoute } from "@tanstack/react-router";
import { type SearchWorkspaceRouteState } from "@/components/search/search-workspace";
import { SearchPage } from "@/components/routes/search-page";

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
