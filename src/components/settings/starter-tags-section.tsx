import { Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  ALL_STARTER_TAGS,
  DEFAULT_STARTER_TAG_CATEGORY_COLORS,
  STARTER_TAG_CATEGORIES,
} from "@/lib/starter-tags";

interface StarterCatalogEntry {
  source: "custom" | "starter";
}

interface StarterTagsSectionProps {
  selectedStarterCount: number;
  catalogByTag: Map<string, StarterCatalogEntry>;
  draftCategoryColors: Record<string, string>;
  busyAction: string | null;
  onAddAll: () => void | Promise<void>;
  onAddCategory: (categoryId: string, tags: string[]) => void | Promise<void>;
  onColorChange: (categoryId: string, color: string) => void;
  onToggleTag: (tag: string) => void | Promise<void>;
}

export function StarterTagsSection({
  selectedStarterCount,
  catalogByTag,
  draftCategoryColors,
  busyAction,
  onAddAll,
  onAddCategory,
  onColorChange,
  onToggleTag,
}: StarterTagsSectionProps) {
  return (
    <div className="space-y-4">
      <div
        className="flex flex-wrap items-center justify-between gap-3"
        data-tour-id="settings-starter-tags-section"
      >
        <div>
          <h3 className="text-sm font-semibold">Starter tags</h3>
          <p className="text-xs text-muted-foreground">
            {selectedStarterCount} / {ALL_STARTER_TAGS.length} selected
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => void onAddAll()}
          disabled={busyAction !== null}
          data-tour-id="settings-add-all-starter-tags"
        >
          {busyAction === "add-all" && (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          )}
          Add all starter tags
        </Button>
      </div>

      <div
        className="space-y-4"
        data-tour-id="settings-starter-tag-categories"
      >
        {STARTER_TAG_CATEGORIES.map((category) => {
          const categorySelectedCount = category.tags.filter((tag) =>
            catalogByTag.has(tag),
          ).length;
          const addCategoryActionId = `add-category:${category.id}`;
          const draftCategoryColor =
            draftCategoryColors[category.id] ??
            DEFAULT_STARTER_TAG_CATEGORY_COLORS[category.id];

          return (
            <div
              key={category.id}
              className="rounded-lg border p-4 space-y-3 border-l-4"
              style={{ borderLeftColor: draftCategoryColor }}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h4 className="text-sm font-semibold">{category.label}</h4>
                  <p className="text-xs text-muted-foreground">
                    {categorySelectedCount} / {category.tags.length} selected
                  </p>
                </div>
                <Button
                  size="xs"
                  variant="outline"
                  disabled={busyAction !== null}
                  onClick={() => void onAddCategory(category.id, category.tags)}
                >
                  {busyAction === addCategoryActionId && (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  )}
                  Add category
                </Button>
              </div>

              <div className="flex flex-wrap items-center gap-2 rounded-md border bg-background p-2">
                <div
                  className="h-4 w-4 rounded-sm border"
                  style={{ backgroundColor: draftCategoryColor }}
                />
                <label
                  htmlFor={`category-color-${category.id}`}
                  className="text-xs text-muted-foreground"
                >
                  Category color
                </label>
                <input
                  id={`category-color-${category.id}`}
                  type="color"
                  value={draftCategoryColor}
                  disabled={busyAction !== null}
                  onChange={(event) =>
                    onColorChange(category.id, event.target.value)
                  }
                  className="h-7 w-10 cursor-pointer rounded border bg-transparent p-0.5"
                />
                <code className="text-xs text-muted-foreground">
                  {draftCategoryColor}
                </code>
              </div>

              <div className="flex flex-wrap gap-2">
                {category.tags.map((tag) => {
                  const entry = catalogByTag.get(tag);
                  const isSelected = entry !== undefined;
                  const isStarter = entry?.source === "starter";
                  const isCustom = entry?.source === "custom";
                  const toggleActionId = `toggle:${tag}`;

                  return (
                    <button
                      key={tag}
                      type="button"
                      disabled={busyAction !== null || isCustom}
                      onClick={() => void onToggleTag(tag)}
                      className={cn(
                        "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs transition-colors",
                        isSelected
                          ? "border-primary/30 bg-primary/10 text-foreground"
                          : "border-border bg-background text-muted-foreground hover:bg-accent hover:text-foreground",
                        isCustom && "cursor-not-allowed opacity-70",
                        busyAction === toggleActionId && "opacity-80",
                      )}
                      title={
                        isCustom
                          ? "Already in your catalog from custom usage"
                          : undefined
                      }
                    >
                      {busyAction === toggleActionId ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        isSelected && <Check className="h-3 w-3" />
                      )}
                      {tag}
                      {isCustom && (
                        <span className="text-[10px] text-muted-foreground">
                          custom
                        </span>
                      )}
                      {isStarter && (
                        <span className="text-[10px] text-muted-foreground">
                          starter
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
