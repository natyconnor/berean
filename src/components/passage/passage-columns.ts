/**
 * Shared passage / notes tracks. Header, verse rows, grouped passages, and
 * the chapter-notes overlay must use the same class or the columns drift.
 *
 * Read (`gap-6`, content gutter `pl-16 pr-6`, cap 1400px):
 * the old 1fr / 1.4fr split is the wide default (about 537 / 751 at the
 * cap, 487 / 681 at 1280). Notes can still drop below the old 520px floor
 * down to 17.5rem (280px) once the passage track is at 22rem, instead of
 * overflowing 360 / 520. Around 861px that is about 352 / 397; at 768px
 * about 352 / 304.
 *
 * Compose and Focus (`gap-5`, gutter `pl-16 pr-5`, cap 1320px):
 * notes prefer the old 440px cap on wide screens (about 776 / 440 at the
 * cap, 736 / 440 at 1280) while the passage track takes the 1.1fr remainder.
 * Once scripture would fall below 24rem, notes give width back toward
 * 17.5rem: around 900 / 861 / 768 that is about 384 / 412, 384 / 373, and
 * 384 / 280.
 */
export const READ_PASSAGE_COLUMNS_CLASS =
  "grid-cols-[minmax(22rem,1fr)_minmax(17.5rem,1.4fr)] gap-6";

export const COMPOSE_PASSAGE_COLUMNS_CLASS =
  "grid-cols-[minmax(24rem,1.1fr)_minmax(17.5rem,440px)] gap-5";

export function passageColumnsClass(isReadMode: boolean): string {
  return isReadMode
    ? READ_PASSAGE_COLUMNS_CLASS
    : COMPOSE_PASSAGE_COLUMNS_CLASS;
}
