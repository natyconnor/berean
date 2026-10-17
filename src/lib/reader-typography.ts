/**
 * Verse text in the reader (`verse-row.tsx`): the serif face, wrapped lines,
 * relaxed leading. Session hints, answers, and recall boxes use it too, so
 * practice reads like the page the verse came from.
 */
export const READER_VERSE_TEXT_CLASS =
  "font-serif w-full whitespace-pre-wrap leading-relaxed";

/**
 * The reader's read-mode verse size (`COLLAPSED_READING` in `verse-row.tsx`,
 * 19px). The `md:` copy beats inputs' desktop `md:text-sm`; staying over 16px
 * keeps iOS from zooming on focus.
 */
export const READER_VERSE_SIZE_CLASS = "text-[1.1875rem] md:text-[1.1875rem]";

/**
 * Session verse text: the reader's type at its read-mode size. The size comes
 * first because `cn` drops a line height that precedes a font size.
 */
export const SESSION_VERSE_TEXT_CLASS = `${READER_VERSE_SIZE_CLASS} ${READER_VERSE_TEXT_CLASS}`;

/** About the reader column's line length. */
export const READER_MEASURE_CLASS = "max-w-[65ch]";

/** A reference above session text: the reader's chapter heading, a size down. */
export const READER_REFERENCE_CLASS =
  "font-serif text-xl font-semibold tracking-tight";
