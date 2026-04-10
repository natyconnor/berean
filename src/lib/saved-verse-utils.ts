export function hasExactSavedSpan(
  saved: Array<{ startVerse: number; endVerse: number }>,
  startVerse: number,
  endVerse: number,
): boolean {
  return saved.some(
    (s) => s.startVerse === startVerse && s.endVerse === endVerse,
  );
}
