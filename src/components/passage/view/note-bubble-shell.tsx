import type { ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { NOTE_ENTER_TRANSITION } from "../note-animation-config";

export type BubbleState = "pill" | "collapsed" | "expanded";

interface NoteBubbleShellProps {
  state: BubbleState;
  pill: ReactNode;
  collapsed: ReactNode;
  expanded: ReactNode;
}

export function NoteBubbleShell({
  state,
  pill,
  collapsed,
  expanded,
}: NoteBubbleShellProps) {
  const isExpanded = state === "expanded";

  return (
    <AnimatePresence initial={false} mode="popLayout">
      <motion.div
        key={state}
        initial={isExpanded ? { opacity: 0, height: 0 } : { opacity: 0 }}
        animate={isExpanded ? { opacity: 1, height: "auto" } : { opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={
          isExpanded
            ? {
                opacity: NOTE_ENTER_TRANSITION,
                height: { duration: 0.22, ease: [0.22, 1, 0.36, 1] },
              }
            : NOTE_ENTER_TRANSITION
        }
        style={isExpanded ? { overflow: "hidden" } : undefined}
      >
        {state === "pill"
          ? pill
          : state === "collapsed"
            ? collapsed
            : expanded}
      </motion.div>
    </AnimatePresence>
  );
}
