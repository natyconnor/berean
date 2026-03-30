import { useEffect, useState, type RefObject } from "react";

export interface UseNearViewportVisibleOptions {
  /** Passed to IntersectionObserver; expands the effective viewport for earlier prefetch. */
  rootMargin?: string;
}

/**
 * Latches to `true` once `targetRef` intersects the scroll `rootRef` (e.g. ScrollArea viewport).
 * Uses rAF until `targetRef` / `rootRef` exist so rows can mount before refs attach.
 */
export function useNearViewportVisible(
  targetRef: RefObject<Element | null>,
  rootRef: RefObject<Element | null>,
  options?: UseNearViewportVisibleOptions,
): boolean {
  const [visible, setVisible] = useState(false);
  const rootMargin = options?.rootMargin ?? "240px 0px";

  useEffect(() => {
    if (visible) {
      return;
    }

    let observer: IntersectionObserver | null = null;
    let rafId = 0;
    const maxAttempts = 120;

    const cleanupObserver = () => {
      observer?.disconnect();
      observer = null;
    };

    const cancelScheduled = () => {
      cancelAnimationFrame(rafId);
    };

    const attachWhenRootReady = (target: Element): void => {
      let rootAttempts = 0;

      const tryRoot = (): void => {
        const root = rootRef.current;
        if (root) {
          cleanupObserver();
          observer = new IntersectionObserver(
            (entries) => {
              if (entries[0]?.isIntersecting) {
                setVisible(true);
              }
            },
            { root, rootMargin, threshold: 0 },
          );
          observer.observe(target);
          return;
        }

        rootAttempts += 1;
        if (rootAttempts < maxAttempts) {
          rafId = requestAnimationFrame(tryRoot);
        } else {
          setVisible(true);
        }
      };

      tryRoot();
    };

    let targetAttempts = 0;

    const ensureTarget = (): void => {
      const target = targetRef.current;
      if (target) {
        attachWhenRootReady(target);
        return;
      }

      targetAttempts += 1;
      if (targetAttempts < maxAttempts) {
        rafId = requestAnimationFrame(ensureTarget);
      }
    };

    ensureTarget();

    return () => {
      cancelScheduled();
      cleanupObserver();
    };
  }, [rootMargin, rootRef, targetRef, visible]);

  return visible;
}
