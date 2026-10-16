import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  BookOpen,
  CircleStop,
  Dumbbell,
  GraduationCap,
  Heart,
  MoreHorizontal,
  Pencil,
  Play,
  Plus,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { useMutation } from "convex/react";
import { useQuery } from "convex-helpers/react/cache";
import type { FunctionReturnType } from "convex/server";
import { toast } from "sonner";

import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { useMemoryPanelFrame } from "@/components/memory/drawer/memory-panel-context";
import { MemoryPanelFrame } from "@/components/memory/drawer/memory-panel-frame";
import { InternalLink } from "@/components/memory/internal-link";
import { FRONTIER_LOCKED_COPY } from "@/components/memory/passage/passage-session-model";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useEsvReference } from "@/hooks/use-esv-reference";
import { useLiveNow } from "@/hooks/use-live-now";
import { useStartPassage } from "@/hooks/use-start-passage";
import { useSubmitLock } from "@/hooks/use-submit-lock";
import {
  EXTRA_PRACTICE_TOOLTIP,
  PRACTICE_ANYTIME_LABEL,
  learnActionLabel,
  todayStepParts,
} from "@/lib/memory-copy";
import type { VerseSpan } from "@/lib/hearted-verse-coverage";
import { MAX_PACK_NAME_LENGTH, spanKey } from "@/lib/memorize-status";
import { spanDisplayTitle } from "@/lib/memorize-target";
import { withReturn } from "@/lib/memory-return";
import { isDueForReview } from "@/lib/memory-scheduler";
import {
  memoryPackSessionHref,
  memoryTodaySessionHref,
  memoryVerseSessionHref,
  type MemorySessionKind,
} from "@/lib/memory-session-path";
import { MEMORY_STATUS_STYLE } from "@/lib/memory-status-style";
import {
  offersLearnAsPassage,
  packDetailActions,
  packDetailGoal,
  packDetailProgress,
  packDetailSubtitle,
  packMemberRow,
  passageDetailActions,
  passageDetailProgress,
  passageVerseRows,
  reviewTogetherOption,
  type PackDetailActions,
  type PackDetailPack,
  type PackDetailProgress,
  type PackDetailSession,
  type PassageVerseChipKind,
  type PassageVerseRow,
  type ProgressBar,
  type ReviewTogetherOption,
} from "@/lib/pack-detail-model";
import { moveItem, orderByKeys } from "@/lib/pack-order";
import { PASSAGE_MAX_ADDS_PER_DAY } from "@/lib/passage-frontier";
import { cn } from "@/lib/utils";
import {
  formatBookChapter,
  formatVerseRefTitle,
  toPassageId,
} from "@/lib/verse-ref-utils";
import type { PassageRange } from "@/lib/passage-range";
import type { VerseScope } from "@/lib/verse-scope-match";
import { getViewerTimeZone } from "@/lib/viewer-timezone";

import { EnableUnifiedReviewDialog } from "./enable-unified-review-dialog";
import { DragHandle, MoveAnnouncer, RowEditControls } from "./reorder-controls";
import {
  dragRowClassName,
  moveAnnouncement,
  useDragReorder,
} from "./use-drag-reorder";
import { VerseSearchAdd } from "./verse-search-add";

type Pack = NonNullable<FunctionReturnType<typeof api.packs.get>>;
type Member = FunctionReturnType<typeof api.packs.resolveMembers>[number];
type Passage = NonNullable<
  FunctionReturnType<typeof api.passageMemory.getForPack>
>;

const sectionHeadingClassName =
  "text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground";

/**
 * One passage or pack, in a drawer over Today or on its full page: the one
 * main action for its state, progress, and every verse with its own sessions.
 * Session links return to wherever this is shown.
 */
