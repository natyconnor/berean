/**
 * Passage sticky chrome uses *container* queries, not the viewport.
 *
 * Compact in stages as the header gets tighter:
 *
 * 1. Passage column (`@container/chapter-chrome`): `@max-2xl` is 42rem
 *    (672px). Read mode's left track is under this even at the 1400px content
 *    cap, so Headers + the chapter-note CTA collapse first.
 * 2. Whole header (`@container/passage-header`): the compose notes track is
 *    `minmax(360px, 440px)`, so a query on that column never sees "the window
 *    got narrow" — it stays ~440px while the passage side is crushed. Query
 *    the header instead so notes chrome can follow.
 *    - `@max-6xl` (72rem / 1152px): shorten long copy (All Verses, empty state).
 *    - `@max-5xl` (64rem / 1024px): hide Focus / Compose / Read words.
 *    These widths are the header's content box, inside the compose gutter
 *    (`pl-16` + `pr-5` = 84px). They trip around a 1236px / 1108px window.
 * 3. Passage column under `@max-xs` (20rem / 320px): drop the Headers switch
 *    from the row. Arrows, a truncating book name, the chapter, and the note
 *    icon still fit a ~224px compose column (about a 768px window). H still
 *    toggles section headings from the keyboard.
 *
 * At a typical 1280px compose layout the header content box is still above
 * 5xl, so those words stay. They drop once the window is actually tight.
 */
export const CHAPTER_CHROME_CONTAINER_CLASS = "@container/chapter-chrome";
export const CHAPTER_CHROME_COMPACT_LABEL_CLASS =
  "@max-2xl/chapter-chrome:sr-only";
export const CHAPTER_CHROME_COMPACT_HIDE_CLASS =
  "@max-2xl/chapter-chrome:hidden";
export const CHAPTER_CHROME_COMPACT_ICON_BUTTON_CLASS =
  "@max-2xl/chapter-chrome:size-8 @max-2xl/chapter-chrome:max-w-none @max-2xl/chapter-chrome:justify-center @max-2xl/chapter-chrome:gap-0 @max-2xl/chapter-chrome:px-0 @max-2xl/chapter-chrome:py-0";
/** Headers switch leaves the row once the passage column cannot hold it. */
export const CHAPTER_CHROME_TIGHT_HIDE_CLASS = "@max-xs/chapter-chrome:hidden";

export const PASSAGE_HEADER_CONTAINER_CLASS = "@container/passage-header";
export const NOTES_CHROME_COMPACT_LABEL_CLASS =
  "@max-5xl/passage-header:sr-only";
export const NOTES_CHROME_COMPACT_HIDE_CLASS = "@max-6xl/passage-header:hidden";
/**
 * Long labels stay in the accessibility tree when the short word is showing,
 * so the accessible name still contains the visible text.
 */
export const NOTES_CHROME_COMPACT_SR_CLASS = "@max-6xl/passage-header:sr-only";
export const NOTES_CHROME_COMPACT_SHORT_CLASS =
  "hidden @max-6xl/passage-header:inline";

export const SHORTCUT_KBD_CLASS =
  "rounded border bg-muted px-1 py-0 text-[10px] font-medium leading-none text-muted-foreground";
