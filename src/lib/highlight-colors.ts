export interface HighlightColor {
  id: string;
  label: string;
  /** Tailwind class for the <mark> background when applied to verse text */
  bg: string;
  /** Tailwind class for a more subtle indicator (collapsed verse rows) */
  bgSubtle: string;
  /** CSS color used for the toolbar swatch circle */
  swatch: string;
}

export const HIGHLIGHT_COLORS: HighlightColor[] = [
  {
    id: "yellow",
    label: "Yellow",
    bg: "bg-yellow-200/70 dark:bg-yellow-400/30",
    bgSubtle: "bg-yellow-200/40 dark:bg-yellow-400/15",
    swatch: "#FEF08A",
  },
  {
    id: "green",
    label: "Green",
    bg: "bg-green-200/70 dark:bg-green-400/30",
    bgSubtle: "bg-green-200/40 dark:bg-green-400/15",
    swatch: "#BBF7D0",
  },
  {
    id: "blue",
    label: "Blue",
    bg: "bg-blue-200/70 dark:bg-blue-400/30",
    bgSubtle: "bg-blue-200/40 dark:bg-blue-400/15",
    swatch: "#BFDBFE",
  },
  {
    id: "pink",
    label: "Pink",
    bg: "bg-pink-200/70 dark:bg-pink-400/30",
    bgSubtle: "bg-pink-200/40 dark:bg-pink-400/15",
    swatch: "#FBCFE8",
  },
  {
    id: "orange",
    label: "Orange",
    bg: "bg-orange-200/70 dark:bg-orange-400/30",
    bgSubtle: "bg-orange-200/40 dark:bg-orange-400/15",
    swatch: "#FED7AA",
  },
];

export function getHighlightColor(colorId: string): HighlightColor | undefined {
  return HIGHLIGHT_COLORS.find((c) => c.id === colorId);
}
