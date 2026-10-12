import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Heart } from "lucide-react";
import { Popover as PopoverPrimitive } from "radix-ui";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "@/components/ui/popover";
import { MEMORIZE_LABEL, memorizeTitleLabel } from "@/lib/memory-copy";

import {
  HEART_NUDGE_ATTRIBUTE,
  type HeartNudgeOffer,
} from "./hooks/use-heart-memorize-nudge";

export const HEART_NUDGE_AUTO_CLOSE_MS = 6000;
const NUDGE_WIDTH_PX = 184;
const NUDGE_GAP_PX = 10;
const VIEWPORT_MARGIN_PX = 8;
/** How often to check that the heart is still on the page. */
const ANCHOR_CHECK_MS = 250;

/**
 * Beside the heart when the gutter has room for the whole popover, else above
 * the row. Radix would flip `left` to `right`, never to `top`.
 */
function nudgeSide(anchor: HTMLElement): "left" | "top" {
  const { left } = anchor.getBoundingClientRect();
  return left - NUDGE_GAP_PX - NUDGE_WIDTH_PX >= VIEWPORT_MARGIN_PX
    ? "left"
    : "top";
}

export interface HeartMemorizeNudgeProps {
  /** The heart just clicked; `null` closes the popover. */
  offer: HeartNudgeOffer | null;
  onClose: () => void;
  onMemorize: () => void;
  onDontAskAgain: () => void;
}

/**
 * "Saved to your hearts · Memorize Psalm 1:5?" pointing at the heart that was
 * clicked. It never takes focus, closes after 6 s (paused while hovered or
 * focused), and closes on Esc or a click elsewhere.
 */
export function HeartMemorizeNudge({
  offer,
  onClose,
  onMemorize,
  onDontAskAgain,
}: HeartMemorizeNudgeProps) {
  const titleId = useId();
  const questionId = useId();
  // Keep the last offer so the text stays while the popover animates closed.
  const [shown, setShown] = useState(offer);
  if (offer && offer !== shown) setShown(offer);
  const [hoveredOffer, setHoveredOffer] = useState<HeartNudgeOffer | null>(
    null,
  );
  const [focusedOffer, setFocusedOffer] = useState<HeartNudgeOffer | null>(
    null,
  );
  const paused =
    offer !== null && (hoveredOffer === offer || focusedOffer === offer);
  const restoreFocusRef = useRef(false);

  const anchorRef = useMemo(
    () => ({ current: shown?.anchor ?? null }),
    [shown],
  );
  const side = useMemo(
    () => (shown ? nudgeSide(shown.anchor) : "top"),
    [shown],
  );

  useEffect(() => {
    if (!offer) return;
    const check = setInterval(() => {
      if (!offer.anchor.isConnected) onClose();
    }, ANCHOR_CHECK_MS);
    return () => clearInterval(check);
  }, [offer, onClose]);

  useEffect(() => {
    if (!offer || paused) return;
    const timer = setTimeout(onClose, HEART_NUDGE_AUTO_CLOSE_MS);
    return () => clearTimeout(timer);
  }, [offer, paused, onClose]);

  const closeKeepingFocus = (action: () => void) => {
    restoreFocusRef.current = true;
    action();
  };

  return (
    <Popover
      open={offer !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <PopoverAnchor virtualRef={anchorRef} />
      {shown ? (
        <PopoverContent
          {...{ [HEART_NUDGE_ATTRIBUTE]: "" }}
          data-passage-dismiss-exempt
          side={side}
          align={side === "left" ? "center" : "start"}
          alignOffset={side === "left" ? 0 : -6}
          sideOffset={side === "left" ? NUDGE_GAP_PX : 6}
          collisionPadding={VIEWPORT_MARGIN_PX}
          hideWhenDetached
          aria-labelledby={titleId}
          aria-describedby={questionId}
          onOpenAutoFocus={(event) => event.preventDefault()}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            if (restoreFocusRef.current && shown.anchor.isConnected) {
              shown.anchor.focus();
            }
            restoreFocusRef.current = false;
          }}
          onEscapeKeyDown={() => {
            restoreFocusRef.current = true;
          }}
          onPointerEnter={() => setHoveredOffer(offer)}
          onPointerLeave={() => setHoveredOffer(null)}
          onFocus={() => setFocusedOffer(offer)}
          onBlur={(event) => {
            const next = event.relatedTarget;
            if (
              !(next instanceof Node) ||
              !event.currentTarget.contains(next)
            ) {
              setFocusedOffer(null);
            }
          }}
          className="w-46 rounded-[10px] px-3 pt-2.5 pb-3 shadow-[0_2px_5px_rgb(0_0_0/0.1),0_10px_28px_rgb(50_35_15/0.16)]"
        >
          <PopoverPrimitive.Arrow
            className="fill-popover"
            width={12}
            height={6}
          />
          <p
            id={titleId}
            className="flex items-center gap-1.5 text-[13px] font-semibold"
          >
            <Heart
              aria-hidden
              className="size-3.5 fill-current text-red-500 dark:text-red-400"
            />
            Saved to your hearts
          </p>
          <p
            id={questionId}
            className="mt-0.5 ml-5 text-[12.5px] text-muted-foreground"
          >
            {memorizeTitleLabel(shown.title)}?
          </p>
          <div className="mt-2.5 ml-4 flex gap-1">
            <Button type="button" size="xs" onClick={onMemorize}>
              {MEMORIZE_LABEL}
            </Button>
            <Button
              type="button"
              size="xs"
              variant="ghost"
              onClick={() => closeKeepingFocus(onClose)}
            >
              Not now
            </Button>
          </div>
          <button
            type="button"
            onClick={() => closeKeepingFocus(onDontAskAgain)}
            className="mt-1.5 ml-5 rounded-sm text-[11px] text-muted-foreground underline-offset-2 outline-none hover:text-foreground hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            Don&apos;t ask again
          </button>
        </PopoverContent>
      ) : null}
    </Popover>
  );
}
