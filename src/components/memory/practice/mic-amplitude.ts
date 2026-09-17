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
 * Open one microphone stream and AnalyserNode for a listening session.
 * Caller must `stop()` when listening ends; do not open/close per frame.
 */
export async function openLiveMicAnalyser(): Promise<LiveMicAnalyser | null> {
  const mediaDevices = navigator.mediaDevices;
  if (!mediaDevices?.getUserMedia) return null;

  const Context = audioContextConstructor();
  if (!Context) return null;

  let stream: MediaStream;
  try {
    stream = await mediaDevices.getUserMedia({ audio: true, video: false });
  } catch {
    return null;
  }

  let context: AudioContext | null = null;
  try {
    context = new Context();
    const source = context.createMediaStreamSource(stream);
    const analyser = context.createAnalyser();
    analyser.fftSize = WAVE_FFT_SIZE;
    analyser.smoothingTimeConstant = 0.4;
    source.connect(analyser);
    if (context.state === "suspended") {
      await context.resume();
    }

    let stopped = false;
    return {
      analyser,
      stop() {
        if (stopped) return;
        stopped = true;
        source.disconnect();
        for (const track of stream.getTracks()) {
          track.stop();
        }
        if (context && context.state !== "closed") {
          void context.close();
        }
      },
    };
  } catch {
    for (const track of stream.getTracks()) {
      track.stop();
    }
    if (context && context.state !== "closed") {
      void context.close();
    }
    return null;
  }
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
