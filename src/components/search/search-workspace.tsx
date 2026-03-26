import { useCallback, useEffect, useMemo, useRef } from "react";
import { motion } from "framer-motion";
import { useQuery } from "convex-helpers/react/cache";
import { api } from "../../../convex/_generated/api";
import { useTabs } from "@/lib/use-tabs";
import { logInteraction } from "@/lib/dev-log";
import { toPassageId } from "@/lib/verse-ref-utils";
import { useStarterTagBadgeStyle } from "@/lib/tag-color-styles";
import { useSearchWorkspaceRouting } from "./hooks/use-search-workspace-routing";
import { useSearchWorkspacePersistence } from "./hooks/use-search-workspace-persistence";
import { useTutorial } from "@/components/tutorial/tutorial-context";
import {
  SEARCH_TUTORIAL_DEMO_GROUPS,
  SEARCH_TUTORIAL_DEMO_NOTE_ID,
  SEARCH_TUTORIAL_DEMO_QUERY,
  SEARCH_TUTORIAL_DEMO_TAGS,
  type SearchResultGroup,
  type SearchResultNote,
  type SearchVerseRef,
} from "./search-workspace-model";
import { SearchWorkspaceResultsPane } from "./search-workspace-results-pane";
import { SearchWorkspaceSidebar } from "./search-workspace-sidebar";
import { type TagMatchMode } from "@/lib/tag-utils";

export interface SearchWorkspaceRouteState {
  q?: string;
  tags?: string;
  mode?: TagMatchMode;
  noteId?: string;
}

interface SearchWorkspaceProps {
  search: SearchWorkspaceRouteState;
}

function toRefKey(ref: SearchVerseRef | null): string {
  if (!ref) return "__unlinked__";
  return `${ref.book}|${ref.chapter}|${ref.startVerse}|${ref.endVerse}`;
}

