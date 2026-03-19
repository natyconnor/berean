import type { Transition, Variants } from "framer-motion";

/**
 * Used as `transition={{ layout: LAYOUT_CORRECTION_TRANSITION }}` on motion.div
 * elements that have the `layout` prop. Controls how Framer Motion corrects
 * positions/sizes of neighbouring elements after a layout change.
 */
export const LAYOUT_CORRECTION_TRANSITION: Transition = {
  duration: 0.22,
  ease: [0.22, 1, 0.36, 1],
};

/**
 * Used for explicit `animate` props on verse-row elements (padding, fontSize).
 * Slightly longer than the layout correction so the content settles naturally.
 * Tune duration/ease here to adjust the verse growing animation.
 */
export const VERSE_EXPAND_TRANSITION: Transition = {
  duration: 0.28,
  ease: [0.22, 1, 0.36, 1],
};

/**
 * Used for note enter/exit animations (height: 0→auto, opacity, y-offset).
 * Kept short so notes appear quickly after a verse is expanded.
 */
export const NOTE_ENTER_TRANSITION: Transition = {
  duration: 0.15,
  ease: [0.22, 1, 0.36, 1],
};

/**
 * @deprecated Use LAYOUT_CORRECTION_TRANSITION for layout-prop transitions,
 * VERSE_EXPAND_TRANSITION for explicit verse animate transitions, or
 * NOTE_ENTER_TRANSITION for note enter/exit animations.
 */
export const NOTE_LAYOUT_TRANSITION: Transition = LAYOUT_CORRECTION_TRANSITION;

/**
 * Used for the merged passage block enter animation. Slightly delayed so
 * individual verse rows can exit first before the block slides in.
 */
export const MERGE_ENTER_TRANSITION: Transition = {
  duration: 0.28,
  ease: [0.22, 1, 0.36, 1],
  delay: 0.08,
};

export const NOTE_CONTENT_VARIANTS: Variants = {
  hidden: { opacity: 0, y: -4 },
  visible: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -2 },
};

export const NOTE_FADE_VARIANTS: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
  exit: { opacity: 0 },
};
