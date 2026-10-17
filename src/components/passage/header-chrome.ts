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
 * 4. The Memorize button gets only the space the rest of the row leaves
 *    (`@container/chapter-memorize`), so the book name never shortens while
 *    the button still has words to give up. In that slot it shows its line
 *    ("Memorize Psalm 1") while the slot holds it whole. Past that, the
 *    start state keeps one word ("Memorize") down to 9rem; every other state
 *    goes straight to the icon, which wears a progress ring or a check.
 * 5. With the Memorize button on the row, the Headers switch gives way
 *    first so long book names ("1 Thessalonians") keep their room: its word
 *    goes under `@max-3xl` (48rem / 768px) and the whole switch under
 *    `@max-lg` (32rem / 512px).
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
/**
 * Memorize button slot: zero basis, so it grows into leftover space but never
 * makes the book name shrink. Its floor is the icon-only button. Under
 * `@max-xs` the button leaves and the slot stays as the spacer that keeps the
 * chapter-note well pushed right.
 */
export const CHAPTER_CHROME_MEMORIZE_SLOT_CLASS =
  "@container/chapter-memorize flex min-w-8 flex-1 justify-end @max-xs/chapter-chrome:min-w-0";
/**
 * Memorize button: capped, gone on the tightest column. Where it narrows to
 * its icon depends on its line; see {@link chapterMemorizeStageClasses}.
 */
export const CHAPTER_CHROME_MEMORIZE_BUTTON_CLASS =
  "max-w-60 @max-xs/chapter-chrome:hidden";
/** Headers word, when the Memorize button shares the row. */
export const CHAPTER_CHROME_MEMORIZE_CROWDED_LABEL_CLASS =
  "@max-3xl/chapter-chrome:sr-only";
/** Headers switch, when the Memorize button shares the row. */
export const CHAPTER_CHROME_MEMORIZE_CROWDED_HIDE_CLASS =
  "@max-lg/chapter-chrome:hidden";

/**
 * Slot widths (rem) where the Memorize button changes stage, each with the
 * classes that apply under it: `hide` drops an element, `word` shows the one
 * word, `mark` shows the icon's state mark, `icon` narrows the button to its
 * icon. Every class is written out so Tailwind generates its container query.
 */
const MEMORIZE_SLOT_STAGES = [
  {
    rem: 9,
    hide: "@max-[9rem]/chapter-memorize:hidden",
    word: "hidden @max-[9rem]/chapter-memorize:inline",
    mark: "hidden @max-[9rem]/chapter-memorize:block",
    icon: "@max-[9rem]/chapter-memorize:w-8 @max-[9rem]/chapter-memorize:justify-center @max-[9rem]/chapter-memorize:px-0",
  },
  {
    rem: 10,
    hide: "@max-[10rem]/chapter-memorize:hidden",
    word: "hidden @max-[10rem]/chapter-memorize:inline",
    mark: "hidden @max-[10rem]/chapter-memorize:block",
    icon: "@max-[10rem]/chapter-memorize:w-8 @max-[10rem]/chapter-memorize:justify-center @max-[10rem]/chapter-memorize:px-0",
  },
  {
    rem: 11,
    hide: "@max-[11rem]/chapter-memorize:hidden",
    word: "hidden @max-[11rem]/chapter-memorize:inline",
    mark: "hidden @max-[11rem]/chapter-memorize:block",
    icon: "@max-[11rem]/chapter-memorize:w-8 @max-[11rem]/chapter-memorize:justify-center @max-[11rem]/chapter-memorize:px-0",
  },
  {
    rem: 12,
    hide: "@max-[12rem]/chapter-memorize:hidden",
    word: "hidden @max-[12rem]/chapter-memorize:inline",
    mark: "hidden @max-[12rem]/chapter-memorize:block",
    icon: "@max-[12rem]/chapter-memorize:w-8 @max-[12rem]/chapter-memorize:justify-center @max-[12rem]/chapter-memorize:px-0",
  },
  {
    rem: 13,
    hide: "@max-[13rem]/chapter-memorize:hidden",
    word: "hidden @max-[13rem]/chapter-memorize:inline",
    mark: "hidden @max-[13rem]/chapter-memorize:block",
    icon: "@max-[13rem]/chapter-memorize:w-8 @max-[13rem]/chapter-memorize:justify-center @max-[13rem]/chapter-memorize:px-0",
  },
  {
    rem: 14,
    hide: "@max-[14rem]/chapter-memorize:hidden",
    word: "hidden @max-[14rem]/chapter-memorize:inline",
    mark: "hidden @max-[14rem]/chapter-memorize:block",
    icon: "@max-[14rem]/chapter-memorize:w-8 @max-[14rem]/chapter-memorize:justify-center @max-[14rem]/chapter-memorize:px-0",
  },
] as const;
/** The button's `max-w-60`: a longer line ellipsizes inside it. */
const MEMORIZE_LINE_WIDEST = {
  rem: 15,
  hide: "@max-[15rem]/chapter-memorize:hidden",
  word: "hidden @max-[15rem]/chapter-memorize:inline",
  mark: "hidden @max-[15rem]/chapter-memorize:block",
  icon: "@max-[15rem]/chapter-memorize:w-8 @max-[15rem]/chapter-memorize:justify-center @max-[15rem]/chapter-memorize:px-0",
} as const;
/**
 * "Memorize" alone needs about 6.5rem. Under 9rem it is the icon too, so the
 * word shows only with room to spare.
 */
