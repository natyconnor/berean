import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Dumbbell,
  Loader2,
  Pencil,
  Play,
  Plus,
  SearchX,
  Trash2,
  X,
} from "lucide-react";
import { useMutation, useQuery } from "convex/react";
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
import { cn } from "@/lib/utils";
import { useLiveNow } from "@/hooks/use-live-now";
import type { MemoryStatus } from "@/lib/memory-scheduler";
import { formatVerseRef } from "@/lib/verse-ref-utils";

import { PracticeBoard, type PracticeVerse } from "../practice/practice-board";
import { ReviewPlayer, type ReviewItem } from "../review-player";
import { HeartedVersePicker, type HeartedVerse } from "./hearted-verse-picker";

const STATUS_STYLES: Record<MemoryStatus, { label: string; dot: string }> = {
  new: { label: "New", dot: "bg-[var(--chart-3)]" },
  learning: { label: "Learning", dot: "bg-[var(--chart-4)]" },
  reviewing: { label: "Reviewing", dot: "bg-[var(--chart-1)]" },
  mastered: { label: "Mastered", dot: "bg-[var(--chart-2)]" },
};

function formatDueLabel(dueAt: number, now: number): string {
  const diff = dueAt - now;
  if (diff <= 0) return "Due now";
  const days = Math.round(diff / (24 * 60 * 60 * 1000));
  if (days <= 0) return "Due today";
  if (days === 1) return "Tomorrow";
  return `In ${days} days`;
}

