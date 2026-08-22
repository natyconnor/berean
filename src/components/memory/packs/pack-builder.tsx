import { useCallback, useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useMutation, useQuery } from "convex/react";

import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useLiveNow } from "@/hooks/use-live-now";
import { useScopeHeartPreview } from "@/hooks/use-scope-heart-preview";
import { ScopeForm } from "@/components/study/scope-form";
import { useScopeForm } from "@/components/study/use-scope-form";
import { heartSpansInChunks } from "@/lib/heart-many-client";
import {
  heartScopeCoverageCopy,
  heartScopeDialogTitle,
  heartScopeHasExisting,
} from "@/lib/heart-scope-copy";
import { autoHeartAllowed } from "@/lib/scope-chapter-count";
import {
  coveredVerseCount,
  scopeCoverageComplete,
  scopeVerseSlots,
} from "@/lib/scope-verse-coverage";

import { PackVersePicker } from "./pack-verse-picker";
import { ScopeHeartPreview } from "./scope-heart-preview";
import {
  packVerseKey,
  type HeartedVerse,
  type PackableVerse,
} from "./pack-verse-types";

type PackKind = "scope" | "custom";

/**
 * Creates a pack: a name, a kind toggle (Scope vs Custom), and the matching
 * body. Scope packs embed the shared {@link ScopeForm} with a live member
 * preview; custom packs can stage hearted or browsed verses. On create
 * we navigate straight to the new pack's view.
 *
 * Scope packs that still have unhearted verses prompt once at create-time:
 * heart the gaps (or the whole scope) as memory units, or skip and heart later.
 */