export function SearchWorkspace({ search }: SearchWorkspaceProps) {
  const { openTab } = useTabs();
  const { isTourActive } = useTutorial();
  const resolveTagStyle = useStarterTagBadgeStyle();
  const resultsViewportRef = useRef<HTMLDivElement | null>(null);
  const hasLoggedWorkspaceOpenRef = useRef(false);
  const lastCriteriaSignatureRef = useRef<string | null>(null);
  const {
    query,
    matchMode,
    selectedTags,
    selectedNoteId,
    normalizedQuery,
    hasTextQuery,
    shouldSearch,
    updateQuery,
    updateMatchMode,
    toggleTag,
    clearTags,
    selectNote,
  } = useSearchWorkspaceRouting(search);

  const catalog = useQuery(api.tags.listCatalog);
  const searchResults = useQuery(
    api.notes.searchWorkspace,
    shouldSearch
      ? {
          ...(hasTextQuery ? { query: normalizedQuery } : {}),
          tags: selectedTags,
          matchMode,
          limit: 100,
        }
      : "skip",
  );

  const availableTags = useMemo(
    () => (catalog ?? []).map((entry) => entry.tag),
    [catalog],
  );

  const groupedResults = useMemo<SearchResultGroup[]>(() => {
    if (!searchResults || searchResults.length === 0) return [];

    const groups = new Map<string, SearchResultGroup>();
    for (const result of searchResults) {
      const ref = result.primaryRef ?? result.verseRefs[0] ?? null;
      const key = toRefKey(ref);
      const note: SearchResultNote = {
        noteId: String(result.noteId),
        content: result.content,
        tags: result.tags,
      };
      const existing = groups.get(key);
      if (existing) {
        existing.notes.push(note);
      } else {
        groups.set(key, { key, ref, notes: [note] });
      }
    }

    return Array.from(groups.values()).sort((a, b) => {
      if (!a.ref && !b.ref) return 0;
      if (!a.ref) return 1;
      if (!b.ref) return -1;
      return toRefKey(a.ref).localeCompare(toRefKey(b.ref));
    });
  }, [searchResults]);

  const isSearchTourActive = isTourActive("search");
  const useTutorialDemoResults =
    isSearchTourActive && groupedResults.length === 0;
  const effectiveQuery = useTutorialDemoResults
    ? SEARCH_TUTORIAL_DEMO_QUERY
    : query;
  const effectiveMatchMode = useTutorialDemoResults ? "any" : matchMode;
  const effectiveSelectedTags = useTutorialDemoResults
    ? SEARCH_TUTORIAL_DEMO_TAGS
    : selectedTags;
  const effectiveSelectedNoteId = useTutorialDemoResults
    ? SEARCH_TUTORIAL_DEMO_NOTE_ID
    : selectedNoteId;
  const effectiveNormalizedQuery = useTutorialDemoResults
    ? SEARCH_TUTORIAL_DEMO_QUERY
    : normalizedQuery;
  const effectiveShouldSearch = useTutorialDemoResults || shouldSearch;
  const effectiveGroups = useTutorialDemoResults
    ? SEARCH_TUTORIAL_DEMO_GROUPS
    : groupedResults;
  const effectiveResultCount = useTutorialDemoResults
    ? SEARCH_TUTORIAL_DEMO_GROUPS.reduce(
        (count, group) => count + group.notes.length,
        0,
      )
    : (searchResults?.length ?? 0);

  const jumpToReference = useCallback(
    (ref: SearchVerseRef) => {
      const passageId = toPassageId(ref.book, ref.chapter);
      const label = `${ref.book} ${ref.chapter}`;
      logInteraction("search", "result-opened", {
        book: ref.book,
        chapter: ref.chapter,
        endVerse: ref.endVerse,
        startVerse: ref.startVerse,
      });
      openTab(passageId, label, {
        source: "search",
        mode: "read",
        startVerse: ref.startVerse,
        endVerse: ref.endVerse,
      });
    },
    [openTab],
  );

  useEffect(() => {
    if (hasLoggedWorkspaceOpenRef.current) return;
    hasLoggedWorkspaceOpenRef.current = true;
    logInteraction("search", "workspace-opened", {
      hasNoteId: !!search.noteId,
      hasQuery: !!search.q,
      matchMode,
      selectedTagCount: selectedTags.length,
    });
  }, [matchMode, search.noteId, search.q, selectedTags.length]);

  useEffect(() => {
    const signature = shouldSearch
      ? `${hasTextQuery}:${selectedTags.length}:${matchMode}`
      : "idle";
    if (lastCriteriaSignatureRef.current === signature) return;
    if (lastCriteriaSignatureRef.current === null && !shouldSearch) {
      lastCriteriaSignatureRef.current = signature;
      return;
    }
    lastCriteriaSignatureRef.current = signature;
    if (!shouldSearch) {
      logInteraction("search", "criteria-cleared");
      return;
    }
    logInteraction("search", "criteria-applied", {
      hasTextQuery,
      matchMode,
      selectedTagCount: selectedTags.length,
    });
  }, [hasTextQuery, matchMode, selectedTags.length, shouldSearch]);

  useSearchWorkspacePersistence({
    search,
    shouldSearch: effectiveShouldSearch,
    searchResultsReady: searchResults !== undefined,
    viewportRef: resultsViewportRef,
    disabled: useTutorialDemoResults,
  });

  const handleSelectNote = useCallback(
    (noteId: string) => {
      if (useTutorialDemoResults) return;
      selectNote(noteId);
    },
    [selectNote, useTutorialDemoResults],
  );

  return (
    <div className="h-full overflow-hidden">
      <motion.div
        className="grid h-full grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(260px,320px)]"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
      >
        <SearchWorkspaceResultsPane
          effectiveShouldSearch={effectiveShouldSearch}
          effectiveGroups={effectiveGroups}
          effectiveSelectedNoteId={effectiveSelectedNoteId}
          effectiveNormalizedQuery={effectiveNormalizedQuery}
          effectiveResultCount={effectiveResultCount}
          resolveTagStyle={resolveTagStyle}
          searchResultsReady={searchResults !== undefined}
          useTutorialDemoResults={useTutorialDemoResults}
          isSearchTourActive={isSearchTourActive}
          resultsViewportRef={resultsViewportRef}
          onSelectNote={handleSelectNote}
          onJumpToReference={jumpToReference}
        />

        <SearchWorkspaceSidebar
          effectiveQuery={effectiveQuery}
          effectiveMatchMode={effectiveMatchMode}
          availableTags={availableTags}
          effectiveSelectedTags={effectiveSelectedTags}
          updateQuery={updateQuery}
          updateMatchMode={updateMatchMode}
          toggleTag={toggleTag}
          clearTags={clearTags}
          resolveTagStyle={resolveTagStyle}
        />
      </motion.div>
    </div>
  );
}
