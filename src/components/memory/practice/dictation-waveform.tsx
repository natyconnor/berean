import { useEffect, useRef } from "react";

import { cn } from "@/lib/utils";

import {
  barHeightsFromTimeDomain,
  openLiveMicAnalyser,
  WAVE_BAR_COUNT,
  WAVE_MIN_HEIGHT_PX,
  type LiveMicAnalyser,
} from "./mic-amplitude";

function resetBars(bars: Array<HTMLSpanElement | null>) {
  for (const bar of bars) {
    if (bar) bar.style.height = `${WAVE_MIN_HEIGHT_PX}px`;
  }
}

/**
 * Equalizer-style bars driven by live microphone amplitude while listening.
 * Opens getUserMedia + AnalyserNode once per session; RAF only reads it.
 */
export function DictationWaveform({ active }: { active: boolean }) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const barsRef = useRef<Array<HTMLSpanElement | null>>([]);

  useEffect(() => {
    const bars = barsRef.current;
    const root = rootRef.current;
    if (!active) {
      resetBars(bars);
      if (root) root.dataset.mic = "idle";
      return;
    }

    let cancelled = false;
    let session: LiveMicAnalyser | null = null;
    let buffer: Uint8Array<ArrayBuffer> | null = null;
    let raf = 0;

    const tick = () => {
      const analyser = session?.analyser;
      if (analyser) {
        if (!buffer || buffer.length !== analyser.fftSize) {
          buffer = new Uint8Array(new ArrayBuffer(analyser.fftSize));
        }
        analyser.getByteTimeDomainData(buffer);
        const heights = barHeightsFromTimeDomain(buffer, WAVE_BAR_COUNT);
        for (let i = 0; i < bars.length; i += 1) {
          const bar = bars[i];
          const height = heights[i];
          if (bar && height !== undefined) {
            bar.style.height = `${height}px`;
          }
        }
      }
      raf = window.requestAnimationFrame(tick);
    };
    raf = window.requestAnimationFrame(tick);

    void openLiveMicAnalyser().then((opened) => {
      session = opened;
      if (cancelled) {
        opened?.stop();
        session = null;
        return;
      }
      if (opened && root) root.dataset.mic = "live";
    });

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(raf);
      session?.stop();
      session = null;
      if (root) root.dataset.mic = "idle";
      resetBars(bars);
    };
  }, [active]);

  return (
    <div
      ref={rootRef}
      className="flex h-12 items-end justify-center gap-[3px]"
      aria-hidden
      data-slot="dictation-waveform"
      data-mic="idle"
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
          style={{ height: WAVE_MIN_HEIGHT_PX }}
        />
      ))}
    </div>
  );
}