export function PackDetail({ packId }: { packId: Id<"packs"> }) {
  const now = useLiveNow();
  const tzOffsetMinutes = new Date(now).getTimezoneOffset();
  const pack = useQuery(api.packs.get, { id: packId });
  const members = useQuery(api.packs.resolveMembers, { id: packId, now });
  const passage = useQuery(api.passageMemory.getForPack, {
    packId,
    now,
    tzOffsetMinutes,
  });

  const touch = useMutation(api.packs.touch);
  const touched = useRef(false);
  useEffect(() => {
    if (!pack || touched.current) return;
    touched.current = true;
    void touch({ id: packId });
  }, [pack, packId, touch]);

  if (pack === null) {
    return (
      <MemoryPanelFrame title="Not found">
        <p className="py-6 text-sm text-muted-foreground">
          We couldn&apos;t find this passage or pack. It may have been removed.
        </p>
      </MemoryPanelFrame>
    );
  }

  if (pack === undefined || members === undefined || passage === undefined) {
    return (
      <MemoryPanelFrame
        title={
          <>
            <span
              aria-hidden
              className="inline-block h-6 w-40 animate-pulse rounded bg-muted align-middle"
            />
            <span className="sr-only">Loading</span>
          </>
        }
      >
        <PackDetailSkeleton />
      </MemoryPanelFrame>
    );
  }

  return (
    <PackDetailContent
      pack={pack}
      members={members}
      passage={passage}
      now={now}
      tzOffsetMinutes={tzOffsetMinutes}
    />
  );
}