export function PackBuilder() {
  const navigate = useNavigate();
  const now = useLiveNow();

  const [name, setName] = useState("");
  const [kind, setKind] = useState<PackKind>("scope");
  const [heartPromptOpen, setHeartPromptOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scopeForm = useScopeForm();
  const { scopeForPreview, summaryText } = scopeForm;

  const scopePreview = useQuery(
    api.packs.previewScopeCount,
    kind === "scope" ? { scope: scopeForPreview, now } : "skip",
  );

  const savedVerses = useQuery(api.savedVerses.listAll, {});
  const heartedVerses = useMemo<HeartedVerse[]>(
    () =>
      (savedVerses ?? []).map((v) => ({
        verseRefId: v.verseRefId,
        book: v.book,
        chapter: v.chapter,
        startVerse: v.startVerse,
        endVerse: v.endVerse,
        memory: v.memory
          ? {
              status: v.memory.status,
              dueAt: v.memory.dueAt,
              lastReviewedAt: v.memory.lastReviewedAt,
            }
          : undefined,
      })),
    [savedVerses],
  );

  const heartPreview = useScopeHeartPreview({
    scope: scopeForPreview,
    hearts: savedVerses === undefined ? null : heartedVerses,
    enabled: kind === "scope" && heartPromptOpen,
  });

  const [staged, setStaged] = useState<Map<string, PackableVerse>>(new Map());

  const toggleStaged = useCallback((verse: PackableVerse) => {
    setStaged((prev) => {
      const next = new Map(prev);
      const key = packVerseKey(verse);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.set(key, verse);
      }
      return next;
    });
  }, []);

  const createPack = useMutation(api.packs.create);
  const addVerse = useMutation(api.packs.addVerse);
  const heartMany = useMutation(api.savedVerses.heartMany);

  const trimmedName = name.trim();
  const effectiveName =
    trimmedName.length > 0
      ? trimmedName
      : kind === "scope"
        ? summaryText
        : "Custom pack";

  const covered =
    kind === "scope" ? coveredVerseCount(scopeForPreview, heartedVerses) : 0;
  const slots = kind === "scope" ? scopeVerseSlots(scopeForPreview) : 0;
  const hasExistingHearts = heartScopeHasExisting(covered);
  const shouldPromptHeart =
    kind === "scope" &&
    savedVerses !== undefined &&
    autoHeartAllowed(scopeForPreview) &&
    !scopeCoverageComplete(scopeForPreview, heartedVerses);

  const canCreate =
    !isCreating &&
    (kind === "scope"
      ? savedVerses !== undefined
      : staged.size > 0 || trimmedName.length > 0);

  const finishCreate = useCallback(
    async (heartProposed: boolean) => {
      if (isCreating) return;
      setIsCreating(true);
      setError(null);
      try {
        const packId: Id<"packs"> =
          kind === "scope"
            ? await createPack({
                name: effectiveName,
                kind: "scope",
                scope: scopeForPreview,
              })
            : await createPack({ name: effectiveName, kind: "custom" });

        // The pack now exists, so the user should always land on it — even if a
        // verse fails to add. Surface a non-blocking notice but still navigate.
        if (kind === "custom") {
          let addFailed = false;
          for (const verse of staged.values()) {
            try {
              await addVerse({
                id: packId,
                book: verse.book,
                chapter: verse.chapter,
                startVerse: verse.startVerse,
                endVerse: verse.endVerse,
              });
            } catch {
              addFailed = true;
            }
          }
          if (addFailed) {
            setError(
              "Some verses couldn't be added. You can add them from the pack.",
            );
          }
        }

        if (heartProposed && heartPreview.proposedSpans.length > 0) {
          const result = await heartSpansInChunks(
            heartMany,
            heartPreview.proposedSpans,
            now,
          );
          if (result.failedChunks > 0) {
            setError(
              "Some verses couldn't be hearted. You can heart them from the pack.",
            );
          }
        }

        setHeartPromptOpen(false);
        void navigate({ to: "/memory/$packId", params: { packId } });
      } catch {
        setError("Couldn't create the pack. Please try again.");
      } finally {
        setIsCreating(false);
      }
    },
    [
      isCreating,
      kind,
      createPack,
      effectiveName,
      scopeForPreview,
      staged,
      addVerse,
      heartPreview.proposedSpans,
      heartMany,
      now,
      navigate,
    ],
  );

  const handleCreateClick = useCallback(() => {
    if (isCreating) return;
    if (shouldPromptHeart) {
      setHeartPromptOpen(true);
      return;
    }
    void finishCreate(false);
  }, [finishCreate, isCreating, shouldPromptHeart]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <header className="shrink-0 border-b px-5 py-3">
        <Link
          to="/memory"
          className="mb-1 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Memory
        </Link>
        <h1 className="text-lg font-semibold tracking-tight">New pack</h1>
      </header>

      <ScrollArea className="min-h-0 flex-1">
        <div className="mx-auto max-w-2xl space-y-8 px-5 py-6">
          <section className="space-y-3">
            <div className="space-y-1">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Name
              </h2>
              <p className="text-xs text-muted-foreground">
                A label for this pack. Leave blank to use a generated name.
              </p>
            </div>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={
                kind === "scope" ? summaryText : "e.g. Sunday memory verses"
              }
              aria-label="Pack name"
            />
          </section>

          <section className="space-y-3">
            <div className="space-y-1">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Kind
              </h2>
              <p className="text-xs text-muted-foreground">
                Scope packs resolve their members live from hearted verses.
                Custom packs are a fixed, hand-picked, orderable set.
              </p>
            </div>
            <div className="flex gap-1.5">
              <Button
                size="sm"
                variant={kind === "scope" ? "secondary" : "outline"}
                onClick={() => setKind("scope")}
                aria-pressed={kind === "scope"}
              >
                Scope
              </Button>
              <Button
                size="sm"
                variant={kind === "custom" ? "secondary" : "outline"}
                onClick={() => setKind("custom")}
                aria-pressed={kind === "custom"}
              >
                Custom
              </Button>
            </div>
          </section>

          {kind === "scope" ? (
            <ScopeForm
              selectedBooks={scopeForm.selectedBooks}
              chapterRanges={scopeForm.chapterRanges}
              selectedTags={scopeForm.selectedTags}
              tagMatchMode={scopeForm.tagMatchMode}
              onToggleBook={scopeForm.onToggleBook}
              onSetBooks={scopeForm.onSetBooks}
              onSetChapterRange={scopeForm.onSetChapterRange}
              onSelectPreset={scopeForm.onSelectPreset}
              onToggleTag={scopeForm.onToggleTag}
              onClearTags={scopeForm.onClearTags}
              onSetTagMatchMode={scopeForm.onSetTagMatchMode}
              passageDescription="Choose which books and chapters this pack covers."
              showTagFilter={false}
            />
          ) : (
            <section className="space-y-3">
              <div className="space-y-1">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Verses
                </h2>
                <p className="text-xs text-muted-foreground">
                  Choose from hearted verses or browse the Bible. Added verses
                  are hearted for Memory.
                </p>
              </div>
              <PackVersePicker
                heartedVerses={heartedVerses}
                isLoadingHearted={savedVerses === undefined}
                isSelected={(verse) => staged.has(packVerseKey(verse))}
                onSelect={toggleStaged}
              />
            </section>
          )}
        </div>
      </ScrollArea>

      <footer className="shrink-0 border-t bg-muted/30 px-5 py-3">
        {error && (
          <p
            className="mx-auto mb-2 max-w-2xl text-sm text-destructive"
            role="alert"
          >
            {error}
          </p>
        )}
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{effectiveName}</p>
            <p className="text-xs text-muted-foreground">
              {kind === "scope"
                ? scopePreview
                  ? `${scopePreview.verseCount} verse${
                      scopePreview.verseCount !== 1 ? "s" : ""
                    }${
                      scopePreview.dueCount > 0
                        ? ` · ${scopePreview.dueCount} due`
                        : ""
                    }`
                  : "Counting…"
                : `${staged.size} verse${staged.size !== 1 ? "s" : ""} selected`}
            </p>
          </div>
          <Button onClick={handleCreateClick} disabled={!canCreate}>
            {isCreating ? "Creating\u2026" : "Create pack"}
          </Button>
        </div>
      </footer>

      <Dialog
        open={heartPromptOpen}
        onOpenChange={(open) => {
          if (!isCreating) setHeartPromptOpen(open);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {heartScopeDialogTitle(hasExistingHearts)}
            </DialogTitle>
            <DialogDescription>
              {heartScopeCoverageCopy(covered, slots)}
            </DialogDescription>
          </DialogHeader>
          <ScopeHeartPreview
            variant="compact"
            scopeLabel={summaryText}
            preview={heartPreview}
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => void finishCreate(false)}
              disabled={isCreating}
            >
              Create without hearting
            </Button>
            <Button
              onClick={() => void finishCreate(true)}
              disabled={
                isCreating ||
                heartPreview.loading ||
                Boolean(heartPreview.error) ||
                heartPreview.proposedCount === 0
              }
            >
              {isCreating
                ? "Hearting\u2026"
                : heartPreview.loading
                  ? "Preparing\u2026"
                  : `Heart ${heartPreview.proposedCount} new unit${
                      heartPreview.proposedCount === 1 ? "" : "s"
                    }`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
