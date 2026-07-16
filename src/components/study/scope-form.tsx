import { useMemo } from "react";
import { useQuery } from "convex-helpers/react/cache";

import { api } from "../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { useStarterTagBadgeStyle } from "@/lib/tag-color-styles";
import { TagFilterControl } from "@/components/search/tag-filter-control";

import { StudyScopePresets } from "./study-scope-presets";
import { StudyScopeBookPicker } from "./study-scope-book-picker";
import type { ScopeFormControls } from "./use-scope-form";

interface ScopeFormProps extends ScopeFormControls {
  /** Sub-heading under the "Passage Scope" section. */
  passageDescription?: string;
  /** Sub-heading under the "Tags" section. */
  tagsDescription?: string;
  /**
   * Whether to render the tag-filter section. Defaults to `true` (Study, where
   * tags filter notes). Packs pass `false`: scope packs match verses by
   * book/chapter only, so tags would misleadingly imply they narrow membership.
   */
  showTagFilter?: boolean;
}

/**
 * The passage-scope + tag selection controls (presets, book/chapter picker, and
 * tag filter). Rendered as two `<section>`s so a parent can drop it inside a
 * `space-y` column alongside its own preview footer. State lives in
 * `useScopeForm`.
 */
export function ScopeForm({
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
  passageDescription = "Choose which books and chapters to study.",
  tagsDescription = "Optionally filter to notes with specific tags.",
  showTagFilter = true,
}: ScopeFormProps) {
  const resolveTagStyle = useStarterTagBadgeStyle();
  const catalog = useQuery(api.tags.listCatalog);

  const availableTags = useMemo(
    () => (catalog ?? []).map((entry) => entry.tag),
    [catalog],
  );

  return (
    <>
      <section className="space-y-3">
        <div className="space-y-1">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Passage Scope
          </h2>
          <p className="text-xs text-muted-foreground">{passageDescription}</p>
        </div>
        <StudyScopePresets
          selectedBooks={selectedBooks}
          onSelectPreset={onSelectPreset}
        />
        <StudyScopeBookPicker
          selectedBooks={selectedBooks}
          chapterRanges={chapterRanges}
          onToggleBook={onToggleBook}
          onSetBooks={onSetBooks}
          onSetChapterRange={onSetChapterRange}
        />
      </section>

      {showTagFilter && (
        <section className="space-y-3">
          <div className="space-y-1">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Tags
            </h2>
            <p className="text-xs text-muted-foreground">{tagsDescription}</p>
          </div>

          <div className="space-y-2">
            <div className="flex gap-1">
              <Button
                size="xs"
                variant={tagMatchMode === "any" ? "secondary" : "outline"}
                onClick={() => onSetTagMatchMode("any")}
              >
                Any
              </Button>
              <Button
                size="xs"
                variant={tagMatchMode === "all" ? "secondary" : "outline"}
                onClick={() => onSetTagMatchMode("all")}
              >
                All
              </Button>
            </div>
            <TagFilterControl
              availableTags={availableTags}
              selectedTags={selectedTags}
              onToggleTag={onToggleTag}
              onClear={onClearTags}
              resolveTagStyle={resolveTagStyle}
            />
          </div>
        </section>
      )}
    </>
  );
}
