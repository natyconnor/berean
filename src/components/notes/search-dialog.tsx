import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { motion } from "framer-motion";
import { useQuery } from "convex-helpers/react/cache";
import { useMutation } from "convex/react";
import { useNavigate } from "@tanstack/react-router";
import { api } from "../../../convex/_generated/api";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search } from "lucide-react";
import { useTabs } from "@/lib/use-tabs";
import { logInteraction } from "@/lib/dev-log";
import { useStarterTagBadgeStyle } from "@/lib/tag-color-styles";
import { normalizeTags, type TagMatchMode } from "@/lib/tag-utils";
import { toPassageId } from "@/lib/verse-ref-utils";
import { HighlightedText } from "@/components/search/highlighted-text";
import { TagFilterControl } from "@/components/search/tag-filter-control";
import { formatCommandOrControlShortcut } from "@/lib/keyboard-shortcuts";

interface SearchDialogProps {
  showTrigger?: boolean;
}

export function SearchDialog({ showTrigger = true }: SearchDialogProps) {
  const navigate = useNavigate();
  const { openTab } = useTabs();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [matchMode, setMatchMode] = useState<TagMatchMode>("any");
  const attemptedBackfillRef = useRef(false);
  const backfillCatalog = useMutation(api.tags.backfillCatalogFromNotes);
  const resolveTagStyle = useStarterTagBadgeStyle();
  const searchShortcutLabel = formatCommandOrControlShortcut("K");
  const setDialogOpen = useCallback(
    (nextOpen: boolean, trigger: string) => {
      if (nextOpen !== open) {
        logInteraction(
          "quick-search",
          nextOpen ? "dialog-opened" : "dialog-closed",
          { trigger },
        );
      }
      setOpen(nextOpen);
    },
    [open],
  );

  // Keyboard shortcut
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setDialogOpen(!open, "keyboard");
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, setDialogOpen]);

  const catalog = useQuery(api.tags.listCatalog);
  const normalizedQuery = query.trim();
  const hasTextQuery = normalizedQuery.length >= 2;
  const hasTagFilters = selectedTags.length > 0;
  const shouldSearch = hasTextQuery || hasTagFilters;

  const searchResults = useQuery(
    api.notes.searchWorkspace,
    shouldSearch
      ? {
          ...(hasTextQuery ? { query: normalizedQuery } : {}),
          tags: selectedTags,
          matchMode,
          limit: 50,
        }
      : "skip",
  );

  const availableTags = useMemo(
    () => catalog?.map((entry) => entry.tag) ?? [],
    [catalog],
  );

  useEffect(() => {
    if (!open) return;
    if (attemptedBackfillRef.current) return;
    if (!catalog || catalog.length > 0) return;
    attemptedBackfillRef.current = true;
    void backfillCatalog({ noteLimit: 1000 });
  }, [backfillCatalog, catalog, open]);

  const toggleTag = useCallback((tag: string) => {
    setSelectedTags((prev) => {
      const nextSelectedTags = prev.includes(tag)
        ? prev.filter((current) => current !== tag)
        : [...prev, tag];
      logInteraction("quick-search", "tag-filters-changed", {
        selectedTagCount: nextSelectedTags.length,
      });
      return nextSelectedTags;
    });
  }, []);

  const openAdvancedSearch = useCallback(
    (noteId?: string) => {
      const nextQuery = query.trim();
      const nextTags = normalizeTags(selectedTags);
      logInteraction("quick-search", "opened-advanced-search", {
        hasNoteId: !!noteId,
        hasQuery: nextQuery.length > 0,
        matchMode,
        selectedTagCount: nextTags.length,
      });
      void navigate({
        to: "/search",
        search: {
          q: nextQuery.length > 0 ? nextQuery : undefined,
          tags: nextTags.length > 0 ? nextTags.join(",") : undefined,
          mode: matchMode,
          noteId,
        },
      });
      setDialogOpen(false, "advanced-search");
    },
    [matchMode, navigate, query, selectedTags, setDialogOpen],
  );

  const jumpToSearchResultVerse = useCallback(
    (
      noteId: string,
      primaryRef: {
        book: string;
        chapter: number;
        startVerse: number;
        endVerse: number;
      } | null,
    ) => {
      if (!primaryRef) {
        openAdvancedSearch(noteId);
        return;
      }

      const passageId = toPassageId(primaryRef.book, primaryRef.chapter);
      const label = `${primaryRef.book} ${primaryRef.chapter}`;
      logInteraction("quick-search", "result-opened", {
        book: primaryRef.book,
        chapter: primaryRef.chapter,
        endVerse: primaryRef.endVerse,
        startVerse: primaryRef.startVerse,
      });
      openTab(passageId, label, {
        source: "search",
        mode: "read",
        startVerse: primaryRef.startVerse,
        endVerse: primaryRef.endVerse,
      });
      setDialogOpen(false, "result");
    },
    [openAdvancedSearch, openTab, setDialogOpen],
  );

  return (
    <>
      {showTrigger ? (
        <button
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-md border bg-muted/30 hover:bg-muted cursor-pointer"
          onClick={() => setDialogOpen(true, "button")}
        >
          <Search className="h-3.5 w-3.5" />
          <span>Search notes...</span>
          <kbd className="ml-auto text-xs bg-muted px-1.5 py-0.5 rounded">
            {searchShortcutLabel}
          </kbd>
        </button>
      ) : null}

      <Dialog
        open={open}
        onOpenChange={(nextOpen) => setDialogOpen(nextOpen, "dialog")}
      >
        <DialogContent
          className="sm:max-w-xl p-0 gap-0"
          data-passage-dismiss-exempt
        >
          <div className="flex items-center border-b px-3">
            <Search className="h-4 w-4 text-muted-foreground shrink-0" />
            <Input
              placeholder="Search notes..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  openAdvancedSearch();
                }
              }}
              className="border-0 focus-visible:ring-0 shadow-none"
              autoFocus
            />
          </div>

          {availableTags.length > 0 && (
            <div className="px-3 py-2 border-b space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Match
                </span>
                <div className="flex gap-1">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge
                        variant={matchMode === "any" ? "default" : "outline"}
                        className="text-xs cursor-pointer"
                        onClick={() => {
                          logInteraction("quick-search", "match-mode-changed", {
                            matchMode: "any",
                          });
                          setMatchMode("any");
                        }}
                      >
                        Any
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent>
                      Match notes containing any selected tag
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge
                        variant={matchMode === "all" ? "default" : "outline"}
                        className="text-xs cursor-pointer"
                        onClick={() => {
                          logInteraction("quick-search", "match-mode-changed", {
                            matchMode: "all",
                          });
                          setMatchMode("all");
                        }}
                      >
                        All
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent>
                      Match notes containing every selected tag
                    </TooltipContent>
                  </Tooltip>
                </div>
              </div>
              <TagFilterControl
                availableTags={availableTags}
                selectedTags={selectedTags}
                onToggleTag={toggleTag}
                onClear={() => {
                  logInteraction("quick-search", "tag-filters-cleared");
                  setSelectedTags([]);
                }}
                resolveTagStyle={resolveTagStyle}
                popoverDropdown
              />
            </div>
          )}

          <ScrollArea className="max-h-80 min-w-0">
            {!shouldSearch ? (
              <div className="p-6 text-center text-sm text-muted-foreground">
                Type at least 2 characters or choose one or more tags.
              </div>
            ) : searchResults === undefined ? (
              <div className="p-6 text-center text-sm text-muted-foreground">
                Searching...
              </div>
            ) : searchResults.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">
                {hasTagFilters
                  ? "No results match your selected tags."
                  : "No results found for that query."}
              </div>
            ) : (
              <div className="p-1 min-w-0 overflow-hidden">
                {searchResults.map((note, index) => (
                  <motion.div
                    key={note.noteId}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.15, delay: index * 0.03 }}
                  >
                    <button
                      className="w-full text-left px-3 py-2 rounded-sm hover:bg-muted transition-colors cursor-pointer"
                      onClick={() =>
                        jumpToSearchResultVerse(
                          String(note.noteId),
                          note.primaryRef,
                        )
                      }
                    >
                      <p className="text-sm line-clamp-2">
                        <HighlightedText
                          text={note.content}
                          query={normalizedQuery}
                        />
                      </p>
                      {note.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {note.tags.map((tag) => (
                            <Badge
                              key={tag}
                              variant="outline"
                              className="text-xs"
                              style={resolveTagStyle(tag)}
                            >
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </button>
                  </motion.div>
                ))}
              </div>
            )}
          </ScrollArea>
          <div className="border-t px-3 py-2">
            <button
              className="w-full rounded-md border bg-muted/30 px-3 py-1.5 text-sm text-left hover:bg-muted transition-colors cursor-pointer"
              onClick={() => openAdvancedSearch()}
            >
              Open advanced search
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
