import { useCallback, useEffect, useRef, type RefObject } from "react";

const EDGE_ZONE_PX = 240;
const MAX_SCROLL_PX_PER_FRAME = 24;
const VERSE_NUMBER_ATTRIBUTE = "data-verse-number";

interface UseDragAutoScrollOptions {
  viewportRef: RefObject<HTMLDivElement | null>;
  isActive: boolean;
  onPointerOverVerse: (verseNumber: number) => void;
}

interface PointerPosition {
  x: number;
  y: number;
}

export function useDragAutoScroll({
  viewportRef,
  isActive,
  onPointerOverVerse,
}: UseDragAutoScrollOptions): void {
  const animationFrameRef = useRef<number | null>(null);
  const scrollFrameRef = useRef<() => void>(() => undefined);
  const pointerPositionRef = useRef<PointerPosition | null>(null);
  const onPointerOverVerseRef = useRef(onPointerOverVerse);

  useEffect(() => {
    onPointerOverVerseRef.current = onPointerOverVerse;
  }, [onPointerOverVerse]);

  const stopAutoScroll = useCallback(() => {
    if (animationFrameRef.current === null) return;

    window.cancelAnimationFrame(animationFrameRef.current);
    animationFrameRef.current = null;
  }, []);

  const requestNextFrame = useCallback(() => {
    animationFrameRef.current = window.requestAnimationFrame(() => {
      scrollFrameRef.current();
    });
  }, []);

  const updateVerseUnderPointer = useCallback(() => {
    const pointer = pointerPositionRef.current;
    if (!pointer) return;

    const target = document.elementFromPoint(pointer.x, pointer.y);
    const verseElement = target?.closest<HTMLElement>(
      `[${VERSE_NUMBER_ATTRIBUTE}]`,
    );
    const verseNumberValue = verseElement?.getAttribute(VERSE_NUMBER_ATTRIBUTE);
    if (!verseNumberValue) return;

    const verseNumber = Number(verseNumberValue);
    if (!Number.isInteger(verseNumber)) return;

    onPointerOverVerseRef.current(verseNumber);
  }, []);

  const getScrollStep = useCallback(() => {
    const viewport = viewportRef.current;
    const pointer = pointerPositionRef.current;
    if (!viewport || !pointer) return 0;

    const rect = viewport.getBoundingClientRect();
    const distanceFromTop = pointer.y - rect.top;
    const distanceFromBottom = rect.bottom - pointer.y;

    if (distanceFromTop >= 0 && distanceFromTop < EDGE_ZONE_PX) {
      const proximity = 1 - distanceFromTop / EDGE_ZONE_PX;
      return -MAX_SCROLL_PX_PER_FRAME * proximity * proximity;
    }

    if (distanceFromBottom >= 0 && distanceFromBottom < EDGE_ZONE_PX) {
      const proximity = 1 - distanceFromBottom / EDGE_ZONE_PX;
      return MAX_SCROLL_PX_PER_FRAME * proximity * proximity;
    }

    return 0;
  }, [viewportRef]);

  const scrollFrame = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) {
      stopAutoScroll();
      return;
    }

    const step = getScrollStep();
    if (step === 0) {
      stopAutoScroll();
      return;
    }

    const previousScrollTop = viewport.scrollTop;
    const maxScrollTop = viewport.scrollHeight - viewport.clientHeight;
    const nextScrollTop = Math.max(
      0,
      Math.min(maxScrollTop, previousScrollTop + step),
    );

    if (nextScrollTop === previousScrollTop) {
      stopAutoScroll();
      return;
    }

    viewport.scrollTop = nextScrollTop;
    updateVerseUnderPointer();

    requestNextFrame();
  }, [
    getScrollStep,
    requestNextFrame,
    stopAutoScroll,
    updateVerseUnderPointer,
    viewportRef,
  ]);

  useEffect(() => {
    scrollFrameRef.current = scrollFrame;
  }, [scrollFrame]);

  const startAutoScroll = useCallback(() => {
    if (animationFrameRef.current !== null) return;

    requestNextFrame();
  }, [requestNextFrame]);

  useEffect(() => {
    if (!isActive) {
      pointerPositionRef.current = null;
      stopAutoScroll();
      return;
    }

    const handleMouseMove = (event: MouseEvent) => {
      pointerPositionRef.current = { x: event.clientX, y: event.clientY };

      if (getScrollStep() === 0) {
        stopAutoScroll();
        return;
      }

      startAutoScroll();
    };

    document.addEventListener("mousemove", handleMouseMove);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      pointerPositionRef.current = null;
      stopAutoScroll();
    };
  }, [getScrollStep, isActive, startAutoScroll, stopAutoScroll]);
}
