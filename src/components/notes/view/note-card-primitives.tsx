import { Fragment } from "react";
import { motion } from "framer-motion";
import { Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useStarterTagBadgeStyle } from "@/lib/tag-color-styles";
import {
  normalizeNoteBody,
  noteBodyToPlainText,
  truncatePlainTextContent,
  type NoteBody,
} from "@/lib/note-inline-content";
import { VerseLinkPill } from "@/components/verse-ref/verse-link-pill";
import type { CurrentChapter } from "@/hooks/use-verse-link-navigation";

export type { CurrentChapter };

/** Shared 32×32 hit target for note card icon actions (expanded + collapsed hover). */
const NOTE_CARD_ACTION_ICON_BUTTON =
  "flex h-8 w-8 shrink-0 items-center justify-center rounded transition-colors";

export interface NoteCardActionsProps {
  onEdit: () => void;
  onDelete: () => void;
  variant?: "default" | "passage";
  /**
   * `"always"` — actions are permanently visible (compose mode).
   * `"hover"` — hidden on fine-pointer devices until the parent `group` is
   *   hovered or focused-within; always visible for coarse/touch pointers.
   */
  reveal?: "always" | "hover";
}

export function NoteCardActions({
  onEdit,
  onDelete,
  variant = "default",
  reveal = "always",
}: NoteCardActionsProps) {
  const hoverBg =
    variant === "passage"
      ? "hover:bg-amber-100 dark:hover:bg-amber-800/30"
      : "hover:bg-muted";

  return (
    <div
      className={cn(
        "flex shrink-0 flex-col gap-0.5 transition-opacity",
        reveal === "hover" &&
          "[@media(hover:hover)_and_(pointer:fine)]:opacity-0 [@media(hover:hover)_and_(pointer:fine)]:group-hover:opacity-100 [@media(hover:hover)_and_(pointer:fine)]:group-focus-within:opacity-100",
      )}
      role="group"
      aria-label="Note actions"
    >
      <button
        type="button"
        className={cn(NOTE_CARD_ACTION_ICON_BUTTON, hoverBg)}
        onClick={onEdit}
        aria-label="Edit note"
      >
        <Pencil className="h-3 w-3 text-muted-foreground" />
      </button>
      <motion.button
        type="button"
        className={cn(NOTE_CARD_ACTION_ICON_BUTTON, "hover:bg-destructive/10")}
        whileTap={{ scale: 0.92 }}
        onClick={onDelete}
        aria-label="Delete note"
      >
        <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
      </motion.button>
    </div>
  );
}

export interface NoteTagListProps {
  tags: string[];
  variant?: "default" | "passage";
  size?: "sm" | "xs";
  className?: string;
}

export function NoteTagList({
  tags,
  variant = "default",
  size = "xs",
  className,
}: NoteTagListProps) {
  const resolveTagStyle = useStarterTagBadgeStyle();
  if (tags.length === 0) return null;

  const borderClass =
    variant === "passage" ? "border-amber-300 dark:border-amber-600/45" : "";
  const sizeClass = size === "xs" ? "text-[10px] px-1.5 py-0" : "text-xs";

  return (
    <div className={cn("flex flex-wrap gap-1", className)}>
      {tags.map((tag) => (
        <Badge
          key={tag}
          variant="outline"
          className={cn(sizeClass, borderClass)}
          style={resolveTagStyle(tag)}
        >
          {tag}
        </Badge>
      ))}
    </div>
  );
}

export interface NoteContentProps {
  content: string;
  body?: NoteBody | null;
  truncateAt?: number;
  density?: "default" | "reading";
  currentChapter?: CurrentChapter;
  className?: string;
}

export function NoteContent({
  content,
  body,
  truncateAt,
  density = "default",
  currentChapter,
  className,
}: NoteContentProps) {
  const densityClass =
    density === "reading" ? "text-base leading-7" : "leading-relaxed";
  const normalizedBody = normalizeNoteBody(body, content);

  if (truncateAt) {
    const displayContent = truncatePlainTextContent(
      noteBodyToPlainText(normalizedBody, content),
      truncateAt,
    );
    return (
      <p className={cn("m-0 whitespace-pre-wrap", densityClass, className)}>
        {displayContent}
      </p>
    );
  }

  return (
    <div className={cn("whitespace-pre-wrap", densityClass, className)}>
      {normalizedBody.segments.length === 0 ? (
        <p />
      ) : (
        normalizedBody.segments.map((segment, index) => {
          if (segment.type === "text") {
            return <Fragment key={`text-${index}`}>{segment.text}</Fragment>;
          }
          if (segment.type === "lineBreak") {
            return <br key={`br-${index}`} />;
          }
          if (segment.type === "verseQuote") {
            return (
              <Fragment key={`quote-${index}`}>{`> ${segment.text}`}</Fragment>
            );
          }
          return (
            <VerseLinkPill
              key={`ref-${index}`}
              refValue={segment.ref}
              label={segment.label}
              currentChapter={currentChapter}
              className="mx-0.5"
            />
          );
        })
      )}
    </div>
  );
}

export interface StackedCardBackgroundProps {
  count: number;
  variant?: "default" | "muted";
  /** Candlelight: soften rear stack layers (depth of field). */
  isCandlelight?: boolean;
}

export function StackedCardBackground({
  count,
  variant = "default",
  isCandlelight = false,
}: StackedCardBackgroundProps) {
  const bgClass = variant === "muted" ? "bg-muted/40" : "bg-muted/50";
  const bgClass2 = variant === "muted" ? "bg-muted/60" : "bg-muted/70";

  return (
    <>
      {count > 2 && (
        <div
          className={cn(
            "absolute inset-0 translate-x-1 translate-y-1 rounded-lg border",
            bgClass,
            isCandlelight && "opacity-50",
          )}
          style={isCandlelight ? { filter: "blur(0.6px)" } : undefined}
        />
      )}
      {count > 1 && (
        <div
          className={cn(
            "absolute inset-0 translate-x-0.5 translate-y-0.5 rounded-lg border",
            bgClass2,
            isCandlelight && "opacity-70",
          )}
          style={isCandlelight ? { filter: "blur(0.3px)" } : undefined}
        />
      )}
    </>
  );
}

export interface HoverEditButtonProps {
  onEdit: () => void;
  variant?: "default" | "passage";
}

export function HoverEditButton({
  onEdit,
  variant = "default",
}: HoverEditButtonProps) {
  const hoverBg =
    variant === "passage"
      ? "hover:bg-amber-100 dark:hover:bg-amber-800/30"
      : "hover:bg-muted";

  return (
    <button
      type="button"
      className={cn(
        "absolute top-1/2 right-2 z-10 -translate-y-1/2 opacity-0 transition-all group-hover:opacity-100",
        NOTE_CARD_ACTION_ICON_BUTTON,
        hoverBg,
      )}
      onClick={(e) => {
        e.stopPropagation();
        onEdit();
      }}
      aria-label="Edit note"
    >
      <Pencil className="h-3 w-3 text-muted-foreground" />
    </button>
  );
}