function PackDetailSkeleton() {
  return (
    <div className="space-y-5" aria-busy="true">
      <div className="flex gap-2" aria-hidden>
        <div className="h-9 w-40 animate-pulse rounded-md bg-muted" />
        <div className="h-9 w-32 animate-pulse rounded-md bg-muted" />
      </div>
      <div className="h-20 animate-pulse rounded-xl bg-muted" aria-hidden />
      <div className="space-y-1.5" aria-hidden>
        {[0, 1, 2, 3].map((key) => (
          <div key={key} className="h-12 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
    </div>
  );
}

function toDetailPack(pack: Pack): PackDetailPack {
  return {
    packId: pack._id,
    name: pack.name,
    kind: pack.kind,
    scope: pack.scope,
    passageRange: pack.passageRange,
    createdAt: pack.createdAt,
    unifiedReviewEnabled: pack.unifiedReviewEnabled,
  };
}

function PackDetailContent({
  pack,
  members,
  passage,
  now,
  tzOffsetMinutes,
}: {
  pack: Pack;
  members: Member[];
  passage: Passage | null;
  now: number;
  tzOffsetMinutes: number;
}) {
  const frame = useMemoryPanelFrame();
  const timeZone = getViewerTimeZone();
  const detailPack = toDetailPack(pack);
  const goal = packDetailGoal({
    pack: detailPack,
    members,
    passage,
    now,
    tzOffsetMinutes,
  });
  const passageGoal = goal?.kind === "passage" ? goal : null;
  const packGoal = goal?.kind === "pack" ? goal : null;

  const subtitle = packDetailSubtitle({
    isPassage: passage !== null,
    verseCount: passageGoal ? passageGoal.verseCount : members.length,
    createdAt: pack.createdAt,
    now,
    timeZone,
  });
  const actions = passageGoal
    ? passageDetailActions(passageGoal, now, timeZone)
    : packDetailActions(packGoal, now, timeZone);
  const progress: PackDetailProgress | null = passageGoal
    ? passageDetailProgress(passageGoal, now, timeZone)
    : packGoal
      ? packDetailProgress(packGoal, now, timeZone)
      : null;
  const firstPiece = passage?.pieces[0];
  const sessionHref = (session: PackDetailSession) =>
    withReturn(
      session === "today"
        ? memoryTodaySessionHref({ packId: pack._id })
        : memoryPackSessionHref(session, pack._id),
      frame.returnTo,
    );
  const rename = usePackRename(pack);

  return (
    <MemoryPanelFrame
      title={rename.title}
      titleAccessory={rename.accessory}
      kind={passage !== null ? "passage" : "pack"}
      subtitle={
        <>
          {subtitle.text}
          {subtitle.heartedAsOnePassage ? (
            <>
              {" · "}
              <Heart
                aria-hidden
                className="inline size-3 fill-red-500 align-[-1px] text-red-500"
              />{" "}
              hearted as one passage
            </>
          ) : null}
        </>
      }
      actions={
        <PackDetailMenu
          pack={pack}
          isPassage={passage !== null}
          reviewTogether={reviewTogetherOption(detailPack, passage, members)}
          members={members}
          now={now}
          reciteHref={sessionHref("review")}
          onRemoved={frame.exit}
        />
      }
    >
      <div className="space-y-6">
        <PackDetailActionRow
          actions={actions}
          sessionHref={sessionHref}
          readerHref={
            firstPiece
              ? `/passage/${toPassageId(firstPiece.book, firstPiece.chapter)}`
              : undefined
          }
        />

        {offersLearnAsPassage(detailPack, passage) && pack.scope ? (
          <LearnAsPassageOffer
            packId={pack._id}
            scope={pack.scope}
            range={pack.passageRange ?? null}
            title={pack.name}
            now={now}
          />
        ) : null}

        {progress ? (
          <ProgressCard
            progress={progress}
            todayStep={passageGoal?.todayStep ?? null}
          />
        ) : null}

        {passage ? (
          <PassageVerses
            passage={passage}
            now={now}
            tzOffsetMinutes={tzOffsetMinutes}
          />
        ) : (
          <PackVerses
            pack={pack}
            members={members}
            now={now}
            timeZone={timeZone}
            editable={pack.kind === "custom"}
          />
        )}
      </div>
    </MemoryPanelFrame>
  );
}

/**
 * Inline rename: the pencil turns the title into a field. Enter or leaving
 * the field saves, Esc cancels, and an empty name keeps the old one.
 */
function usePackRename(pack: Pack): {
  title: ReactNode;
  accessory: ReactNode;
} {
  const rename = useMutation(api.packs.rename);
  const [editing, setEditing] = useState(false);
  const [savingName, setSavingName] = useState<string | null>(null);
  const focusPencilOnMount = useRef(false);

  const finish = (next: string | null) => {
    setEditing(false);
    focusPencilOnMount.current = true;
    const name = next?.trim() ?? "";
    if (name.length === 0 || name === pack.name) return;
    setSavingName(name);
    void rename({ id: pack._id, name })
      .then(
        () => {
          toast.success("Pack renamed");
        },
        () => {
          toast.error("Couldn't rename it. Please try again.");
        },
      )
      .finally(() => setSavingName(null));
  };

  if (editing) {
    return {
      title: <RenameField initial={pack.name} onFinish={finish} />,
      accessory: null,
    };
  }
  return {
    title: savingName ?? pack.name,
    accessory: (
      <Button
        ref={(node) => {
          if (node && focusPencilOnMount.current) {
            focusPencilOnMount.current = false;
            node.focus();
          }
        }}
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Rename"
        onClick={() => setEditing(true)}
        className="size-11 shrink-0 text-muted-foreground sm:size-7"
      >
        <Pencil aria-hidden />
      </Button>
    ),
  };
}

function RenameField({
  initial,
  onFinish,
}: {
  initial: string;
  /** The new name, or `null` to cancel. */
  onFinish: (name: string | null) => void;
}) {
  const [value, setValue] = useState(initial);
  const finished = useRef(false);
  const finish = (name: string | null) => {
    if (finished.current) return;
    finished.current = true;
    onFinish(name);
  };

  return (
    <input
      autoFocus
      data-keep-drawer-on-escape=""
      aria-label="Name"
      value={value}
      maxLength={MAX_PACK_NAME_LENGTH}
      size={Math.max(value.length + 2, 12)}
      onChange={(event) => setValue(event.target.value)}
      onFocus={(event) => event.currentTarget.select()}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          finish(value);
        } else if (event.key === "Escape") {
          event.preventDefault();
          finish(null);
        }
      }}
      onBlur={() => finish(value)}
      className="max-w-full rounded-md border border-input bg-background px-1.5 text-base font-semibold tracking-tight outline-none focus:border-ring sm:text-[length:inherit]"
    />
  );
}

