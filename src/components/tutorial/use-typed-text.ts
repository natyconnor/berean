import { useEffect, useState } from "react";

interface UseTypedTextOptions {
  active: boolean;
  text: string;
  charIntervalMs?: number;
  startDelayMs?: number;
  loop?: boolean;
  pauseAtEndMs?: number;
}

export function useTypedText({
  active,
  text,
  charIntervalMs = 28,
  startDelayMs = 0,
  loop = false,
  pauseAtEndMs = 900,
}: UseTypedTextOptions) {
  const [visibleText, setVisibleText] = useState(active ? "" : text);
  const [isComplete, setIsComplete] = useState(!active || text.length === 0);

  useEffect(() => {
    let timeoutId: number | null = null;
    let cancelled = false;

    if (!active) {
      timeoutId = window.setTimeout(() => {
        if (cancelled) return;
        setVisibleText(text);
        setIsComplete(true);
      }, 0);
      return;
    }

    const startCycle = () => {
      if (cancelled) return;

      setVisibleText("");
      setIsComplete(text.length === 0);

      if (text.length === 0) {
        setIsComplete(true);
        if (loop) {
          timeoutId = window.setTimeout(startCycle, pauseAtEndMs);
        }
        return;
      }

      let nextIndex = 0;

      const tick = () => {
        if (cancelled) return;

        nextIndex += 1;
        setVisibleText(text.slice(0, nextIndex));

        if (nextIndex >= text.length) {
          setIsComplete(true);
          if (loop) {
            timeoutId = window.setTimeout(startCycle, pauseAtEndMs);
          }
          return;
        }

        timeoutId = window.setTimeout(tick, charIntervalMs);
      };

      timeoutId = window.setTimeout(tick, charIntervalMs);
    };

    timeoutId = window.setTimeout(() => {
      if (cancelled) return;
      startCycle();
    }, startDelayMs);

    return () => {
      cancelled = true;
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [active, charIntervalMs, loop, pauseAtEndMs, startDelayMs, text]);

  return {
    visibleText,
    isComplete,
  };
}
