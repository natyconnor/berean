import type { CSSProperties } from "react";
import type { TagMatchMode } from "@/lib/tag-utils";
import { TagFilterControl } from "@/components/search/tag-filter-control";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface SearchWorkspaceSidebarProps {
  effectiveQuery: string;
  effectiveMatchMode: TagMatchMode;
  availableTags: string[];
  effectiveSelectedTags: string[];
  updateQuery: (query: string) => void;
  updateMatchMode: (mode: TagMatchMode) => void;
  toggleTag: (tag: string) => void;
  clearTags: () => void;
  resolveTagStyle: (tag: string) => CSSProperties | undefined;
}

export function SearchWorkspaceSidebar({
  effectiveQuery,
  effectiveMatchMode,
  availableTags,
  effectiveSelectedTags,
  updateQuery,
  updateMatchMode,
  toggleTag,
  clearTags,
  resolveTagStyle,
}: SearchWorkspaceSidebarProps) {
  return (
    <aside className="order-2 p-4 lg:border-b-0">
      <div className="space-y-3">
        <div className="space-y-1">
          <h1 className="text-base font-semibold">Search Tools</h1>
          <p className="text-xs text-muted-foreground">
            Search notes, filter tags, and choose a match mode.
          </p>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Query
          </p>
          <Input
            placeholder="Type 2+ characters..."
            value={effectiveQuery}
            onChange={(event) => updateQuery(event.target.value)}
            className="h-8 text-sm"
            data-tour-id="search-query-input"
          />
        </div>

        <div className="space-y-2" data-tour-id="search-match-mode">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Match Mode
          </p>
          <div className="flex gap-1">
            <Button
              size="xs"
              variant={effectiveMatchMode === "any" ? "secondary" : "outline"}
              onClick={() => updateMatchMode("any")}
            >
              Any
            </Button>
            <Button
              size="xs"
              variant={effectiveMatchMode === "all" ? "secondary" : "outline"}
              onClick={() => updateMatchMode("all")}
            >
              All
            </Button>
          </div>
        </div>

        <TagFilterControl
          availableTags={availableTags}
          selectedTags={effectiveSelectedTags}
          onToggleTag={toggleTag}
          onClear={clearTags}
          resolveTagStyle={resolveTagStyle}
          tourId="search-tag-filter"
        />
      </div>
    </aside>
  );
}
