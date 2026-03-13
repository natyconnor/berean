import { useEffect, useRef } from "react";
import {
  readSearchWorkspaceState,
  writeSearchWorkspaceParams,
  writeSearchWorkspaceScroll,
} from "@/lib/search-workspace-state";
import type { SearchWorkspaceRouteState } from "../search-workspace";

interface UseSearchWorkspacePersistenceOptions {
  search: SearchWorkspaceRouteState;
  shouldSearch: boolean;
  searchResultsReady: boolean;
  viewportRef: React.RefObject<HTMLDivElement | null>;
  disabled?: boolean;
}

export function useSearchWorkspacePersistence({
  search,
  shouldSearch,
  searchResultsReady,
  viewportRef,
  disabled = false,
}: UseSearchWorkspacePersistenceOptions) {
  const hasRestoredScrollRef = useRef(false);

  useEffect(() => {
    if (disabled) return;
    writeSearchWorkspaceParams({
      q: search.q,
      tags: search.tags,
      mode: search.mode,
      noteId: search.noteId,
    });
  }, [disabled, search.mode, search.noteId, search.q, search.tags]);

  useEffect(() => {
    if (disabled) return;
    const viewport = viewportRef.current;
    if (!viewport) return;

    const handleScroll = () => {
      writeSearchWorkspaceScroll(viewport.scrollTop);
    };

    viewport.addEventListener("scroll", handleScroll, { passive: true });
    return () => viewport.removeEventListener("scroll", handleScroll);
  }, [disabled, viewportRef]);

  useEffect(() => {
    if (disabled) return;
    if (hasRestoredScrollRef.current) return;
    if (!shouldSearch || !searchResultsReady) return;

    const viewport = viewportRef.current;
    if (!viewport) return;

    const saved = readSearchWorkspaceState();
    if (saved.scrollTop > 0) {
      viewport.scrollTop = saved.scrollTop;
    }
    hasRestoredScrollRef.current = true;
  }, [disabled, searchResultsReady, shouldSearch, viewportRef]);
}
