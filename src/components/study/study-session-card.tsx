import { type MouseEvent } from "react";
import { Link } from "@tanstack/react-router";
import { motion, useReducedMotion } from "framer-motion";
import {
  BookHeart,
  Clock,
  Layers,
  NotebookPen,
  Sparkles,
  Trash2,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatRelativeTime } from "@/lib/format-relative-time";
import { useStarterTagBadgeStyle } from "@/lib/tag-color-styles";
import {
  activityLabel,
  type ActivityType,
} from "@/components/study/study-card-model";

import { formatScopeSummary, type StudyScope } from "./study-scope-summary";

const KNOWN_ACTIVITIES = new Set<ActivityType>(["verse-memory", "teach"]);

/**
 * `lastView` can be any `SessionView` (overview + activity types) plus a
 * couple of legacy names. The card only surfaces a "Last: X" chip when the
 * last view was an activity — there's nothing interesting to say about
 * "last viewed the overview".
 */
function lastViewAsActivity(value: string | undefined): ActivityType | null {
  if (!value) return null;
  if (value === "explain") return "teach";
  if (value === "mixed-review") return "verse-memory";
  if (KNOWN_ACTIVITIES.has(value as ActivityType)) {
    return value as ActivityType;
  }
  return null;
}

export interface StudySessionCardProps {
  sessionId: string;
  index: number;
  name?: string;
  scope: StudyScope;
  lastOpenedAt: number;
  savedVersesCount?: number;
  notesCount?: number;
  teachPassagesCount?: number;
  lastView?: string;
  onDelete: () => void;
}

export function StudySessionCard({
  sessionId,
  index,
  name,
  scope,
  lastOpenedAt,
  savedVersesCount,
  notesCount,
  teachPassagesCount,
  lastView,
  onDelete,
}: StudySessionCardProps) {
  const verses = savedVersesCount ?? 0;
  const notes = notesCount ?? 0;
  const teachPassages = teachPassagesCount ?? 0;
  const shouldReduceMotion = useReducedMotion();
  const resolveTagStyle = useStarterTagBadgeStyle();

  const scopeSummary = formatScopeSummary(scope);
  const hasDistinctName =
    typeof name === "string" && name.length > 0 && name !== scopeSummary;
  const title = hasDistinctName ? name : scopeSummary;
  const subtitle = hasDistinctName ? scopeSummary : null;

  const activity = lastViewAsActivity(lastView);

  const entry = shouldReduceMotion
    ? { initial: { opacity: 0 }, animate: { opacity: 1 } }
    : { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 } };
  const entryTransition = shouldReduceMotion
    ? { duration: 0.15 }
    : {
        delay: Math.min(index, 8) * 0.04,
        type: "spring" as const,
        stiffness: 360,
        damping: 28,
        mass: 0.8,
      };

  const hover = shouldReduceMotion
    ? undefined
    : {
        y: -3,
        scale: 1.01,
        transition: {
          type: "spring" as const,
          stiffness: 320,
          damping: 22,
        },
      };
  const tap = shouldReduceMotion ? undefined : { scale: 0.985 };

  function handleDelete(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    onDelete();
  }

  return (
    <motion.li
      className={cn(
        "group relative list-none overflow-hidden rounded-lg border bg-card shadow-sm",
        "transition-[border-color,box-shadow] duration-200",
        "hover:border-primary/40 hover:shadow-md",
        "focus-within:border-primary/50 focus-within:shadow-md",
      )}
      initial={entry.initial}
      animate={entry.animate}
      transition={entryTransition}
      whileHover={hover}
      whileTap={tap}
    >
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute left-0 top-0 h-full w-1",
          "bg-gradient-to-b from-primary/30 via-primary/60 to-primary/20",
          "opacity-60 transition-opacity duration-200",
          "group-hover:opacity-100 group-focus-within:opacity-100",
        )}
      />
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-0 rounded-lg",
          "bg-gradient-to-br from-primary/[0.04] via-transparent to-transparent",
          "opacity-0 transition-opacity duration-200",
          "group-hover:opacity-100 group-focus-within:opacity-100",
        )}
      />

      <div className="relative flex items-stretch gap-2 pl-4 pr-2 py-3">
        <Link
          to="/study/$sessionId"
          params={{ sessionId }}
          className={cn(
            "flex-1 min-w-0 space-y-2 rounded-md outline-none",
            "focus-visible:ring-2 focus-visible:ring-ring/60",
          )}
          aria-label={`Open study session: ${title}`}
        >
          <div className="min-w-0 space-y-0.5">
            <p
              className={cn(
                "truncate text-sm font-semibold text-primary",
                "transition-colors group-hover:text-primary/90",
              )}
            >
              {title}
            </p>
            {subtitle && (
              <p className="truncate text-xs text-muted-foreground">
                {subtitle}
              </p>
            )}
          </div>

          <StatsRow
            savedVersesCount={verses}
            notesCount={notes}
            teachPassagesCount={teachPassages}
            lastOpenedAt={lastOpenedAt}
          />

          {(scope.tags.length > 0 || activity) && (
            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
              {scope.tags.map((tag) => (
                <Badge
                  key={tag}
                  variant="outline"
                  className="text-[10px] font-normal"
                  style={resolveTagStyle(tag)}
                >
                  {tag}
                </Badge>
              ))}
              {activity && (
                <Badge
                  variant="secondary"
                  className="gap-1 text-[10px] font-medium"
                  title={`Last studied with ${activityLabel(activity)}`}
                >
                  <Sparkles className="h-3 w-3" />
                  Last: {activityLabel(activity)}
                </Badge>
              )}
            </div>
          )}
        </Link>

        <motion.button
          type="button"
          aria-label="Delete session"
          onClick={handleDelete}
          className={cn(
            "shrink-0 self-start inline-flex h-8 w-8 items-center justify-center rounded-md",
            "text-muted-foreground/70",
            "opacity-60 transition-[opacity,color,background-color] duration-150",
            "hover:bg-destructive/10 hover:text-destructive hover:opacity-100",
            "focus-visible:opacity-100 focus-visible:outline-none",
            "focus-visible:ring-2 focus-visible:ring-destructive/40",
            "group-hover:opacity-100",
          )}
          whileHover={shouldReduceMotion ? undefined : { scale: 1.08 }}
          whileTap={shouldReduceMotion ? undefined : { scale: 0.9 }}
          transition={{ type: "spring", stiffness: 500, damping: 28 }}
        >
          <Trash2 className="h-4 w-4" />
        </motion.button>
      </div>
    </motion.li>
  );
}

