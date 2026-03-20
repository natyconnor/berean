import { getBookInfo } from "../src/lib/bible-books";
import { getChapterVerseCount } from "../src/lib/bible-verse-counts";

export interface VerseRefLike {
  book: string;
  chapter: number;
  startVerse: number;
  endVerse: number;
}

export type VerseRefBoundsErrorCode =
  | "unknown_book"
  | "invalid_chapter"
  | "invalid_range"
  | "verse_out_of_range";

export interface VerseRefBoundsValidation {
  valid: boolean;
  code?: VerseRefBoundsErrorCode;
  maxVerse?: number;
}

export function validateVerseRefBounds(
  ref: VerseRefLike,
): VerseRefBoundsValidation {
  const bookInfo = getBookInfo(ref.book);
  if (!bookInfo) {
    return { valid: false, code: "unknown_book" };
  }

  if (ref.chapter < 1 || ref.chapter > bookInfo.chapters) {
    return { valid: false, code: "invalid_chapter" };
  }

  if (ref.startVerse < 1 || ref.endVerse < ref.startVerse) {
    return { valid: false, code: "invalid_range" };
  }

  const maxVerse = getChapterVerseCount(ref.book, ref.chapter);
  if (!maxVerse) {
    return { valid: false, code: "invalid_chapter" };
  }

  if (ref.startVerse > maxVerse || ref.endVerse > maxVerse) {
    return { valid: false, code: "verse_out_of_range", maxVerse };
  }

  return { valid: true, maxVerse };
}

export function getVerseRefBoundsErrorMessage(
  ref: VerseRefLike,
): string | null {
  const validation = validateVerseRefBounds(ref);
  if (validation.valid) {
    return null;
  }

  switch (validation.code) {
    case "unknown_book":
      return "That book could not be recognized.";
    case "invalid_chapter": {
      const bookInfo = getBookInfo(ref.book);
      return bookInfo
        ? `${ref.book} has ${bookInfo.chapters} chapter${bookInfo.chapters === 1 ? "" : "s"}.`
        : "That chapter does not exist.";
    }
    case "invalid_range":
      if (ref.startVerse < 1) {
        return "Verse numbers start at 1.";
      }
      return "The ending verse must come after the starting verse.";
    case "verse_out_of_range":
      return validation.maxVerse
        ? `${ref.book} ${ref.chapter} only has ${validation.maxVerse} verse${validation.maxVerse === 1 ? "" : "s"}.`
        : "That verse does not exist.";
    default:
      return "That verse reference is invalid.";
  }
}
