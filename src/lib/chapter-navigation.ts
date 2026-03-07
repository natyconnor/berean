import { BIBLE_BOOKS, getBookInfo } from "@/lib/bible-books"
import { toPassageId } from "@/lib/verse-ref-utils"

export interface ChapterDestination {
  book: string
  chapter: number
  passageId: string
  label: string
}

export interface AdjacentChapterDestinations {
  previous: ChapterDestination | null
  next: ChapterDestination | null
}

function toDestination(book: string, chapter: number): ChapterDestination {
  return {
    book,
    chapter,
    passageId: toPassageId(book, chapter),
    label: `${book} ${chapter}`,
  }
}

export function getAdjacentChapterDestinations(
  book: string,
  chapter: number
): AdjacentChapterDestinations {
  const bookInfo = getBookInfo(book)
  const bookIndex = BIBLE_BOOKS.findIndex((entry) => entry.name === book)

  if (!bookInfo || bookIndex === -1) {
    return { previous: null, next: null }
  }

  const previous =
    chapter > 1
      ? toDestination(book, chapter - 1)
      : bookIndex > 0
        ? toDestination(
            BIBLE_BOOKS[bookIndex - 1].name,
            BIBLE_BOOKS[bookIndex - 1].chapters
          )
        : null

  const next =
    chapter < bookInfo.chapters
      ? toDestination(book, chapter + 1)
      : bookIndex < BIBLE_BOOKS.length - 1
        ? toDestination(BIBLE_BOOKS[bookIndex + 1].name, 1)
        : null

  return { previous, next }
}
