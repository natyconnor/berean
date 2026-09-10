import type { PieceAttachment, PassagePiece } from "@/lib/passage-pieces";
import { formatVerseRef } from "@/lib/verse-ref-utils";
import { cn } from "@/lib/utils";

const ATTACHMENT_ORDER: readonly PieceAttachment[] = [
  "unreached",
  "learning",
  "attached",
  "solid",
];

const ATTACHMENT_LABEL: Record<PieceAttachment, string> = {
  unreached: "Unreached",
  learning: "Learning",
  attached: "Attached",
  solid: "Solid",
};

const ATTACHMENT_DOT: Record<PieceAttachment, string> = {
  unreached: "bg-slate-400 dark:bg-slate-500",
  learning: "bg-amber-500",
  attached: "bg-sky-500",
  solid: "bg-emerald-500",
};

/**
 * Frozen piece list for an active passage: each unit and its attachment
 * (unreached → learning → attached → solid).
 */
export function PassageMap({ pieces }: { pieces: readonly PassagePiece[] }) {
  return (
    <div className="space-y-3">
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        Passage map
      </h2>
      <ul
        className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground"
        aria-label="Piece status legend"
      >
        {ATTACHMENT_ORDER.map((attachment) => (
          <li key={attachment} className="flex items-center gap-1.5">
            <span
              aria-hidden
              className={cn(
                "h-2 w-2 shrink-0 rounded-full",
                ATTACHMENT_DOT[attachment],
              )}
            />
            {ATTACHMENT_LABEL[attachment]}
          </li>
        ))}
      </ul>
      <ol className="space-y-1.5">
        {pieces.map((piece) => (
          <li
            key={piece.index}
            className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2"
          >
            <span
              aria-hidden
              className={cn(
                "h-2 w-2 shrink-0 rounded-full",
                ATTACHMENT_DOT[piece.attachment],
              )}
            />
            <span className="min-w-0 flex-1 truncate text-sm font-medium">
              {formatVerseRef(piece)}
            </span>
            <span className="shrink-0 text-xs text-muted-foreground">
              {ATTACHMENT_LABEL[piece.attachment]}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
