import { Loader2, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface ParsedCustomTagInput {
  duplicateTagsInInput: string[];
  duplicateTagsInCatalog: string[];
  tagsToAdd: string[];
}

interface CustomTagEntry {
  tag: string;
  label: string;
}

interface CustomTagsSectionProps {
  customTags: CustomTagEntry[];
  customTagInput: string;
  busyAction: string | null;
  parsedCustomTagInput: ParsedCustomTagInput;
  onCustomTagInputChange: (value: string) => void;
  onAddCustomTags: () => void | Promise<void>;
  onDeleteCustomTag: (tag: string) => void;
}

export function CustomTagsSection({
  customTags,
  customTagInput,
  busyAction,
  parsedCustomTagInput,
  onCustomTagInputChange,
  onAddCustomTags,
  onDeleteCustomTag,
}: CustomTagsSectionProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold">Custom tags</h3>
        <Badge variant="outline" className="text-xs">
          {customTags.length}
        </Badge>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={customTagInput}
          onChange={(event) => onCustomTagInputChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void onAddCustomTags();
            }
          }}
          placeholder="Add custom tag (comma-separated supported)"
          className="h-8 min-w-[280px] max-w-[460px]"
          disabled={busyAction !== null}
        />
        <Button
          size="sm"
          onClick={() => void onAddCustomTags()}
          disabled={
            busyAction !== null || parsedCustomTagInput.tagsToAdd.length === 0
          }
        >
          {busyAction === "add-custom" && (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          )}
          Add custom tag
        </Button>
      </div>
      {customTagInput.trim().length > 0 && (
        <div className="space-y-1">
          {parsedCustomTagInput.duplicateTagsInInput.length > 0 && (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              Duplicate in input:{" "}
              {parsedCustomTagInput.duplicateTagsInInput.join(", ")}
            </p>
          )}
          {parsedCustomTagInput.duplicateTagsInCatalog.length > 0 && (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              Already exists:{" "}
              {parsedCustomTagInput.duplicateTagsInCatalog.join(", ")}
            </p>
          )}
          {parsedCustomTagInput.tagsToAdd.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Ready to add: {parsedCustomTagInput.tagsToAdd.join(", ")}
            </p>
          )}
          {parsedCustomTagInput.tagsToAdd.length === 0 && (
            <p className="text-xs text-muted-foreground">No new tags to add.</p>
          )}
        </div>
      )}
      {customTags.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No custom tags yet. They appear here as you create tags in notes.
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {customTags.map((entry) => (
            <span
              key={entry.tag}
              className="inline-flex items-center gap-1 rounded-md border bg-background px-2 py-1 text-xs"
            >
              {entry.label}
              <button
                type="button"
                disabled={busyAction !== null}
                className="rounded p-0.5 text-muted-foreground hover:text-destructive"
                onClick={() => onDeleteCustomTag(entry.tag)}
                aria-label={`Delete custom tag ${entry.label}`}
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
