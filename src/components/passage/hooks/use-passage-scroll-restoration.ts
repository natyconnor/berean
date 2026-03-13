import { useEffect, useRef, useState } from "react";

interface UsePassageScrollRestorationOptions {
  book: string;
  chapter: number;
  focusStartVerse?: number;
  focusRequestKey: string | null;
  focusLayoutKey: string | null;
  hasData: boolean;
  containerRef: React.RefObject<HTMLDivElement | null>;
  viewportRef: React.RefObject<HTMLDivElement | null>;
}

export function usePassageScrollRestoration({
  book,
  chapter,
  focusStartVerse,
  focusRequestKey,
  focusLayoutKey,
  hasData,
  containerRef,
  viewportRef,
}: UsePassageScrollRestorationOptions) {
  const [isScrolled, setIsScrolled] = useState(false);
  const handledFocusRequestRef = useRef<string | null>(null);
  const savedScrollPositions = useRef(new Map<string, number>());

  useEffect(() => {
    if (!focusLayoutKey || typeof focusStartVerse !== "number") {
      handledFocusRequestRef.current = null;
      return;
    }
    if (!hasData) return;
    if (handledFocusRequestRef.current === focusLayoutKey) return;

    let attempts = 0;
    const maxAttempts = 30;

    const scrollToTarget = () => {
      const viewport = viewportRef.current;
      const selector = `[data-verse-number="${focusStartVerse}"]`;
      const target =
        containerRef.current?.querySelector<HTMLElement>(selector) ??
        document.querySelector<HTMLElement>(selector);

      if (!target || !viewport) return false;

      const viewportRect = viewport.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();
      const nextScrollTop = Math.max(
        targetRect.top -
          viewportRect.top +
          viewport.scrollTop -
          viewport.clientHeight / 2 +
          targetRect.height / 2,
        0,
      );

      viewport.scrollTo({ top: nextScrollTop, behavior: "smooth" });
      handledFocusRequestRef.current = focusLayoutKey;
      return true;
    };

    if (scrollToTarget()) return;

    const intervalId = window.setInterval(() => {
      attempts += 1;
      if (scrollToTarget() || attempts >= maxAttempts) {
        window.clearInterval(intervalId);
      }
    }, 100);

    return () => window.clearInterval(intervalId);
  }, [containerRef, focusLayoutKey, focusStartVerse, hasData, viewportRef]);

  useEffect(() => {
    const key = `${book}-${chapter}`;
    const viewport = viewportRef.current;
    const scrollPositions = savedScrollPositions.current;
    return () => {
      if (viewport) {
        scrollPositions.set(key, viewport.scrollTop);
      }
    };
  }, [book, chapter, viewportRef]);

  useEffect(() => {
    if (focusRequestKey) return;
    const viewport = viewportRef.current;
    if (!viewport) return;

    const saved = savedScrollPositions.current.get(`${book}-${chapter}`) ?? 0;
    viewport.scrollTop = saved;
    queueMicrotask(() => {
      setIsScrolled(saved > 0);
    });
  }, [book, chapter, focusRequestKey, viewportRef]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const onScroll = () => setIsScrolled(viewport.scrollTop > 0);
    viewport.addEventListener("scroll", onScroll, { passive: true });
    return () => viewport.removeEventListener("scroll", onScroll);
  }, [viewportRef]);

  return { isScrolled };
}