const MEMORIZE_WORD_FLOOR = MEMORIZE_SLOT_STAGES[0];
/** A passage title may ellipsize once "Part of" and a few letters fit. */
const MEMORIZE_ELLIPSIZE_REM = 10;
const MEMORIZE_LINE_ICON_PAD_REM = 2.75;
const MEMORIZE_LINE_CHAR_REM = 0.45;
/** `@max-[Nrem]` is exclusive at N, and the character estimate runs short. */
const MEMORIZE_LINE_SLACK_REM = 1;

export interface ChapterMemorizeStageClasses {
  /** The full line. */
  line: string;
  /** The one word between the line and the icon; `null` skips that stage. */
  word: string | null;
  /** The state mark, shown only on the bare icon. */
  mark: string;
  /** The button, narrowed to its icon. */
  button: string;
}

/**
 * Container-query classes for the Memorize button's stages. The line shows
 * only while the slot holds it whole, so "Memorize Psalm 119" never
 * ellipsizes into "Memorize Psalm 1…". At 13px semibold a line runs about
 * 0.45rem a character plus 2.75rem of icon and padding. `ellipsize` lines (a
 * passage title) show from 10rem and truncate. With `word`, the word takes
 * over from the line down to 9rem; without it, the line gives way to the icon.
 */
export function chapterMemorizeStageClasses(
  line: string,
  { ellipsize, word }: { ellipsize: boolean; word: boolean },
): ChapterMemorizeStageClasses {
  const needed =
    Math.ceil(
      MEMORIZE_LINE_ICON_PAD_REM + MEMORIZE_LINE_CHAR_REM * line.length,
    ) + MEMORIZE_LINE_SLACK_REM;
  const rem = ellipsize ? Math.min(needed, MEMORIZE_ELLIPSIZE_REM) : needed;
  const lineStage =
    MEMORIZE_SLOT_STAGES.find((candidate) => candidate.rem >= rem) ??
    MEMORIZE_LINE_WIDEST;
  const hasWord = word && lineStage.rem > MEMORIZE_WORD_FLOOR.rem;
  const iconStage = hasWord ? MEMORIZE_WORD_FLOOR : lineStage;
  return {
    line: lineStage.hide,
    word: hasWord ? `${lineStage.word} ${MEMORIZE_WORD_FLOOR.hide}` : null,
    mark: iconStage.mark,
    button: iconStage.icon,
  };
}

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
