import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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
  /** Unhearts a `hearted` offer's span. */
  onUnheart: () => void;
}

/**
 * "Memorize Psalm 1:5?" pointing at the heart that was clicked. Just hearted:
 * Memorize or Not now; it never takes focus and closes after 6 s (paused
 * while hovered or focused). Already hearted: Memorize or Unheart; it takes
 * focus and stays until used. Both close on Esc or a click elsewhere.
 */
export function HeartMemorizeNudge({
  offer,
  onClose,
  onMemorize,
  onUnheart,
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
  const openOfferRef = useRef(offer);
  useLayoutEffect(() => {
    openOfferRef.current = offer;
  }, [offer]);

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
    if (offer?.kind !== "saved" || paused) return;
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
          // A new offer remounts, so a hearted one takes focus even when it
          // replaces an offer still on screen.
          key={shown.id}
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
          onOpenAutoFocus={(event) => {
            if (shown.kind === "saved") event.preventDefault();
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            const restore = restoreFocusRef.current;
            restoreFocusRef.current = false;
            if (
              restore &&
              openOfferRef.current === null &&
              shown.anchor.isConnected
            ) {
              shown.anchor.focus();
            }
          }}
          onEscapeKeyDown={() => {
            restoreFocusRef.current = true;
          }}
          // Its heart toggles it, so a press there is not a click elsewhere.
          onInteractOutside={(event) => {
            const { target } = event;
            if (target instanceof Node && shown.anchor.contains(target)) {
              event.preventDefault();
            }
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
            {shown.kind === "saved" ? "Saved to your hearts" : "In your hearts"}
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
            {shown.kind === "saved" ? (
              <Button
                type="button"
                size="xs"
                variant="ghost"
                onClick={() => closeKeepingFocus(onClose)}
              >
                Not now
              </Button>
            ) : (
              <Button
                type="button"
                size="xs"
                variant="ghost"
                onClick={() => closeKeepingFocus(onUnheart)}
              >
                Unheart
              </Button>
            )}
          </div>
        </PopoverContent>
      ) : null}
    </Popover>
  );
}
