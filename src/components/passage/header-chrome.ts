/**
 * Passage sticky chrome uses *container* queries, not the viewport.
 *
 * Read mode gives the passage column `minmax(360px, 1fr)` beside a wider notes
 * pane, so Headers + the chapter-note CTA overflow on ordinary desktop widths
 * even though the window itself is large. Compact labels when *that column*
 * is tight, and independently compact the notes toolbar when its column is.
 *
 * `@max-2xl` is 42rem (672px): the read-mode passage column sits under this
 * even at the 1400px content cap. `@max-xl` is 36rem (576px): the compose-mode
 * notes pane (360–440px) and the tightest read-mode notes pane compact, while
 * a typical wide read-mode notes pane keeps full labels.
 */
export const CHAPTER_CHROME_CONTAINER_CLASS = "@container/chapter-chrome";
export const CHAPTER_CHROME_COMPACT_LABEL_CLASS =
  "@max-2xl/chapter-chrome:sr-only";
export const CHAPTER_CHROME_COMPACT_HIDE_CLASS =
  "@max-2xl/chapter-chrome:hidden";
export const CHAPTER_CHROME_COMPACT_ICON_BUTTON_CLASS =
  "@max-2xl/chapter-chrome:size-8 @max-2xl/chapter-chrome:max-w-none @max-2xl/chapter-chrome:justify-center @max-2xl/chapter-chrome:gap-0 @max-2xl/chapter-chrome:px-0 @max-2xl/chapter-chrome:py-0";

export const NOTES_CHROME_CONTAINER_CLASS = "@container/notes-chrome";
export const NOTES_CHROME_COMPACT_LABEL_CLASS = "@max-xl/notes-chrome:sr-only";
export const NOTES_CHROME_COMPACT_HIDE_CLASS = "@max-xl/notes-chrome:hidden";
export const NOTES_CHROME_COMPACT_SHORT_CLASS =
  "hidden @max-xl/notes-chrome:inline";

export const SHORTCUT_KBD_CLASS =
  "rounded border bg-muted px-1 py-0 text-[10px] font-medium leading-none text-muted-foreground";
