import { useCallback, useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, BookOpen, PackagePlus } from "lucide-react";
import { useMutation, useQuery } from "convex/react";

import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useLiveNow } from "@/hooks/use-live-now";
import { ScopeForm } from "@/components/study/scope-form";
import { useScopeForm } from "@/components/study/use-scope-form";

import {
  CREATE_AND_MEMORIZE_WHOLE_TOOLTIP,
  CREATE_PACK_TOOLTIP,
  packBuilderStartPassageLabel,
} from "@/lib/heart-scope-copy";
import { memoryPackSearchAfterCreate } from "@/lib/memory-pack-search";
import { packAllowsPassageMode } from "@/lib/passage-eligibility";
import { cn } from "@/lib/utils";

import { PackVersePicker } from "./pack-verse-picker";
import {
  packVerseKey,
  type HeartedVerse,
  type PackableVerse,
} from "./pack-verse-types";

type PackKind = "scope" | "custom";
type BuilderStep = "type" | "content" | "name";

const STEPS: { id: BuilderStep; label: string }[] = [
  { id: "type", label: "Type" },
  { id: "content", label: "Choose" },
  { id: "name", label: "Name" },
];

/**
 * Creates a pack as a short wizard: type → scope or verses → name and create.
 * Eligible scopes can create-and-start passage learning from the last step.
 */
