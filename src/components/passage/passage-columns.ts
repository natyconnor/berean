/**
 * Shared passage / notes tracks. Header, verse rows, grouped passages, and
 * the chapter-notes overlay must use the same class or the columns drift.
 *
 * Read (`gap-6`, content gutter `pl-16 pr-6`, cap 1400px):
 * the passage track holds 34rem (544px) and the notes track takes the rest,
 * so notes gives width back as the window narrows. Notes floors at 17.5rem
 * (280px); only then does the passage track shrink, and not below 22rem.
 * At the 1400px cap that is about 544 / 744. Around 861px it is about 469 / 280
 * instead of the old 360 / 520 overflow.
 *
 * Compose and Focus (`gap-5`, gutter `pl-16 pr-5`, cap 1320px):
 * notes stay at their 27.5rem (440px) cap while the passage is wide, then
 * give width back once the passage track would drop under 24rem (384px).
 * Notes floor at 17.5rem. Both floors fit a 768px window (about 384 / 280).
 */
export const READ_PASSAGE_COLUMNS_CLASS =
  "grid-cols-[minmax(22rem,34rem)_minmax(17.5rem,1fr)] gap-6";

export const COMPOSE_PASSAGE_COLUMNS_CLASS =
  "grid-cols-[minmax(24rem,1fr)_minmax(17.5rem,27.5rem)] gap-5";

export function passageColumnsClass(isReadMode: boolean): string {
  return isReadMode
    ? READ_PASSAGE_COLUMNS_CLASS
    : COMPOSE_PASSAGE_COLUMNS_CLASS;
}
