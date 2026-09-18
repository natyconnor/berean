import {
  cloneMediaStreamForAnalysis,
  openDictationMicStream,
  stopMediaStream,
} from "@/lib/web-speech";

export const WAVE_BAR_COUNT = 24;
export const WAVE_MIN_HEIGHT_PX = 6;
export const WAVE_MAX_HEIGHT_PX = 44;
export const WAVE_FFT_SIZE = 1024;

/** Boost so conversational speech reads on the bars, not only shouting. */
const SPEECH_GAIN = 2.4;

export type LiveMicAnalyser = {
  analyser: AnalyserNode;
  stop: () => void;
};

function audioContextConstructor(): (new () => AudioContext) | undefined {
  if (typeof window === "undefined") return undefined;
  if (window.AudioContext) return window.AudioContext;
  const webkit = (
    window as Window & { webkitAudioContext?: new () => AudioContext }
  ).webkitAudioContext;
  return webkit;
}

/**
 * Analyser for a capture we do not own. Clones the stream so Web Audio does
 * not attach a sink to the same MediaStreamTrack MediaRecorder is using.
 * `stop()` disconnects the graph, closes the AudioContext, and ends clone
 * tracks only — never the original capture.
 */
export function connectMicAnalyser(
  stream: MediaStream,
): LiveMicAnalyser | null {
  const Context = audioContextConstructor();
  if (!Context) return null;

  let context: AudioContext | null = null;
  const visualStream = cloneMediaStreamForAnalysis(stream) ?? stream;
  const ownsClone = visualStream !== stream;
  try {
    context = new Context();
    const source = context.createMediaStreamSource(visualStream);
    const analyser = context.createAnalyser();
    analyser.fftSize = WAVE_FFT_SIZE;
    analyser.smoothingTimeConstant = 0.4;
    source.connect(analyser);
    if (context.state === "suspended") {
      void context.resume();
    }

    let stopped = false;
    return {
      analyser,
      stop() {
        if (stopped) return;
        stopped = true;
        source.disconnect();
        if (ownsClone) stopMediaStream(visualStream);
        if (context && context.state !== "closed") {
          void context.close();
        }
      },
    };
  } catch {
    if (ownsClone) stopMediaStream(visualStream);
    if (context && context.state !== "closed") {
      void context.close();
    }
    return null;
  }
}

/**
 * Open one microphone stream and AnalyserNode for a listening session.
 * Caller must `stop()` when listening ends; do not open/close per frame.
 */
export async function openLiveMicAnalyser(): Promise<LiveMicAnalyser | null> {
  const stream = await openDictationMicStream();
  if (!stream) return null;
  const visual = connectMicAnalyser(stream);
  if (!visual) {
    stopMediaStream(stream);
    return null;
  }
  let stopped = false;
  return {
    analyser: visual.analyser,
    stop() {
      if (stopped) return;
      stopped = true;
      visual.stop();
      stopMediaStream(stream);
    },
  };
}

/**
 * Map time-domain PCM (0–255, 128 = silence) to bar heights in px.
 * Each bar is the RMS amplitude of one slice of the analyser buffer.
 */
export function barHeightsFromTimeDomain(
  samples: ArrayLike<number>,
  barCount = WAVE_BAR_COUNT,
): number[] {
  const heights = Array.from({ length: barCount }, () => WAVE_MIN_HEIGHT_PX);
  if (samples.length === 0 || barCount <= 0) return heights;

  const slice = Math.max(1, Math.floor(samples.length / barCount));
  const span = WAVE_MAX_HEIGHT_PX - WAVE_MIN_HEIGHT_PX;

  for (let i = 0; i < barCount; i += 1) {
    const start = i * slice;
    const end =
      i === barCount - 1
        ? samples.length
        : Math.min(start + slice, samples.length);
    let sumSq = 0;
    let count = 0;
    for (let s = start; s < end; s += 1) {
      const centered = ((samples[s] ?? 128) - 128) / 128;
      sumSq += centered * centered;
      count += 1;
    }
    const rms = count > 0 ? Math.sqrt(sumSq / count) : 0;
    const level = Math.min(1, rms * SPEECH_GAIN);
    heights[i] = Math.max(
      WAVE_MIN_HEIGHT_PX,
      Math.round(WAVE_MIN_HEIGHT_PX + level * span),
    );
  }

  return heights;
}