/**
 * A single pack: header + counts, its resolved members, and Review (the due
 * subset, via {@link ReviewPlayer}) + Practice (all members, via
 * {@link PracticeBoard}) actions. Custom packs additionally support
 * add / remove / reorder of their hand-picked membership.
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

  const [isReviewing, setIsReviewing] = useState(false);
  const [isPracticing, setIsPracticing] = useState(false);

  const dueMembers = useMemo(
    () => (members ?? []).filter((m) => m.isDue),
    [members],
  );
  const reviewDueItems = useMemo<ReviewItem[]>(
    () =>
      members === undefined
        ? []
        : dueMembers.map((m) => ({
            verseRefId: m.verseRefId,
            book: m.book,
            chapter: m.chapter,
            startVerse: m.startVerse,
            endVerse: m.endVerse,
            status: m.status,
            learnStage: m.learnStage,
          })),
    [members, dueMembers],
  );
  const practiceVerses = useMemo<PracticeVerse[]>(
    () =>
      (members ?? []).map((m) => ({
        reference: {
          book: m.book,
          chapter: m.chapter,
          startVerse: m.startVerse,
          endVerse: m.endVerse,
        },
        learnStage: m.learnStage,
        stageReps: m.stageReps ?? 0,
        status: m.status,
      })),
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

  if (isReviewing) {
    return (
      <ReviewPlayer
        title={pack.name}
        backLabel="Pack"
        source={{
          dueItems: members === undefined ? undefined : reviewDueItems,
          remainingDue: members === undefined ? undefined : dueMembers.length,
        }}
        onExit={() => setIsReviewing(false)}
      />
    );
  }

  if (isPracticing) {
    return (
      <PracticeBoard
        verses={practiceVerses}
        onExit={() => setIsPracticing(false)}
      />
    );
  }

  return (
    <PackViewMain
      packId={packId}
      pack={pack}
      members={members}
      now={now}
      dueCount={dueMembers.length}
      onReview={() => setIsReviewing(true)}
      onPractice={() => setIsPracticing(true)}
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
  onReview,
  onPractice,
  onDeleted,
}: {
  packId: Id<"packs">;
  pack: Pack;
  members: Member[] | undefined;
  now: number;
  dueCount: number;
  onReview: () => void;
  onPractice: () => void;
  onDeleted: () => void;
}) {
  const isCustom = pack.kind === "custom";
  const verseCount = members?.length ?? 0;

  const rename = useMutation(api.packs.rename);
  const remove = useMutation(api.packs.remove);
  const addVerse = useMutation(api.packs.addVerse);
  const removeVerse = useMutation(api.packs.removeVerse);
  const reorder = useMutation(api.packs.reorder);

  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState(pack.name);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [pendingVerseId, setPendingVerseId] = useState<Id<"verseRefs"> | null>(
    null,
  );

  const memberRefIds = useMemo(
    () => new Set((members ?? []).map((m) => String(m.verseRefId))),
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
    async (verse: HeartedVerse) => {
      if (pendingVerseId) return;
      setPendingVerseId(verse.verseRefId);
      try {
        await addVerse({
          id: packId,
          book: verse.book,
          chapter: verse.chapter,
          startVerse: verse.startVerse,
          endVerse: verse.endVerse,
        });
      } finally {
        setPendingVerseId(null);
      }
    },
    [addVerse, packId, pendingVerseId],
  );

  const handleRemove = useCallback(
    async (verseRefId: Id<"verseRefs">) => {
      await removeVerse({ id: packId, verseRefId });
    },
    [removeVerse, packId],
  );

  const handleMove = useCallback(
    async (index: number, direction: "up" | "down") => {
      if (!members) return;
      const ids = members.map((m) => m.verseRefId);
      const j = direction === "up" ? index - 1 : index + 1;
      if (j < 0 || j >= ids.length) return;
      [ids[index], ids[j]] = [ids[j], ids[index]];
      await reorder({ id: packId, orderedVerseRefIds: ids });
    },
    [members, reorder, packId],
  );

  const canReview = dueCount > 0;
  const canPractice = verseCount > 0;

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
            Review{dueCount > 0 ? ` (${dueCount})` : ""}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={onPractice}
            disabled={!canPractice}
          >
            <Dumbbell className="h-4 w-4" aria-hidden />
            Practice
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
              {isCustom && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 gap-1.5"
                  onClick={() => setAddOpen(true)}
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden />
                  Add verses
                </Button>
              )}
            </div>

            {members === undefined ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : members.length === 0 ? (
              <div className="rounded-xl border bg-card px-4 py-10 text-center">
                <p className="text-sm text-muted-foreground">
                  {isCustom
                    ? "No verses yet. Add hearted verses to build this pack."
                    : "No hearted verses match this scope yet. Heart matching verses and they'll appear here."}
                </p>
              </div>
            ) : (
              <ul className="space-y-1.5">
                {members.map((member, index) => {
                  const style = STATUS_STYLES[member.status];
                  return (
                    <li
                      key={member.verseRefId}
                      className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2.5"
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
                          {style.label} · {formatDueLabel(member.dueAt, now)}
                        </span>
                      </span>
                      {isCustom && (
                        <span className="flex shrink-0 items-center gap-0.5">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            disabled={index === 0}
                            onClick={() => void handleMove(index, "up")}
                            aria-label={`Move ${formatVerseRef(member)} up`}
                          >
                            <ChevronUp className="h-4 w-4" aria-hidden />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            disabled={index === members.length - 1}
                            onClick={() => void handleMove(index, "down")}
                            aria-label={`Move ${formatVerseRef(member)} down`}
                          >
                            <ChevronDown className="h-4 w-4" aria-hidden />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                            onClick={() => void handleRemove(member.verseRefId)}
                            aria-label={`Remove ${formatVerseRef(member)}`}
                          >
                            <X className="h-4 w-4" aria-hidden />
                          </Button>
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      </ScrollArea>

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

      {isCustom && (
        <AddVersesDialog
          open={addOpen}
          onOpenChange={setAddOpen}
          memberRefIds={memberRefIds}
          pendingVerseId={pendingVerseId}
          onAdd={handleAdd}
        />
      )}
    </div>
  );
}

function AddVersesDialog({
  open,
  onOpenChange,
  memberRefIds,
  pendingVerseId,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  memberRefIds: Set<string>;
  pendingVerseId: Id<"verseRefs"> | null;
  onAdd: (verse: HeartedVerse) => void;
}) {
  // Only load hearted verses while the dialog is open.
  const savedVerses = useQuery(api.savedVerses.listAll, open ? {} : "skip");
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
          <DialogTitle>Add verses</DialogTitle>
          <DialogDescription>
            Pick from your hearted verses. Adding a verse hearts it if it
            isn&apos;t already.
          </DialogDescription>
        </DialogHeader>
        <HeartedVersePicker
          verses={heartedVerses}
          isLoading={open && savedVerses === undefined}
          isSelected={(id) => memberRefIds.has(String(id))}
          isDisabled={(id) => memberRefIds.has(String(id))}
          isPending={(id) => pendingVerseId === id}
          onSelect={onAdd}
        />
      </DialogContent>
    </Dialog>
  );
}
