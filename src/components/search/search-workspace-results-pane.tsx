import type { CSSProperties, RefObject } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SearchResultGroupRow } from "./search-result-group-row";
import type {
  SearchResultGroup,
  SearchVerseRef,
} from "./search-workspace-model";

interface SearchWorkspaceResultsPaneProps {
  effectiveShouldSearch: boolean;
  effectiveGroups: SearchResultGroup[];
  effectiveSelectedNoteId: string | undefined;
  effectiveNormalizedQuery: string;
  effectiveResultCount: number;
  resolveTagStyle: (tag: string) => CSSProperties | undefined;
  searchResultsReady: boolean;
  useTutorialDemoResults: boolean;
  isSearchTourActive: boolean;
  resultsViewportRef: RefObject<HTMLDivElement | null>;
  onSelectNote: (noteId: string) => void;
  onJumpToReference: (ref: SearchVerseRef) => void;
}

export function SearchWorkspaceResultsPane({
  effectiveShouldSearch,
  effectiveGroups,
  effectiveSelectedNoteId,
  effectiveNormalizedQuery,
  effectiveResultCount,
  resolveTagStyle,
  searchResultsReady,
  useTutorialDemoResults,
  isSearchTourActive,
  resultsViewportRef,
  onSelectNote,
  onJumpToReference,
}: SearchWorkspaceResultsPaneProps) {
  const panelScrollClass = "h-[32vh] md:h-[34vh] lg:h-[calc(100vh-2.6rem)]";

  return (
    <section className="order-1 border-b lg:border-r lg:border-b-0">
      <div className="grid border-b lg:grid-cols-[minmax(340px,1fr)_minmax(360px,1.1fr)]">
        <div className="border-r px-4 py-3">
          <h2 className="text-sm font-semibold">Scripture</h2>
        </div>
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Matching Notes</h2>
            <span className="text-xs text-muted-foreground">
              {effectiveResultCount}
            </span>
          </div>
        </div>
      </div>
      <div>
        <ScrollArea
          className={panelScrollClass}
          viewportRef={resultsViewportRef}
        >
          {!effectiveShouldSearch ? (
            <div className="px-4 py-6 text-sm text-muted-foreground">
              Enter at least 2 characters or choose one or more tags.
            </div>
          ) : effectiveGroups.length === 0 ? (
            <div className="px-4 py-6 text-sm text-muted-foreground">
              {searchResultsReady
                ? "No notes matched your search and filters."
                : "Searching..."}
            </div>
          ) : (
            <div className="space-y-3 p-3">
              {effectiveGroups.map((group, index) => (
                <SearchResultGroupRow
                  key={group.key}
                  group={group}
                  selectedNoteId={effectiveSelectedNoteId}
                  normalizedQuery={effectiveNormalizedQuery}
                  onSelectNote={onSelectNote}
                  onJumpToRef={onJumpToReference}
                  resolveTagStyle={resolveTagStyle}
                  isTutorialDemo={useTutorialDemoResults}
                  markTourTargets={isSearchTourActive && index === 0}
                  resultsViewportRef={resultsViewportRef}
                />
              ))}
            </div>
          )}
        </ScrollArea>
      </div>
    </section>
  );
}
