import { useCallback, useLayoutEffect, useState } from "react";

function regionOverflows(element: HTMLElement): boolean {
  return (
    element.scrollHeight > element.clientHeight + 1 ||
    element.scrollWidth > element.clientWidth + 1
  );
}

function scrolledToEnd(element: HTMLElement): boolean {
  const remaining =
    element.scrollHeight - element.scrollTop - element.clientHeight;
  return remaining <= 1;
}

/**
 * Tab stop only while the box scrolls, plus a fade while more text sits below.
 */
export function useScrollFade(): {
  ref: (node: HTMLElement | null) => void;
  tabIndex: 0 | undefined;
  fade: boolean;
} {
  const [element, setElement] = useState<HTMLElement | null>(null);
  const [overflowing, setOverflowing] = useState(false);
  const [atEnd, setAtEnd] = useState(true);

  const ref = useCallback((node: HTMLElement | null) => {
    setElement(node);
    if (!node) {
      setOverflowing(false);
      setAtEnd(true);
      return;
    }
    setOverflowing(regionOverflows(node));
    setAtEnd(scrolledToEnd(node));
  }, []);

  useLayoutEffect(() => {
    if (!element) return;

    const update = () => {
      setOverflowing(regionOverflows(element));
      setAtEnd(scrolledToEnd(element));
    };

    update();
    element.addEventListener("scroll", update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(element);
    for (const child of element.children) {
      observer.observe(child);
    }
    return () => {
      element.removeEventListener("scroll", update);
      observer.disconnect();
    };
  }, [element]);

  return {
    ref,
    tabIndex: overflowing ? 0 : undefined,
    fade: overflowing && !atEnd,
  };
}
