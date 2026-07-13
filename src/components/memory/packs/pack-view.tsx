import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  Dumbbell,
  Loader2,
  Pencil,
  Play,
  Plus,
  SearchX,
  Trash2,
  X,
} from "lucide-react";
import { useMutation } from "convex/react";
import { useQuery } from "convex-helpers/react/cache";
import type { FunctionReturnType } from "convex/server";

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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useLiveNow } from "@/hooks/use-live-now";
import { formatMemoryStatusSubtitle } from "@/lib/memory-due-label";
import { MEMORY_STATUS_STYLE } from "@/lib/memory-status-style";
import { MemoryListItem } from "@/components/memory/memory-surface";
import { memoryPracticeSearch } from "@/lib/memory-practice-search";
import { memoryReviewSearch } from "@/lib/memory-review-search";
import { formatVerseRef } from "@/lib/verse-ref-utils";
import type { PracticeVerse } from "@/components/memory/practice/practice-board";
import { VerseDetail } from "@/components/memory/verse-detail";

import { PackVersePicker } from "./pack-verse-picker";
import {
  packVerseKey,
  type HeartedVerse,
  type PackableVerse,
} from "./pack-verse-types";

/**
 * A single pack: header + counts, its resolved members, and Review / Practice
 * actions that navigate to `/memory/$packId/review` and
 * `/memory/$packId/practice`. Custom packs additionally support add / remove
 * of their hand-picked membership.
 */
