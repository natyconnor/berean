/**
 * Passage sticky chrome uses *container* queries, not the viewport.
 *
 * Compact in stages as the header gets tighter:
 *
 * 1. Passage column (`@container/chapter-chrome`): `@max-2xl` is 42rem
 *    (672px). Read mode's passage track stays around 33–34rem at the 1400px
 *    cap (1fr of the 1 / 1.4 split), so Headers and the chapter-note CTA
 *    stay collapsed in Read even at that cap.
 * 2. Whole header (`@container/passage-header`): notes chrome follows the
 *    header, not the notes track. Compose notes cap at 440px on wide
 *    screens and floor at 17.5rem, so a query on the notes column would
 *    not match the window.
 *    - `@max-6xl` (72rem / 1152px): shorten long copy (All Verses, empty state).
 *    - `@max-5xl` (64rem / 1024px): hide Focus / Compose / Read words.
 *    These widths are the header's content box, inside the compose gutter
 *    (`pl-16` + `pr-5` = 84px). They trip around a 1236px / 1108px window.
 * 3. Passage column under `@max-xs` (20rem / 320px): drop the Headers switch
 *    and the Memorize button from the row. Compose holds the passage track at
 *    about 24rem on a 768px window, so both stay; they leave only when that
 *    column itself is under 20rem. H still toggles section headings from the
 *    keyboard.
 * 4. Passage column under `@max-3xl` (48rem / 768px): the Memorize button
 *    drops its plan line to icon + one word ("Memorize"), a stage before the
 *    chapter-note CTA compacts, because the two-line button is the widest
 *    thing on the row.
 * 5. Passage column under `@max-md` (28rem / 448px) with the Memorize button
 *    on the row: the Headers switch leaves early, so icon + "Memorize" and
 *    the book name both still fit at the 24rem compose floor.
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
/** Memorize button: the two-line title and plan, hidden when compact. */
export const CHAPTER_CHROME_MEMORIZE_FULL_CLASS =
  "@max-3xl/chapter-chrome:hidden";
/** Memorize button: the one word shown in place of the title when compact. */
export const CHAPTER_CHROME_MEMORIZE_SHORT_CLASS =
  "hidden @max-3xl/chapter-chrome:inline";
/** Headers switch, when the Memorize button shares the row. */
export const CHAPTER_CHROME_MEMORIZE_CROWDED_HIDE_CLASS =
  "@max-md/chapter-chrome:hidden";
/** Compact, the one word never ellipsizes; the book name gives way instead. */
export const CHAPTER_CHROME_MEMORIZE_COMPACT_BUTTON_CLASS =
  "@max-3xl/chapter-chrome:h-8 @max-3xl/chapter-chrome:shrink-0 @max-3xl/chapter-chrome:gap-1.5 @max-3xl/chapter-chrome:px-2.5 @max-3xl/chapter-chrome:py-0";

export const PASSAGE_HEADER_CONTAINER_CLASS = "@container/passage-header";
export const NOTES_CHROME_COMPACT_LABEL_CLASS =
  "@max-5xl/passage-header:sr-only";
export const NOTES_CHROME_COMPACT_HIDE_CLASS = "@max-6xl/passage-header:hidden";
/**
 * Long labels stay in the accessibility tree when the short word is showing.
 * The short word is `aria-hidden`, so the name is not "All Verses All".
 * Noted's compact string still includes the visible word "Noted".
 */
export const NOTES_CHROME_COMPACT_SR_CLASS = "@max-6xl/passage-header:sr-only";
export const NOTES_CHROME_COMPACT_SHORT_CLASS =
  "hidden @max-6xl/passage-header:inline";

export const SHORTCUT_KBD_CLASS =
  "rounded border bg-muted px-1 py-0 text-[10px] font-medium leading-none text-muted-foreground";
