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
 * the passage track takes about 2.5 shares and notes takes 1, so notes
 * gives width back before scripture tightens. Notes floors at 17.5rem
 * (280px) while the passage is still above 30rem: around 1024 / 960 / 900
 * that is about 640 / 280, 576 / 280, and 516 / 280. Both floors fit a
 * 768px window (about 384 / 280).
 */
export const READ_PASSAGE_COLUMNS_CLASS =
  "grid-cols-[minmax(22rem,34rem)_minmax(17.5rem,1fr)] gap-6";

export const COMPOSE_PASSAGE_COLUMNS_CLASS =
  "grid-cols-[minmax(24rem,2.5fr)_minmax(17.5rem,1fr)] gap-5";

export function passageColumnsClass(isReadMode: boolean): string {
  return isReadMode
    ? READ_PASSAGE_COLUMNS_CLASS
    : COMPOSE_PASSAGE_COLUMNS_CLASS;
}
