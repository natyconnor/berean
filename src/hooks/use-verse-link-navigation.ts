import { useCallback } from "react";
import { useTabs } from "@/lib/use-tabs";
import {
  isChapterScopeRef,
  toPassageId,
  type VerseRef,
} from "@/lib/verse-ref-utils";

export interface CurrentChapter {
  book: string;
  chapter: number;
}

/**
 * Returns a handler for click on verse link pills.
 * - Same chapter: navigates active tab with focus params (scrolls to verse)
 * - Different chapter: opens new tab with passage and scrolls to verse
 * - Chapter-scoped links open the chapter with no verse focus params
 */
export function useVerseLinkNavigation(currentChapter?: CurrentChapter) {
  const { openTab, navigateActiveTab } = useTabs();

  return useCallback(
    (ref: VerseRef) => {
      const passageId = toPassageId(ref.book, ref.chapter);
      const label = `${ref.book} ${ref.chapter}`;
      const search = isChapterScopeRef(ref)
        ? {}
        : { startVerse: ref.startVerse, endVerse: ref.endVerse };

      if (
        currentChapter &&
        ref.book === currentChapter.book &&
        ref.chapter === currentChapter.chapter
      ) {
        navigateActiveTab(passageId, label, search);
      } else {
        openTab(passageId, label, search);
      }
    },
    [currentChapter, openTab, navigateActiveTab],
  );
}
