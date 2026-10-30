import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type JSX,
  type ReactNode,
} from "react";

import { useIsMobile } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";

export function PinnedSessionAction({
  children,
}: {
  children: ReactNode;
}): JSX.Element {
  const isPhone = useIsMobile();
  const flowRef = useRef<HTMLDivElement>(null);
  const [pinned, setPinned] = useState(false);
  const [dockGap, setDockGap] = useState(80);

  useLayoutEffect(() => {
    if (!isPhone) return;
    const dock = document.querySelector('[aria-label="Mode"]');
    if (!(dock instanceof HTMLElement)) return;
    const update = () => {
      setDockGap(window.innerHeight - dock.getBoundingClientRect().top + 8);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(dock);
    window.addEventListener("resize", update);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [isPhone]);

  useEffect(() => {
    if (!isPhone) return;
    const node = flowRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        setPinned(entry ? !entry.isIntersecting : false);
      },
      { root: null, threshold: 1, rootMargin: `0px 0px -${dockGap}px 0px` },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [dockGap, isPhone]);

  return (
    <>
      <div ref={flowRef}>{children}</div>
      {isPhone && pinned ? (
        <div
          className={cn(
            "pointer-events-none fixed inset-x-0 z-30 flex justify-center px-4",
          )}
          style={{ bottom: dockGap }}
        >
          <div className="pointer-events-auto relative w-full max-w-xl">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 -top-6 h-6 bg-gradient-to-t from-background to-transparent"
            />
            <div className="rounded-t-xl border border-b-0 bg-background/95 px-3 py-2 shadow-sm backdrop-blur">
              {children}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
