import { useEffect, useRef } from "react";
import { Mic, Square } from "lucide-react";
import { useReducedMotion } from "framer-motion";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { isDevSpeechMockEnabled } from "@/lib/web-speech";

const WAVE_BAR_COUNT = 24;

function DictationWaveform({ active }: { active: boolean }) {
  const reduceMotion = useReducedMotion();
  const barsRef = useRef<Array<HTMLSpanElement | null>>([]);

  useEffect(() => {
    const bars = barsRef.current;
    if (!active || reduceMotion === true) {
      for (const bar of bars) {
        if (bar) bar.style.height = "6px";
      }
      return;
    }
    let raf = 0;
    const tick = (now: number) => {
      bars.forEach((bar, i) => {
        if (!bar) return;
        const a = Math.sin(now / 180 + i * 0.42);
        const b = Math.sin(now / 110 + i * 0.17);
        const level = 0.16 + 0.84 * Math.abs(a * 0.72 + b * 0.28);
        bar.style.height = `${Math.max(6, Math.round(level * 44))}px`;
      });
      raf = window.requestAnimationFrame(tick);
    };
    raf = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(raf);
  }, [active, reduceMotion]);

  return (
    <div
      className="flex h-12 items-end justify-center gap-[3px]"
      aria-hidden
      data-slot="dictation-waveform"
    >
      {Array.from({ length: WAVE_BAR_COUNT }, (_, index) => (
        <span
          key={index}
          ref={(element) => {
            barsRef.current[index] = element;
          }}
          className={cn(
            "w-[3px] rounded-full bg-primary/85",
            active ? "opacity-100" : "opacity-40",
          )}
          style={{ height: 6 }}
        />
      ))}
    </div>
  );
}

/**
 * Prominent dictation control under the recall textarea. Hidden by the parent
 * when the Web Speech API is missing.
 */
export function RecallDictationMic({
  listening,
  onToggle,
  disabled = false,
  onInsertSample,
}: {
  listening: boolean;
  onToggle: () => void;
  disabled?: boolean;
  onInsertSample?: () => void;
}) {
  return (
    <div className="flex flex-col items-stretch gap-2">
      {listening ? <DictationWaveform active /> : null}
      <Button
        type="button"
        variant={listening ? "default" : "outline"}
        size="lg"
        className={cn(
          "h-14 w-full text-base font-semibold",
          listening &&
            "bg-red-600 text-white hover:bg-red-600/90 dark:bg-red-600 dark:hover:bg-red-600/90",
        )}
        aria-pressed={listening}
        aria-label={listening ? "Stop dictation" : "Dictate verse"}
        onClick={onToggle}
        disabled={disabled}
      >
        {listening ? (
          <Square className="h-5 w-5" aria-hidden />
        ) : (
          <Mic className="h-5 w-5" aria-hidden />
        )}
        {listening ? "Stop listening" : "Speak the verse"}
      </Button>
      {listening ? (
        <p
          className="text-center text-xs text-muted-foreground"
          aria-live="polite"
        >
          Listening… words appear in the box. Edit, then Check.
        </p>
      ) : null}
      {listening && isDevSpeechMockEnabled() && onInsertSample ? (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="w-full"
          aria-label="Insert spoken sample"
          onClick={onInsertSample}
        >
          Insert spoken sample
        </Button>
      ) : null}
    </div>
  );
}