function StatsRow({
  savedVersesCount,
  notesCount,
  teachPassagesCount,
  lastOpenedAt,
}: {
  savedVersesCount: number;
  notesCount: number;
  teachPassagesCount: number;
  lastOpenedAt: number;
}) {
  const versesLabel =
    savedVersesCount === 1 ? "hearted verse" : "hearted verses";
  const notesLabel = notesCount === 1 ? "note" : "notes";
  const passageNoun = teachPassagesCount === 1 ? "passage" : "passages";
  return (
    <div className="space-y-1 text-xs text-muted-foreground">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="inline-flex items-center gap-1.5">
          <BookHeart
            aria-hidden
            className="h-3.5 w-3.5 text-rose-500/80 dark:text-rose-400/80"
          />
          <span>
            <span className="font-medium text-foreground/80 tabular-nums">
              {savedVersesCount}
            </span>{" "}
            {versesLabel}
          </span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <NotebookPen aria-hidden className="h-3.5 w-3.5" />
          <span>
            <span className="font-medium text-foreground/80 tabular-nums">
              {notesCount}
            </span>{" "}
            {notesLabel}
          </span>
        </span>
        <span
          className="inline-flex items-center gap-1.5"
          title="Distinct verse-linked passages in this scope (one card each in Teach)"
        >
          <Layers aria-hidden className="h-3.5 w-3.5" />
          <span>
            <span className="font-medium text-foreground/80 tabular-nums">
              {teachPassagesCount}
            </span>{" "}
            {passageNoun}
          </span>
        </span>
        <span
          className="inline-flex items-center gap-1.5"
          title="Distinct verse-linked passages in this scope (one card each in Teach)"
        >
          <Clock aria-hidden className="h-3.5 w-3.5" />
          <span>Last studied {formatRelativeTime(lastOpenedAt)}</span>
        </span>
      </div>
    </div>
  );
}
