import { useLayoutEffect, useState } from "react";

function regionOverflows(element: HTMLElement): boolean {
  return (
    element.scrollHeight > element.clientHeight ||
    element.scrollWidth > element.clientWidth
  );
}

/**
 * A scroll region's `tabIndex` is `0` only while it actually overflows.
 * Otherwise the attribute stays off, so a box that does not scroll is not a
 * tab stop.
 */
export function useOverflowTabIndex(): {
  ref: (node: HTMLDivElement | null) => void;
  tabIndex: 0 | undefined;
} {
  const [element, setElement] = useState<HTMLDivElement | null>(null);
  const [overflowing, setOverflowing] = useState(false);

  useLayoutEffect(() => {
    if (!element) {
      setOverflowing((current) => (current ? false : current));
      return;
    }

    const update = () => {
      const next = regionOverflows(element);
      setOverflowing((current) => (current === next ? current : next));
    };

    const observer = new ResizeObserver(update);
    observer.observe(element);
    for (const child of element.children) {
      observer.observe(child);
    }
    update();
    return () => observer.disconnect();
  }, [element]);

  return { ref: setElement, tabIndex: overflowing ? 0 : undefined };
}
