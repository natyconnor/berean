import { forwardRef } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { SECTION_HEADING_TRANSITION } from "@/components/passage/note-animation-config";

interface SectionHeadingProps {
  title: string;
}

export const SectionHeading = forwardRef<HTMLDivElement, SectionHeadingProps>(
  function SectionHeading({ title }, ref) {
    const reduceMotion = useReducedMotion();

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
        <h2 className="pt-6 pb-1 pl-8 font-serif text-lg font-semibold tracking-tight text-foreground/90">
          {title}
        </h2>
      </motion.div>
    );
  },
);
