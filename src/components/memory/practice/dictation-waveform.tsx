import { useEffect, useRef } from "react";
import { useReducedMotion } from "framer-motion";

import { cn } from "@/lib/utils";

import {
  barHeightsFromTimeDomain,
  connectMicAnalyser,
  WAVE_BAR_COUNT,
  WAVE_MIN_HEIGHT_PX,
  type LiveMicAnalyser,
} from "./mic-amplitude";

function resetBars(bars: Array<HTMLSpanElement | null>) {
  for (const bar of bars) {
    if (bar) bar.style.height = `${WAVE_MIN_HEIGHT_PX}px`;
  }
}

function animateProcedural(
  bars: Array<HTMLSpanElement | null>,
  now: number,
): void {
  bars.forEach((bar, i) => {
    if (!bar) return;
    const a = Math.sin(now / 180 + i * 0.42);
    const b = Math.sin(now / 110 + i * 0.17);
    const level = 0.16 + 0.84 * Math.abs(a * 0.72 + b * 0.28);
    bar.style.height = `${Math.max(WAVE_MIN_HEIGHT_PX, Math.round(level * 44))}px`;
  });
}

/**
 * Equalizer-style bars while listening. Prefers the shared dictation
 * MediaStream. The analyser clones that stream so Web Audio does not share a
 * track with SpeechRecognition.start(audioTrack). Does not call getUserMedia.
 * Without a stream (Safari / pre-135 Chrome), falls back to a procedural
 * animation so the mic stays free for the recognizer.
 */
export function DictationWaveform({
  active,
  stream = null,
}: {
  active: boolean;
  stream?: MediaStream | null;
}) {
  const reduceMotion = useReducedMotion();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const barsRef = useRef<Array<HTMLSpanElement | null>>([]);

  useEffect(() => {
    const bars = barsRef.current;
    const root = rootRef.current;
    if (!active || reduceMotion === true) {
      resetBars(bars);
      if (root) root.dataset.mic = "idle";
      return;
    }

    let session: LiveMicAnalyser | null = null;
    let buffer: Uint8Array<ArrayBuffer> | null = null;
    let raf = 0;

    const tick = (now: number) => {
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
      } else {
        animateProcedural(bars, now);
      }
      raf = window.requestAnimationFrame(tick);
    };
    raf = window.requestAnimationFrame(tick);

    if (stream) {
      session = connectMicAnalyser(stream);
      if (session && root) root.dataset.mic = "live";
    }

    return () => {
      window.cancelAnimationFrame(raf);
      session?.stop();
      session = null;
      if (root) root.dataset.mic = "idle";
      resetBars(bars);
    };
  }, [active, reduceMotion, stream]);

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
