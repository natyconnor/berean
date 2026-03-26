import { useCallback, useMemo } from "react";
import { useNavigate } from "@tanstack/react-router";
import { logInteraction } from "@/lib/dev-log";
import { normalizeTags, type TagMatchMode } from "@/lib/tag-utils";
import type { SearchWorkspaceRouteState } from "../search-workspace";

function parseTags(serializedTags: string | undefined): string[] {
  if (!serializedTags) return [];
  return normalizeTags(serializedTags.split(","));
}

function serializeTags(tags: string[]): string | undefined {
  const normalized = normalizeTags(tags);
  return normalized.length > 0 ? normalized.join(",") : undefined;
}

export function useSearchWorkspaceRouting(search: SearchWorkspaceRouteState) {
  const navigate = useNavigate();

  const query = search.q ?? "";
  const matchMode: TagMatchMode = search.mode === "all" ? "all" : "any";
  const selectedTags = useMemo(() => parseTags(search.tags), [search.tags]);
  const selectedNoteId = search.noteId;

  const normalizedQuery = query.trim();
  const hasTextQuery = normalizedQuery.length >= 2;
  const hasTagFilters = selectedTags.length > 0;
  const shouldSearch = hasTextQuery || hasTagFilters;

  const updateSearch = useCallback(
    (next: SearchWorkspaceRouteState) => {
      void navigate({
        to: "/search",
        search: {
          q: "q" in next ? next.q : search.q,
          tags: "tags" in next ? next.tags : search.tags,
          mode: "mode" in next ? next.mode : search.mode,
          noteId: "noteId" in next ? next.noteId : search.noteId,
        },
        replace: true,
      });
    },
    [navigate, search],
  );

  const updateQuery = useCallback(
    (nextQuery: string) => {
      updateSearch({
        q: nextQuery.length > 0 ? nextQuery : undefined,
        noteId: undefined,
      });
    },
    [updateSearch],
  );

  const updateMatchMode = useCallback(
    (nextMatchMode: TagMatchMode) => {
      logInteraction("search", "match-mode-changed", {
        matchMode: nextMatchMode,
      });
      updateSearch({ mode: nextMatchMode, noteId: undefined });
    },
    [updateSearch],
  );

  const toggleTag = useCallback(
    (tag: string) => {
      const nextTags = selectedTags.includes(tag)
        ? selectedTags.filter((currentTag) => currentTag !== tag)
        : [...selectedTags, tag];
      logInteraction("search", "tag-filters-changed", {
        selectedTagCount: nextTags.length,
      });
      updateSearch({
        tags: serializeTags(nextTags),
        noteId: undefined,
      });
    },
    [selectedTags, updateSearch],
  );

  const clearTags = useCallback(() => {
    logInteraction("search", "tag-filters-cleared");
    updateSearch({ tags: undefined, noteId: undefined });
  }, [updateSearch]);

  const selectNote = useCallback(
    (noteId: string) => {
      logInteraction("search", "result-selected", {
        hasNoteId: noteId.length > 0,
      });
      updateSearch({ noteId });
    },
    [updateSearch],
  );

  return {
    query,
    matchMode,
    selectedTags,
    selectedNoteId,
    normalizedQuery,
    hasTextQuery,
    hasTagFilters,
    shouldSearch,
    updateQuery,
    updateMatchMode,
    toggleTag,
    clearTags,
    selectNote,
  };
}