function PackDetailActionRow({
  actions,
  sessionHref,
  readerHref,
}: {
  actions: PackDetailActions;
  sessionHref: (session: PackDetailSession) => string;
  readerHref: string | undefined;
}) {
  const { main } = actions;
  if (!main && !actions.practice && !readerHref && !actions.note) return null;

  let mainControl: ReactNode = null;
  if (main?.kind === "waiting") {
    mainControl = (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex max-sm:w-full">
            <Button
              disabled
              aria-label={`${main.label}. ${FRONTIER_LOCKED_COPY}`}
              className="max-sm:h-11 max-sm:w-full"
            >
              <GraduationCap aria-hidden />
              {main.label}
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          {FRONTIER_LOCKED_COPY}
        </TooltipContent>
      </Tooltip>
    );
  } else if (main) {
    const link = (
      <Button
        asChild
        variant={main.emphasis === "primary" ? "default" : "outline"}
        className="max-sm:h-11 max-sm:w-full"
      >
        <InternalLink href={sessionHref(main.session)}>
          <SessionIcon session={main.session} />
          {main.label}
        </InternalLink>
      </Button>
    );
    mainControl = main.tooltip ? (
      <Tooltip>
        <TooltipTrigger asChild>{link}</TooltipTrigger>
        <TooltipContent className="max-w-xs">{main.tooltip}</TooltipContent>
      </Tooltip>
    ) : (
      link
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {mainControl}
        {actions.practice ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                asChild
                variant="ghost"
                className="text-muted-foreground max-sm:h-11"
              >
                <InternalLink href={sessionHref("practice")}>
                  <Dumbbell aria-hidden />
                  {PRACTICE_ANYTIME_LABEL}
                </InternalLink>
              </Button>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              {EXTRA_PRACTICE_TOOLTIP}
            </TooltipContent>
          </Tooltip>
        ) : null}
        {readerHref ? (
          <Button
            asChild
            variant="ghost"
            className="text-muted-foreground max-sm:h-11"
          >
            <InternalLink href={readerHref}>
              <BookOpen aria-hidden />
              Open in reader
            </InternalLink>
          </Button>
        ) : null}
      </div>
      {actions.note ? (
        <p className="text-sm text-muted-foreground">{actions.note}</p>
      ) : null}
    </div>
  );
}

function SessionIcon({ session }: { session: PackDetailSession }) {
  switch (session) {
    case "today":
    case "learn":
      return <Play aria-hidden />;
    case "review":
      return <RotateCcw aria-hidden />;
    case "practice":
      return <Dumbbell aria-hidden />;
  }
}

