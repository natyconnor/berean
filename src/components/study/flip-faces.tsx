import { motion } from "framer-motion";
import type { JSX, ReactNode } from "react";

import { cn } from "@/lib/utils";

export interface FlipFacesProps {
  flipped: boolean;
  front: ReactNode;
  back: ReactNode;
  className?: string;
  /**
   * Applied to each of the two rotating faces. Put the card "box" styling
   * here (border, background, shadow, rounded corners, overflow clipping)
   * so that what rotates is the visible card itself rather than just its
   * contents inside a stationary frame.
   */
  faceClassName?: string;
  /** Duration in seconds. Default 0.45. */
  duration?: number;
}

export function FlipFaces({
  flipped,
  front,
  back,
  className,
  faceClassName,
  duration = 0.45,
}: FlipFacesProps): JSX.Element {
  return (
    <div className={cn("relative [perspective:1000px]", className)}>
      <motion.div
        className="relative h-full w-full"
        style={{ transformStyle: "preserve-3d" }}
        animate={{ rotateY: flipped ? 180 : 0 }}
        transition={{ duration, ease: "easeInOut" }}
      >
        <div
          className={cn("absolute inset-0 h-full w-full", faceClassName)}
          style={{ backfaceVisibility: "hidden" }}
        >
          {front}
        </div>
        <div
          className={cn("absolute inset-0 h-full w-full", faceClassName)}
          style={{
            backfaceVisibility: "hidden",
            transform: "rotateY(180deg)",
          }}
        >
          {back}
        </div>
      </motion.div>
    </div>
  );
}
