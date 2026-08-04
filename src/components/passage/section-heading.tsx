import { forwardRef } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { SECTION_HEADING_TRANSITION } from "@/components/passage/note-animation-config";
import { cn } from "@/lib/utils";

interface SectionHeadingProps {
  title: string;
  /** Section titles are larger; ESV subheadings (Aleph, psalm titles) are lighter. */
  variant?: "section" | "sub";
}

export const SectionHeading = forwardRef<HTMLDivElement, SectionHeadingProps>(
  function SectionHeading({ title, variant = "section" }, ref) {
    const reduceMotion = useReducedMotion();
    const isSub = variant === "sub";

    return (
      <motion.div
        ref={ref}
        initial={
          reduceMotion ? { opacity: 0 } : { opacity: 0, y: -10, height: 0 }
        }
        animate={
          reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0, height: "auto" }
        }
        exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -8, height: 0 }}
        transition={SECTION_HEADING_TRANSITION}
        className="overflow-hidden"
      >
        <h2
          className={cn(
            "pl-8 font-serif font-semibold tracking-tight text-foreground/90 whitespace-pre-line",
            isSub ? "pt-4 pb-1 text-base" : "pt-6 pb-1 text-lg",
          )}
        >
          {title}
        </h2>
      </motion.div>
    );
  },
);
