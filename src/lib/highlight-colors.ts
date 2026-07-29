export interface HighlightColor {
  id: string;
  label: string;
  /** Tailwind class for the <mark> background when applied to verse text */
  bg: string;
  /** Tailwind class for a more subtle indicator (collapsed verse rows) */
  bgSubtle: string;
  /** Swatch background adjusted for the popover's darker surface */
  swatchBg: string;
}

export const HIGHLIGHT_COLORS: HighlightColor[] = [
  {
    id: "yellow",
    label: "Yellow",
    bg: "bg-yellow-200/70 dark:bg-yellow-400/30",
    bgSubtle: "bg-yellow-200/40 dark:bg-yellow-400/15",
    swatchBg: "bg-yellow-200/70 dark:bg-yellow-400/40",
  },
  {
    id: "green",
    label: "Green",
    bg: "bg-green-200/70 dark:bg-green-400/30",
    bgSubtle: "bg-green-200/40 dark:bg-green-400/15",
    swatchBg: "bg-green-200/70 dark:bg-green-400/40",
  },
  {
    id: "blue",
    label: "Blue",
    bg: "bg-blue-200/70 dark:bg-blue-400/30",
    bgSubtle: "bg-blue-200/40 dark:bg-blue-400/15",
    swatchBg: "bg-blue-200/70 dark:bg-blue-400/40",
  },
  {
    id: "pink",
    label: "Pink",
    bg: "bg-pink-200/70 dark:bg-pink-400/30",
    bgSubtle: "bg-pink-200/40 dark:bg-pink-400/15",
    swatchBg: "bg-pink-200/70 dark:bg-pink-400/40",
  },
  {
    id: "orange",
    label: "Orange",
    bg: "bg-orange-200/70 dark:bg-orange-400/30",
    bgSubtle: "bg-orange-200/40 dark:bg-orange-400/15",
    swatchBg: "bg-orange-200/70 dark:bg-orange-400/40",
  },
];

export function getHighlightColor(colorId: string): HighlightColor | undefined {
  return HIGHLIGHT_COLORS.find((c) => c.id === colorId);
}
