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

/** Calmer note reveal for manuscript — slightly longer, softer ease. */
export const MANUSCRIPT_NOTE_ENTER_TRANSITION: Transition = {
  duration: 0.22,
  ease: [0.33, 0.46, 0.32, 0.99],
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

/**
 * Used for the passage open/close crossfade. With popLayout mode on
 * AnimatePresence, exiting items leave layout flow immediately so this
 * only needs to drive the opacity transition.
 */
export const CROSSFADE_TRANSITION: Transition = {
  duration: 0.25,
  ease: [0.22, 1, 0.36, 1],
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

/**
 * Exit transition for note deletion: slide toward the trailing (delete-button)
 * side + fade out. When prefers-reduced-motion is active, callers should use
 * NOTE_DELETE_REDUCED_EXIT instead.
 */
export const NOTE_DELETE_EXIT_TRANSITION: Transition = {
  duration: 0.2,
  ease: [0.22, 1, 0.36, 1],
};

/** Slide right + fade for note delete exit. */
export const NOTE_DELETE_EXIT = {
  x: 14,
  opacity: 0,
  transition: NOTE_DELETE_EXIT_TRANSITION,
};

/** Opacity-only exit for prefers-reduced-motion. */
export const NOTE_DELETE_REDUCED_EXIT = {
  opacity: 0,
  transition: { duration: 0.1 },
};

/**
 * Height-collapse backup exit (use if slide feels wrong in QA):
 *   exit={{ height: 0, opacity: 0, overflow: "hidden", transition: NOTE_DELETE_EXIT_TRANSITION }}
 */

/** Delay (ms) between note exit animation and panel collapse. */
export const PANEL_COLLAPSE_STAGGER_MS = 100;

/** x-keyframes for a short shake on a restored note (failed delete). */
export const NOTE_SHAKE_KEYFRAMES = [0, -6, 5, -3, 2, 0];