function LearnAsPassageOffer({
  packId,
  scope,
  range,
  title,
  now,
}: {
  packId: Id<"packs">;
  scope: VerseScope;
  range: PassageRange | null;
  title: string;
  now: number;
}) {
  const { start, pending, error } = useStartPassage({
    packId,
    scope,
    range,
    now,
  });
  return (
    <div className="text-sm text-muted-foreground">
      <p>
        Want to learn all of {title} in order?{" "}
        <Button
          type="button"
          variant="link"
          className="h-auto p-0 font-semibold"
          loading={pending}
          onClick={() => {
            start().catch(() => {});
          }}
        >
          Learn it as a passage
        </Button>
      </p>
      {error ? (
        <p role="alert" className="mt-1 text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function ProgressCard({
  progress,
  todayStep,
}: {
  progress: PackDetailProgress;
  todayStep: { label: string } | null;
}) {
  const bars = [progress.learned, progress.mastery].filter(
    (bar): bar is ProgressBar => bar !== null,
  );
  const step = todayStep ? todayStepParts(todayStep.label) : null;

  return (
    <div className="space-y-3 rounded-xl border bg-card px-4 py-3.5">
      {step ? (
        <div className="flex gap-2 text-sm">
          <GraduationCap
            aria-hidden
            className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400"
          />
          <p className="min-w-0">
            <span className="font-semibold">{step.lead}</span> {step.rest}
          </p>
        </div>
      ) : null}
      <div className={cn("grid gap-3", bars.length > 1 && "sm:grid-cols-2")}>
        {progress.learned ? (
          <ProgressTrack bar={progress.learned} tone="learned" />
        ) : null}
        {progress.mastery ? (
          <ProgressTrack bar={progress.mastery} tone="mastery" />
        ) : null}
      </div>
      {progress.masteryNote ? (
        <p className="text-xs text-muted-foreground">{progress.masteryNote}</p>
      ) : null}
    </div>
  );
}

function ProgressTrack({
  bar,
  tone,
}: {
  bar: ProgressBar;
  tone: "learned" | "mastery";
}) {
  const percent = Math.round(Math.min(Math.max(bar.fraction, 0), 1) * 100);
  return (
    <div className="min-w-0 space-y-1.5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
        <span className="font-medium">{bar.label}</span>
        {bar.detail ? (
          <span className="text-xs text-muted-foreground">{bar.detail}</span>
        ) : null}
      </div>
      <div
        role="progressbar"
        aria-label={bar.label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        className="h-1.5 overflow-hidden rounded-full bg-muted"
      >
        <div
          className={cn(
            "h-full rounded-full",
            tone === "learned" ? "bg-primary" : "bg-emerald-500",
          )}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

function VersesSection({
  note,
  action,
  children,
}: {
  note: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section aria-label="Verses" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <h3 className={sectionHeadingClassName}>Verses</h3>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="text-xs text-muted-foreground">{note}</span>
          {action}
        </div>
      </div>
      {children}
    </section>
  );
}

/**
 * Add, remove (with Undo) and reorder for a custom pack. Reorders show at
 * once and save in the background; the server order takes over once saved.
 */
function usePackEditor(pack: Pack, members: Member[]) {
  const addVerse = useMutation(api.packs.addVerse);
  const removeVerse = useMutation(api.packs.removeVerse);
  const restoreVerse = useMutation(api.packs.restoreVerse);
  const reorder = useMutation(api.packs.reorder);
  const [localOrder, setLocalOrder] = useState<string[] | null>(null);
  const [adding, setAdding] = useState<ReadonlySet<string>>(new Set());
  const [removing, setRemoving] = useState<ReadonlySet<string>>(new Set());
  const [announcement, setAnnouncement] = useState("");
  const latestMove = useRef(0);

  const ordered = orderByKeys(members, localOrder, (m) => m.verseRefId);

  const move = (from: number, to: number) => {
    const member = ordered[from];
    if (!member || to < 0 || to >= ordered.length || to === from) return;
    const ids = moveItem(ordered, from, to).map((m) => m.verseRefId);
    setLocalOrder(ids);
    setAnnouncement(
      moveAnnouncement(formatVerseRefTitle(member), to, ordered.length),
    );
    latestMove.current += 1;
    const mine = latestMove.current;
    void reorder({ id: pack._id, orderedVerseRefIds: ids })
      .then(
        () => {
          toast.success("New order saved", { id: `pack-order-${pack._id}` });
        },
        () => {
          toast.error("Couldn't save the new order. Please try again.");
        },
      )
      .finally(() => {
        if (latestMove.current === mine) setLocalOrder(null);
      });
  };

  const remove = (member: Member) => {
    const id = member.verseRefId;
    if (removing.has(id)) return;
    setRemoving((current) => new Set(current).add(id));
    const reference = formatVerseRefTitle(member);
    void removeVerse({ id: pack._id, verseRefId: id })
      .then(
        (order) => {
          if (order === null) return;
          toast(`Removed ${reference}.`, {
            action: {
              label: "Undo",
              onClick: () => {
                void restoreVerse({
                  id: pack._id,
                  verseRefId: id,
                  order,
                }).catch(() => {
                  toast.error("Couldn't undo. Please try again.");
                });
              },
            },
          });
        },
        () => {
          toast.error(`Couldn't remove ${reference}. Please try again.`);
        },
      )
      .finally(() =>
        setRemoving((current) => {
          const next = new Set(current);
          next.delete(id);
          return next;
        }),
      );
  };

  const add = (span: VerseSpan) => {
    const key = spanKey(span);
    if (adding.has(key)) return;
    setAdding((current) => new Set(current).add(key));
    void addVerse({ id: pack._id, ...span })
      .then(
        () => {
          toast.success(`Added ${spanDisplayTitle(span)} to ${pack.name}.`);
        },
        () => {
          toast.error("Couldn't add that verse. Please try again.");
        },
      )
      .finally(() =>
        setAdding((current) => {
          const next = new Set(current);
          next.delete(key);
          return next;
        }),
      );
  };

  return {
    ordered,
    memberKeys: new Set(members.map((member) => spanKey(member))),
    adding,
    removing,
    announcement,
    move,
    remove,
    add,
  };
}

function PackVerses({
  pack,
  members,
  now,
  timeZone,
  editable,
}: {
  pack: Pack;
  members: Member[];
  now: number;
  timeZone: string;
  /** Custom packs: add, remove and reorder. */
  editable: boolean;
}) {
  const frame = useMemoryPanelFrame();
  const reviewTogether = pack.unifiedReviewEnabled === true;
  const editor = usePackEditor(pack, members);
  const drag = useDragReorder(editor.move);
  const [addOpen, setAddOpen] = useState(false);
  const addButtonRef = useRef<HTMLButtonElement | null>(null);
  const closeAdd = () => {
    setAddOpen(false);
    addButtonRef.current?.focus();
  };
  const count = editor.ordered.length;

  const addButton = (
    <Button
      ref={addButtonRef}
      type="button"
      size="sm"
      variant="outline"
      aria-expanded={addOpen}
      onClick={() => (addOpen ? closeAdd() : setAddOpen(true))}
      className="max-sm:h-11"
    >
      <Plus aria-hidden />
      Add verses
    </Button>
  );
  const addRow =
    editable && addOpen ? (
      <div className="space-y-2 rounded-xl border bg-card p-3 sm:p-4">
        <VerseSearchAdd
          addedKeys={editor.memberKeys}
          pendingKeys={editor.adding}
          onAdd={editor.add}
          onEscape={closeAdd}
          autoFocus
        />
        <div className="flex justify-end">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={closeAdd}
            className="max-sm:h-11"
          >
            Done
          </Button>
        </div>
      </div>
    ) : null;

  if (count === 0) {
    return (
      <VersesSection note="In your order">
        {addRow}
        <div className="space-y-3 rounded-xl border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
          <p>
            {editable
              ? "No verses yet. Add verses from the reader with Memorize, or tap Add verses."
              : "No verses yet."}
          </p>
          {editable && !addOpen ? addButton : null}
        </div>
      </VersesSection>
    );
  }

  return (
    <VersesSection
      note={
        pack.kind === "custom" ? (
          <>
            In your order
            {editable && count > 1 ? (
              <span className="hidden pointer-fine:inline">
                {" "}
                · drag to reorder
              </span>
            ) : null}
          </>
        ) : (
          "In Bible order"
        )
      }
      action={editable ? addButton : undefined}
    >
      {addRow}
      <ul className="space-y-1.5">
        {editor.ordered.map((member, index) => {
          const row = packMemberRow(member, { now, timeZone, reviewTogether });
          const reference = formatVerseRefTitle(member);
          const href = (session: MemorySessionKind) =>
            withReturn(memoryVerseSessionHref(session, member), frame.returnTo);
          return (
            <li
              key={member.verseRefId}
              {...(editable ? drag.rowProps(index) : {})}
              className={cn(
                "group flex items-center gap-3 rounded-lg border bg-card px-3 py-2.5",
                editable && dragRowClassName(drag.rowState(index, count)),
              )}
            >
              {editable ? <DragHandle {...drag.handleProps(index)} /> : null}
              <span
                aria-hidden
                className={cn(
                  "size-2 shrink-0 rounded-full",
                  MEMORY_STATUS_STYLE[row.status].dot,
                )}
              />
              <div className="min-w-0 flex-1">
                <InternalLink
                  href={frame.hrefFor({
                    kind: "verse",
                    verseRefId: member.verseRefId,
                  })}
                  className="block truncate text-sm font-medium hover:underline"
                >
                  {reference}
                </InternalLink>
                <p className="text-xs text-muted-foreground">{row.line}</p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {row.actions.includes("practice") ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        asChild
                        size="sm"
                        variant="ghost"
                        className="text-muted-foreground max-sm:h-11"
                      >
                        <InternalLink
                          href={href("practice")}
                          aria-label={`Practice ${reference}`}
                        >
                          Practice
                        </InternalLink>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      {EXTRA_PRACTICE_TOOLTIP}
                    </TooltipContent>
                  </Tooltip>
                ) : null}
                {row.actions.includes("review") ? (
                  <Button
                    asChild
                    size="sm"
                    variant="outline"
                    className="max-sm:h-11"
                  >
                    <InternalLink
                      href={href("review")}
                      aria-label={`Review ${reference}`}
                    >
                      <RotateCcw aria-hidden />
                      Review
                    </InternalLink>
                  </Button>
                ) : null}
                {row.actions.includes("learn") ? (
                  <Button
                    asChild
                    size="sm"
                    variant="outline"
                    className="max-sm:h-11"
                  >
                    <InternalLink
                      href={href("learn")}
                      aria-label={`${learnActionLabel(member)} ${reference}`}
                    >
                      <GraduationCap aria-hidden />
                      {learnActionLabel(member)}
                    </InternalLink>
                  </Button>
                ) : null}
              </div>
              {editable ? (
                <RowEditControls
                  label={reference}
                  index={index}
                  count={count}
                  removing={editor.removing.has(member.verseRefId)}
                  onMove={editor.move}
                  onRemove={() => editor.remove(member)}
                />
              ) : null}
            </li>
          );
        })}
      </ul>
      {editable ? <MoveAnnouncer message={editor.announcement} /> : null}
    </VersesSection>
  );
}

const CHIP_CLASS: Record<PassageVerseChipKind, string> = {
  memorized: "border-sky-500/25 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  today:
    "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  tomorrow:
    "border-amber-500/15 bg-amber-500/5 text-amber-700/80 dark:text-amber-300/80",
  upNext:
    "border-slate-500/20 bg-slate-500/10 text-slate-600 dark:text-slate-300",
};

function PassageVerses({
  passage,
  now,
  tzOffsetMinutes,
}: {
  passage: Passage;
  now: number;
  tzOffsetMinutes: number;
}) {
  const chapters = useMemo(() => {
    const groups: { key: string; rows: PassageVerseRow[] }[] = [];
    for (const row of passageVerseRows(passage, now, tzOffsetMinutes)) {
      const key = `${row.book}|${row.chapter}`;
      const last = groups[groups.length - 1];
      if (last?.key === key) last.rows.push(row);
      else groups.push({ key, rows: [row] });
    }
    return groups;
  }, [passage, now, tzOffsetMinutes]);

  return (
    <VersesSection
      note={`Learned in order, up to ${PASSAGE_MAX_ADDS_PER_DAY} new a day`}
    >
      <div className="space-y-4">
        {chapters.map(({ key, rows }) => (
          <PassageChapterRows
            key={key}
            rows={rows}
            showChapter={chapters.length > 1}
          />
        ))}
      </div>
    </VersesSection>
  );
}

function PassageChapterRows({
  rows,
  showChapter,
}: {
  rows: PassageVerseRow[];
  showChapter: boolean;
}) {
  const first = rows[0];
  const last = rows[rows.length - 1];
  const reference =
    first && last
      ? {
          book: first.book,
          chapter: first.chapter,
          startVerse: first.verse,
          endVerse: last.verse,
        }
      : null;
  const { data, loading } = useEsvReference(reference);
  const hearts = useQuery(
    api.savedVerses.listForChapter,
    first ? { book: first.book, chapter: first.chapter } : "skip",
  );

  const textByVerse = useMemo(
    () =>
      new Map(
        (data?.verses ?? []).map((verse) => [verse.number, verse.text.trim()]),
      ),
    [data],
  );
  const ownHearts = useMemo(
    () => (hearts ?? []).filter((heart) => heart.passageMemoryId === undefined),
    [hearts],
  );

  if (!first) return null;
  return (
    <div className="space-y-1.5">
      {showChapter ? (
        <h4 className="text-xs font-semibold text-muted-foreground">
          {formatBookChapter(first.book, first.chapter)}
        </h4>
      ) : null}
      <ul className="space-y-1.5">
        {rows.map((row) => {
          const text = textByVerse.get(row.verse);
          const hearted = ownHearts.some(
            (heart) =>
              heart.startVerse <= row.verse && row.verse <= heart.endVerse,
          );
          return (
            <li
              key={row.verse}
              className="flex items-center gap-3 rounded-lg border bg-card px-3 py-2"
            >
              <span className="w-5 shrink-0 text-right text-xs font-semibold tabular-nums text-muted-foreground">
                {row.verse}
              </span>
              <div className="min-w-0 flex-1">
                {text ? (
                  <p className="truncate font-serif text-sm">{text}</p>
                ) : (
                  <div
                    aria-hidden
                    className={cn(
                      "h-3.5 w-3/4 rounded bg-muted",
                      loading && "animate-pulse",
                    )}
                  />
                )}
              </div>
              <span
                className={cn(
                  "shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap",
                  CHIP_CLASS[row.chip.kind],
                )}
              >
                {row.chip.label}
                {row.chip.fromBefore ? (
                  <span className="font-normal opacity-70"> · from before</span>
                ) : null}
              </span>
              {hearted ? (
                <Heart
                  role="img"
                  aria-label="Also hearted on its own"
                  className="size-3.5 shrink-0 fill-red-500 text-red-500"
                />
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function PackDetailMenu({
  pack,
  isPassage,
  reviewTogether,
  members,
  now,
  reciteHref,
  onRemoved,
}: {
  pack: Pack;
  isPassage: boolean;
  reviewTogether: ReviewTogetherOption | null;
  members: Member[];
  now: number;
  reciteHref: string;
  onRemoved: () => void;
}) {
  const navigate = useNavigate();
  const stopMemorizing = useMutation(api.packs.stopMemorizing);
  const deletePack = useMutation(api.packs.remove);
  const setUnifiedReview = useMutation(api.packs.setUnifiedReview);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [togetherOpen, setTogetherOpen] = useState(false);
  const [togetherError, setTogetherError] = useState<string | null>(null);
  const removeLock = useSubmitLock();
  const togetherLock = useSubmitLock();

  // A passage is one memorized text, so it stops; a pack is only a grouping,
  // so deleting it leaves its verses' memory alone.
  const removal = isPassage
    ? {
        label: "Stop memorizing",
        icon: <CircleStop aria-hidden />,
        title: `Stop memorizing ${pack.name}?`,
        description: `This clears your progress on ${pack.name}. Your heart stays.`,
        done: `Stopped memorizing ${pack.name}.`,
        failed: "Couldn't stop memorizing. Please try again.",
      }
    : {
        label: "Delete pack",
        icon: <Trash2 aria-hidden />,
        title: `Delete ${pack.name}?`,
        description:
          "Verses you've started stay in Memory with their progress. Ones you haven't started stay in your hearts.",
        done: `Deleted ${pack.name}.`,
        failed: "Couldn't delete this pack. Please try again.",
      };

  const handleRemove = () =>
    removeLock.submit(async () => {
      try {
        if (isPassage) {
          await stopMemorizing({ id: pack._id, now: Date.now() });
        } else {
          await deletePack({ id: pack._id });
        }
        setConfirmOpen(false);
        toast.success(removal.done);
        onRemoved();
      } catch {
        toast.error(removal.failed);
      }
    });

  // On the queues' clock: enabling pulls every verse's due time to `now`.
  const enableTogether = () =>
    togetherLock.submit(async () => {
      setTogetherError(null);
      try {
        await setUnifiedReview({ id: pack._id, enabled: true, now });
        setTogetherOpen(false);
        void navigate({ href: reciteHref });
      } catch {
        setTogetherError("Couldn't turn this on. Please try again.");
      }
    });

  const disableTogether = () =>
    togetherLock.submit(async () => {
      try {
        await setUnifiedReview({ id: pack._id, enabled: false, now });
      } catch {
        toast.error("Couldn't turn this off. Please try again.");
      }
    });

  return (
    <>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-11 text-muted-foreground sm:size-8"
            aria-label="More actions"
          >
            <MoreHorizontal aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="max-w-72">
          {reviewTogether ? (
            <>
              <DropdownMenuCheckboxItem
                checked={reviewTogether.checked}
                disabled={reviewTogether.disabled || togetherLock.pending}
                onCheckedChange={(checked) => {
                  if (checked) {
                    setTogetherError(null);
                    setTogetherOpen(true);
                  } else {
                    disableTogether();
                  }
                }}
              >
                <span className="flex flex-col">
                  Review together as one recitation
                  {reviewTogether.disabled ? (
                    <span className="text-xs text-muted-foreground">
                      Once every verse is memorized
                    </span>
                  ) : null}
                </span>
              </DropdownMenuCheckboxItem>
              <DropdownMenuSeparator />
            </>
          ) : null}
          <DropdownMenuItem
            variant="destructive"
            onSelect={() => setConfirmOpen(true)}
          >
            {removal.icon}
            {removal.label}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent showCloseButton={false} className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{removal.title}</DialogTitle>
            <DialogDescription>{removal.description}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmOpen(false)}
            >
              Keep
            </Button>
            <Button
              type="button"
              variant="destructive"
              loading={removeLock.pending}
              onClick={handleRemove}
            >
              {removal.label}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {reviewTogether ? (
        <EnableUnifiedReviewDialog
          open={togetherOpen}
          onOpenChange={(open) => {
            setTogetherOpen(open);
            if (!open) setTogetherError(null);
          }}
          packName={pack.name}
          verseCount={members.length}
          notDueCount={
            members.filter((member) => !isDueForReview(member, now)).length
          }
          isEnabling={togetherLock.pending}
          error={togetherError}
          onConfirm={enableTogether}
        />
      ) : null}
    </>
  );
}