export function PackBuilder() {
  const navigate = useNavigate();
  const now = useLiveNow();

  const [step, setStep] = useState<BuilderStep>("type");
  const [name, setName] = useState("");
  const [kind, setKind] = useState<PackKind>("scope");
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scopeForm = useScopeForm({ requireChapterSelection: true });
  const { scopeForPreview, summaryText, isComplete } = scopeForm;

  const scopePreview = useQuery(
    api.packs.previewScopeCount,
    kind === "scope" && isComplete ? { scope: scopeForPreview, now } : "skip",
  );

  const savedVerses = useQuery(
    api.savedVerses.listAll,
    kind === "custom" ? {} : "skip",
  );
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

  const trimmedName = name.trim();
  const effectiveName =
    trimmedName.length > 0
      ? trimmedName
      : kind === "scope"
        ? summaryText
        : "Custom pack";

  const canCreate =
    !isCreating &&
    (kind === "scope" ? isComplete : staged.size > 0 || trimmedName.length > 0);

  const allowsPassage =
    kind === "scope" && packAllowsPassageMode(scopeForPreview);
  const startPassageLabel = packBuilderStartPassageLabel(allowsPassage);

  const canContinueFromContent =
    kind === "scope" ? isComplete : staged.size > 0;

  const contentSummary =
    kind === "scope"
      ? !isComplete
        ? "Select chapters to continue"
        : scopePreview
          ? `${scopePreview.verseCount} verse${
              scopePreview.verseCount !== 1 ? "s" : ""
            }${
              scopePreview.dueCount > 0 ? ` · ${scopePreview.dueCount} due` : ""
            }`
          : "Counting…"
      : `${staged.size} verse${staged.size !== 1 ? "s" : ""} selected`;

  const handleCreate = useCallback(
    async (options?: { startPassage?: boolean }) => {
      if (isCreating) return;
      if (kind === "scope" && !isComplete) return;
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

        void navigate({
          to: "/memory/$packId",
          params: { packId },
          search: memoryPackSearchAfterCreate({
            kind,
            allowsPassage,
            startPassage: options?.startPassage,
          }),
        });
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
      navigate,
      isComplete,
      allowsPassage,
    ],
  );

  function goBack() {
    if (step === "content") setStep("type");
    else if (step === "name") setStep("content");
  }

  function goNext() {
    if (step === "type") setStep("content");
    else if (step === "content" && canContinueFromContent) setStep("name");
  }

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
        <nav
          className="mt-3 flex flex-wrap items-center gap-2"
          aria-label="Pack creation steps"
        >
          {STEPS.map((item, index) => {
            const active = item.id === step;
            const reached =
              STEPS.findIndex((entry) => entry.id === step) >= index;
            const label =
              item.id === "content"
                ? kind === "scope"
                  ? "Scope"
                  : "Verses"
                : item.label;
            return (
              <div key={item.id} className="flex items-center gap-2">
                {index > 0 ? (
                  <span className="text-muted-foreground" aria-hidden>
                    /
                  </span>
                ) : null}
                <span
                  className={cn(
                    "text-xs font-medium uppercase tracking-wide",
                    active
                      ? "text-foreground"
                      : reached
                        ? "text-muted-foreground"
                        : "text-muted-foreground/60",
                  )}
                  aria-current={active ? "step" : undefined}
                >
                  {index + 1}. {label}
                </span>
              </div>
            );
          })}
        </nav>
      </header>

      <ScrollArea className="min-h-0 flex-1">
        <div className="mx-auto max-w-2xl space-y-8 px-5 py-6">
          {step === "type" ? (
            <section className="space-y-4">
              <div className="space-y-1">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Type
                </h2>
                <p className="text-sm text-muted-foreground">
                  What kind of pack are you making?
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <TypeChoice
                  title="Scope"
                  description="A book or chapter range. Verses come from what you heart inside that range."
                  selected={kind === "scope"}
                  onSelect={() => setKind("scope")}
                />
                <TypeChoice
                  title="Custom"
                  description="A fixed list of verses you pick one by one."
                  selected={kind === "custom"}
                  onSelect={() => setKind("custom")}
                />
              </div>
            </section>
          ) : null}

          {step === "content" ? (
            kind === "scope" ? (
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
                emptyChapterSelection
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
            )
          ) : null}

          {step === "name" ? (
            <section className="space-y-6">
              <div className="space-y-3">
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
              </div>
              <div className="rounded-xl border bg-card px-4 py-3 text-sm">
                <p className="font-medium">{effectiveName}</p>
                <p className="mt-1 text-muted-foreground">{contentSummary}</p>
                <p className="mt-1 text-muted-foreground">
                  {kind === "scope" ? "Scope pack" : "Custom pack"}
                </p>
              </div>
            </section>
          ) : null}

          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}

          <div className="flex flex-wrap items-center gap-2 border-t pt-5">
            {step !== "type" ? (
              <Button type="button" variant="outline" onClick={goBack}>
                Back
              </Button>
            ) : null}
            <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
              {step === "type" ? (
                <Button type="button" onClick={goNext} className="gap-1.5">
                  Continue
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Button>
              ) : null}
              {step === "content" ? (
                <Button
                  type="button"
                  onClick={goNext}
                  disabled={!canContinueFromContent}
                  className="gap-1.5"
                >
                  Continue
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Button>
              ) : null}
              {step === "name" ? (
                <>
                  {startPassageLabel ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() =>
                            void handleCreate({ startPassage: true })
                          }
                          disabled={!canCreate}
                          className="gap-1.5"
                        >
                          <BookOpen className="h-4 w-4" aria-hidden />
                          {startPassageLabel}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        {CREATE_AND_MEMORIZE_WHOLE_TOOLTIP}
                      </TooltipContent>
                    </Tooltip>
                  ) : null}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        onClick={() => void handleCreate()}
                        disabled={!canCreate}
                        className="gap-1.5"
                      >
                        <PackagePlus className="h-4 w-4" aria-hidden />
                        {isCreating ? "Creating\u2026" : "Create pack"}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      {CREATE_PACK_TOOLTIP}
                    </TooltipContent>
                  </Tooltip>
                </>
              ) : null}
            </div>
            {step === "content" && !canContinueFromContent ? (
              <p className="basis-full text-xs text-muted-foreground">
                {kind === "scope"
                  ? "Select chapters to continue"
                  : "Select at least one verse to continue"}
              </p>
            ) : null}
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}

function TypeChoice({
  title,
  description,
  selected,
  onSelect,
}: {
  title: string;
  description: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "rounded-xl border px-4 py-4 text-left transition-colors",
        selected
          ? "border-primary bg-primary/5 shadow-sm"
          : "border-border bg-card hover:bg-muted/40",
      )}
    >
      <p className="text-sm font-semibold">{title}</p>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">
        {description}
      </p>
    </button>
  );
}