export function PackView({ packId }: { packId: Id<"packs"> }) {
  const now = useLiveNow();
  const navigate = useNavigate();

  const pack = useQuery(api.packs.get, { id: packId });
  const members = useQuery(api.packs.resolveMembers, { id: packId, now });
  const touch = useMutation(api.packs.touch);

  const hasTouched = useRef(false);
  useEffect(() => {
    if (pack && !hasTouched.current) {
      hasTouched.current = true;
      void touch({ id: packId });
    }
  }, [pack, packId, touch]);

  const dueMembers = useMemo(
    () => (members ?? []).filter((m) => m.isDue),
    [members],
  );

  if (pack === undefined) {
    return (
      <div className="flex h-full items-center justify-center bg-background">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (pack === null) {
    return (
      <div className="flex h-full items-center justify-center bg-background px-6">
        <div className="max-w-sm space-y-3 text-center">
          <SearchX
            aria-hidden
            className="mx-auto h-8 w-8 text-muted-foreground/70"
          />
          <h1 className="text-base font-semibold tracking-tight">
            Pack not found
          </h1>
          <p className="text-sm text-muted-foreground">
            This pack may have been deleted, or the link points at a pack that
            isn&apos;t yours.
          </p>
          <Link
            to="/memory"
            className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Memory
          </Link>
        </div>
      </div>
    );
  }

  return (
    <PackViewMain
      packId={packId}
      pack={pack}
      members={members}
      now={now}
      dueCount={dueMembers.length}
      onBack={() => void navigate({ to: "/memory" })}
      onReview={() =>
        void navigate({
          to: "/memory/$packId/review",
          params: { packId },
        })
      }
      onPractice={() =>
        void navigate({
          to: "/memory/$packId/practice",
          params: { packId },
        })
      }
      onPracticeVerse={(verse) =>
        void navigate({
          to: "/memory/practice",
          search: memoryPracticeSearch(verse.reference),
        })
      }
      onReviewVerse={(verse) =>
        void navigate({
          to: "/memory/review",
          search: memoryReviewSearch(verse.reference),
        })
      }
      onDeleted={() => void navigate({ to: "/memory" })}
    />
  );
}

type Pack = NonNullable<FunctionReturnType<typeof api.packs.get>>;
type Member = FunctionReturnType<typeof api.packs.resolveMembers>[number];

function PackViewMain({
  packId,
  pack,
  members,
  now,
  dueCount,
  onBack,
  onReview,
  onPractice,
  onPracticeVerse,
  onReviewVerse,
  onDeleted,
}: {
  packId: Id<"packs">;
  pack: Pack;
  members: Member[] | undefined;
  now: number;
  dueCount: number;
  onBack: () => void;
  onReview: () => void;
  onPractice: () => void;
  onPracticeVerse: (verse: PracticeVerse) => void;
  onReviewVerse: (verse: PracticeVerse) => void;
  onDeleted: () => void;
}) {
  const isCustom = pack.kind === "custom";
  const verseCount = members?.length ?? 0;

  const rename = useMutation(api.packs.rename);
  const remove = useMutation(api.packs.remove);
  const addVerse = useMutation(api.packs.addVerse);
  const removeVerse = useMutation(api.packs.removeVerse);

  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState(pack.name);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [selectedVerseRefId, setSelectedVerseRefId] =
    useState<Id<"verseRefs"> | null>(null);
  const [pendingVerseKey, setPendingVerseKey] = useState<string | null>(null);

  const memberRefIds = useMemo(
    () => new Set((members ?? []).map((m) => String(m.verseRefId))),
    [members],
  );
  const memberRefKeys = useMemo(
    () => new Set((members ?? []).map((m) => packVerseKey(m))),
    [members],
  );

  const handleRename = useCallback(async () => {
    const next = renameValue.trim();
    if (next.length === 0 || next === pack.name) {
      setRenameOpen(false);
      return;
    }
    await rename({ id: packId, name: next });
    setRenameOpen(false);
  }, [renameValue, pack.name, rename, packId]);

  const handleDelete = useCallback(async () => {
    setIsDeleting(true);
    try {
      await remove({ id: packId });
      onDeleted();
    } finally {
      setIsDeleting(false);
    }
  }, [remove, packId, onDeleted]);

  const handleAdd = useCallback(
    async (verse: PackableVerse) => {
      if (pendingVerseKey) return;
      const key = packVerseKey(verse);
      setPendingVerseKey(key);
      try {
        await addVerse({
          id: packId,
          book: verse.book,
          chapter: verse.chapter,
          startVerse: verse.startVerse,
          endVerse: verse.endVerse,
        });
      } finally {
        setPendingVerseKey(null);
      }
    },
    [addVerse, packId, pendingVerseKey],
  );

  const handleRemove = useCallback(
    async (verseRefId: Id<"verseRefs">) => {
      await removeVerse({ id: packId, verseRefId });
    },
    [removeVerse, packId],
  );

  const canReview = dueCount > 0;
  const canPractice = verseCount > 0;

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <header className="shrink-0 border-b px-5 py-3">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={onBack}
              className="-ml-2 mb-1 shrink-0 gap-1.5"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden />
              Back
            </Button>
          </TooltipTrigger>
          <TooltipContent>Go back to Memory</TooltipContent>
        </Tooltip>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold tracking-tight">
              {pack.name}
            </h1>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {isCustom ? "Custom" : "Scope"} · {verseCount} verse
              {verseCount !== 1 ? "s" : ""}
              {dueCount > 0 ? ` · ${dueCount} due` : ""}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => {
                setRenameValue(pack.name);
                setRenameOpen(true);
              }}
              aria-label="Rename pack"
            >
              <Pencil className="h-4 w-4" aria-hidden />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
              onClick={() => setDeleteOpen(true)}
              aria-label="Delete pack"
            >
              <Trash2 className="h-4 w-4" aria-hidden />
            </Button>
          </div>
        </div>
        <div className="mt-3 flex gap-2">
          <Button
            size="sm"
            className="gap-1.5"
            onClick={onReview}
            disabled={!canReview}
          >
            <Play className="h-4 w-4" aria-hidden />
            Review
            {dueCount > 0 ? (
              <span className="ml-0.5 inline-flex min-w-5 items-center justify-center rounded-full bg-primary-foreground px-1.5 py-0.5 text-[11px] font-semibold leading-none text-primary tabular-nums">
                {dueCount}
              </span>
            ) : null}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={onPractice}
            disabled={!canPractice}
          >
            <Dumbbell className="h-4 w-4" aria-hidden />
            Practice Pack
          </Button>
        </div>
      </header>

      <ScrollArea className="min-h-0 flex-1">
        <div className="mx-auto max-w-2xl px-5 py-6">
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Verses
              </h2>
              <Button
                size="sm"
                variant="outline"
                className="h-7 gap-1.5"
                onClick={() => setAddOpen(true)}
              >
                <Plus className="h-3.5 w-3.5" aria-hidden />
                Add verses
              </Button>
            </div>

            {members === undefined ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : members.length === 0 ? (
              <div className="rounded-xl border bg-card px-4 py-10 text-center">
                <p className="text-sm text-muted-foreground">
                  {isCustom
                    ? "No verses yet. Add a verse by reference, from your hearted list, or by browsing."
                    : "No verses yet. Heart verses within this scope — from here or in the reader — and they'll appear automatically."}
                </p>
              </div>
            ) : (
              <ul className="space-y-1.5">
                {members.map((member) => {
                  const style = MEMORY_STATUS_STYLE[member.status];
                  return (
                    <MemoryListItem
                      key={member.verseRefId}
                      className="flex items-center gap-2 px-3 py-2.5"
                    >
                      <button
                        type="button"
                        onClick={() => setSelectedVerseRefId(member.verseRefId)}
                        className="flex min-w-0 flex-1 items-center gap-2 text-left"
                      >
                        <span
                          aria-hidden
                          className={cn(
                            "h-2 w-2 shrink-0 rounded-full",
                            style.dot,
                          )}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">
                            {formatVerseRef(member)}
                          </span>
                          <span className="block text-xs text-muted-foreground">
                            {formatMemoryStatusSubtitle({
                              status: member.status,
                              statusLabel: style.label,
                              dueAt: member.dueAt,
                              now,
                            })}
                          </span>
                        </span>
                      </button>
                      {isCustom && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                          onClick={() => void handleRemove(member.verseRefId)}
                          aria-label={`Remove ${formatVerseRef(member)}`}
                        >
                          <X className="h-4 w-4" aria-hidden />
                        </Button>
                      )}
                    </MemoryListItem>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      </ScrollArea>

      <Dialog
        open={selectedVerseRefId !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedVerseRefId(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Verse detail</DialogTitle>
          </DialogHeader>
          {selectedVerseRefId !== null ? (
            <VerseDetail
              verseRefId={selectedVerseRefId}
              now={now}
              onPractice={(verse) => {
                setSelectedVerseRefId(null);
                onPracticeVerse(verse);
              }}
              onReview={(verse) => {
                setSelectedVerseRefId(null);
                onReviewVerse(verse);
              }}
            />
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename pack</DialogTitle>
          </DialogHeader>
          <Input
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void handleRename();
              }
            }}
            aria-label="Pack name"
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void handleRename()}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete pack?</DialogTitle>
            <DialogDescription>
              This removes the pack “{pack.name}”. Your hearted verses and
              memory history are kept — only the pack (and its membership) is
              deleted.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteOpen(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => void handleDelete()}
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting\u2026" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AddVersesDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        memberRefIds={memberRefIds}
        memberRefKeys={memberRefKeys}
        pendingVerseKey={pendingVerseKey}
        scope={pack.kind === "scope" ? pack.scope : undefined}
        onAdd={handleAdd}
      />
    </div>
  );
}

function AddVersesDialog({
  open,
  onOpenChange,
  memberRefIds,
  memberRefKeys,
  pendingVerseKey,
  scope,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  memberRefIds: Set<string>;
  memberRefKeys: Set<string>;
  pendingVerseKey: string | null;
  scope?: Pack["scope"];
  onAdd: (verse: PackableVerse) => void;
}) {
  // Only load hearted verses while the dialog is open — and never for scope
  // packs, whose "add" flow is purely about hearting *new* verses in the scope
  // (a hearted list would just re-list verses already in the pack).
  const savedVerses = useQuery(
    api.savedVerses.listAll,
    open && !scope ? {} : "skip",
  );
  const heartedVerses = useMemo<HeartedVerse[]>(
    () =>
      (savedVerses ?? []).map((v) => ({
        verseRefId: v.verseRefId,
        book: v.book,
        chapter: v.chapter,
        startVerse: v.startVerse,
        endVerse: v.endVerse,
      })),
    [savedVerses],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {scope ? "Heart verses in scope" : "Add verses"}
          </DialogTitle>
          <DialogDescription>
            {scope
              ? "Type a reference or browse within this pack's scope. Verses you heart here join the pack automatically."
              : "Type a reference, pick from hearted verses, or browse. Added verses are hearted for Memory."}
          </DialogDescription>
        </DialogHeader>
        <PackVersePicker
          heartedVerses={heartedVerses}
          isLoadingHearted={open && !scope && savedVerses === undefined}
          scope={scope}
          isSelected={(verse) =>
            (verse.verseRefId !== undefined &&
              memberRefIds.has(String(verse.verseRefId))) ||
            memberRefKeys.has(packVerseKey(verse))
          }
          isDisabled={(verse) =>
            (verse.verseRefId !== undefined &&
              memberRefIds.has(String(verse.verseRefId))) ||
            memberRefKeys.has(packVerseKey(verse))
          }
          isPending={(verse) => pendingVerseKey === packVerseKey(verse)}
          onSelect={onAdd}
        />
      </DialogContent>
    </Dialog>
  );
}
