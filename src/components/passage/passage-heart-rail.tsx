import { useState, type ReactNode } from "react";
import { Heart } from "lucide-react";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { RailStroke } from "@/lib/passage-rail";
import { cn } from "@/lib/utils";

import { UnheartMemorizingDialog } from "./unheart-memorizing-dialog";
import { MasteryRing } from "./verse-row";

/** The one heart of a memorized passage, level with its first verse. */
export interface PassageRailHeart {
  /** Ring fill: verses learned ÷ verses in the passage. */
  learnedFraction: number;
  /** "Psalm 16 · memorizing · 4 of 11 learned". */
  tooltip: string;
  /** "Psalm 16, hearted. Memorizing: 4 of 11 verses learned. Remove heart". */
  ariaLabel: string;
  /** Names the passage in the unheart confirm: "Unheart Psalm 16?". */
  title: string;
  /** Unhearts the passage's heart row, which always stops memorizing it. */
  onUnheart: () => void;
  onHoverChange?: (hovering: boolean) => void;
}

/** What one verse draws in the left gutter for a memorized passage. */
export interface PassageRailMark {
  stroke: RailStroke;
  /** Square top flush with the row, joining a rail drawn past a heading above. */
  flushTop?: boolean;
  heart: PassageRailHeart | null;
}

const STROKE_CLASS: Record<RailStroke, string> = {
  solid: "bg-red-500/55 dark:bg-red-400/55",
  dashed:
    "bg-red-500/55 dark:bg-red-400/55 [mask-image:repeating-linear-gradient(180deg,#000_0_4px,transparent_4px_7px)]",
  faint: "bg-foreground/12",
};

/**
 * A lane in the `pl-16` gutter centred about 32px left of the verse column,
 * where `SavedPassagePill` sits for plain range hearts. Narrow screens pull
 * it in and slim it down.
 */
const LANE_CLASS =
  "pointer-events-none absolute inset-y-0 right-full z-20 mr-[15px] w-[34px] max-sm:mr-2 max-sm:w-6";

const RAIL_X_CLASS =
  "absolute left-[calc(50%-1.5px)] w-[3px] max-sm:left-[calc(50%-1px)] max-sm:w-0.5";

function PassageHeartButton({ heart }: { heart: PassageRailHeart }) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const { onHoverChange } = heart;

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={heart.ariaLabel}
            data-passage-dismiss-exempt=""
            className={cn(
              "pointer-events-auto absolute top-1 left-0 grid size-[34px] place-items-center rounded-full text-red-500 transition-colors hover:bg-red-500/10 dark:text-red-400 dark:hover:bg-red-400/10 max-sm:size-6",
              "outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
            )}
            onMouseDown={(event) => event.stopPropagation()}
            onMouseEnter={() => onHoverChange?.(true)}
            onMouseLeave={() => onHoverChange?.(false)}
            onClick={(event) => {
              event.stopPropagation();
              setConfirmOpen(true);
            }}
          >
            <MasteryRing
              fraction={heart.learnedFraction}
              className="absolute inset-0 size-full"
              progressClassName="motion-safe:transition-[stroke-dashoffset] motion-safe:duration-700"
            />
            <Heart
              aria-hidden
              className="relative size-[18px] fill-current max-sm:size-3.5"
            />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" align="start">
          {heart.tooltip}
        </TooltipContent>
      </Tooltip>
      <UnheartMemorizingDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        onConfirm={heart.onUnheart}
        reference={heart.title}
      />
    </>
  );
}

/**
 * One verse's part of a passage rail, drawn in its row's left gutter so the
 * rail follows layout: the heart on the first verse and a 3px segment per
 * verse. Rows are `relative`; this fills their height.
 */
export function PassageRailGutter({ mark }: { mark: PassageRailMark }) {
  return (
    <div className={LANE_CLASS} data-passage-rail={mark.stroke}>
      <span
        aria-hidden
        className={cn(
          RAIL_X_CLASS,
          "bottom-[3px]",
          STROKE_CLASS[mark.stroke],
          mark.heart
            ? "top-10 rounded-full max-sm:top-[30px]"
            : mark.flushTop
              ? "top-0 rounded-b-full"
              : "top-[3px] rounded-full",
        )}
      />
      {mark.heart ? <PassageHeartButton heart={mark.heart} /> : null}
    </div>
  );
}

/**
 * Wraps the section headings above a verse so a passage rail coming from the
 * verse before runs on past them. `stroke` is the verse below's; `null`
 * renders the headings alone.
 */
export function PassageRailPastHeadings({
  stroke,
  children,
}: {
  stroke: RailStroke | null;
  children: ReactNode;
}) {
  if (!stroke) return children;
  return (
    <div className="relative">
      {children}
      <div aria-hidden className={LANE_CLASS} data-passage-rail={stroke}>
        <span
          className={cn(
            RAIL_X_CLASS,
            "top-[3px] bottom-0 rounded-t-full",
            STROKE_CLASS[stroke],
          )}
        />
      </div>
    </div>
  );
}
