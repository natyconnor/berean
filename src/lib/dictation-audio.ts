/**
 * Shared Groq Whisper audio checks. Convex and the recorder both skip
 * empty / tiny / incomplete containers instead of posting them (those 400).
 *
 * Magic-byte only — not a full demuxer. Timeslice / requestData fragments
 * usually lack a complete WebM/Ogg/MP4 header.
 */

/** Smaller than a finalized MediaRecorder header + one cluster/page. */
export const MIN_TRANSCRIBE_AUDIO_BYTES = 256;

/** ~3MB decoded; Groq's free-tier cap is 25MB. */
export const MAX_AUDIO_BASE64_CHARS = 4_000_000;

export const GROQ_ERROR_BODY_LIMIT = 500;

export type TranscribeAudioSkipReason =
  "empty" | "too-large" | "too-small" | "invalid-container";

const EBML_MAGIC = [0x1a, 0x45, 0xdf, 0xa3] as const;
const WEBM_CLUSTER_ID = [0x1f, 0x43, 0xb6, 0x75] as const;
const OGGS = [0x4f, 0x67, 0x67, 0x53] as const; // OggS
const RIFF = [0x52, 0x49, 0x46, 0x46] as const; // RIFF
const WAVE = [0x57, 0x41, 0x56, 0x45] as const; // WAVE
const FLAC = [0x66, 0x4c, 0x61, 0x43] as const; // fLaC
const FTYP = [0x66, 0x74, 0x79, 0x70] as const; // ftyp
const MDAT = [0x6d, 0x64, 0x61, 0x74] as const; // mdat
const MOOV = [0x6d, 0x6f, 0x6f, 0x76] as const; // moov
const ID3 = [0x49, 0x44, 0x33] as const;

function startsWith(
  bytes: Uint8Array,
  magic: readonly number[],
  offset = 0,
): boolean {
  if (bytes.length < offset + magic.length) return false;
  for (let i = 0; i < magic.length; i += 1) {
    if (bytes[offset + i] !== magic[i]) return false;
  }
  return true;
}

function indexOfBytes(
  haystack: Uint8Array,
  needle: readonly number[],
  from = 0,
): number {
  const last = haystack.length - needle.length;
  outer: for (let i = from; i <= last; i += 1) {
    for (let j = 0; j < needle.length; j += 1) {
      if (haystack[i + j] !== needle[j]) continue outer;
    }
    return i;
  }
  return -1;
}

function isMpegFrame(bytes: Uint8Array): boolean {
  if (bytes.length < 2) return false;
  const b0 = bytes[0];
  const b1 = bytes[1];
  if (b0 === undefined || b1 === undefined) return false;
  // MPEG audio frame sync 0xFFEx / 0xFFFx
  return b0 === 0xff && (b1 & 0xe0) === 0xe0;
}

/**
 * True when `bytes` look like a complete Groq-supported audio file, not a
 * MediaRecorder timeslice fragment or header-only blob.
 */
export function looksLikeCompleteAudioContainer(bytes: Uint8Array): boolean {
  if (startsWith(bytes, EBML_MAGIC)) {
    // Complete WebM has a Cluster. A continuation timeslice often starts
    // with Cluster and no EBML — rejected by the start-magic check. A
    // truncated first chunk can have EBML without a Cluster; skip those.
    return indexOfBytes(bytes, WEBM_CLUSTER_ID, 4) !== -1;
  }
  if (startsWith(bytes, OGGS)) {
    return indexOfBytes(bytes, OGGS, 4) !== -1;
  }
  if (bytes.length >= 12 && startsWith(bytes, FTYP, 4)) {
    return (
      indexOfBytes(bytes, MDAT, 8) !== -1 || indexOfBytes(bytes, MOOV, 8) !== -1
    );
  }
  if (startsWith(bytes, RIFF) && indexOfBytes(bytes, WAVE, 8) !== -1) {
    return true;
  }
  if (startsWith(bytes, FLAC)) return true;
  if (startsWith(bytes, ID3) || isMpegFrame(bytes)) return true;
  return false;
}

export function skipReasonForAudioBase64(
  audioBase64: string,
): TranscribeAudioSkipReason | null {
  if (!audioBase64 || !audioBase64.trim()) return "empty";
  if (audioBase64.length > MAX_AUDIO_BASE64_CHARS) return "too-large";
  return null;
}

export function skipReasonForAudioBytes(
  bytes: Uint8Array,
): TranscribeAudioSkipReason | null {
  if (bytes.length === 0) return "empty";
  if (bytes.length < MIN_TRANSCRIBE_AUDIO_BYTES) return "too-small";
  if (!looksLikeCompleteAudioContainer(bytes)) return "invalid-container";
  return null;
}

export function audioFilenameForMime(mimeType: string): string {
  const mime = mimeType.split(";")[0]?.trim().toLowerCase() ?? "";
  if (mime.includes("ogg")) return "audio.ogg";
  if (mime.includes("mp4") || mime.includes("m4a") || mime.includes("aac")) {
    return "audio.m4a";
  }
  if (mime.includes("mpeg") || mime.includes("mp3")) return "audio.mp3";
  if (mime.includes("wav")) return "audio.wav";
  if (mime.includes("flac")) return "audio.flac";
  return "audio.webm";
}

/** Strip codec parameters so Groq sees a simple audio/* type. */
export function baseAudioMimeType(mimeType: string): string {
  const mime = mimeType.split(";")[0]?.trim().toLowerCase() ?? "";
  return mime || "audio/webm";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function groqErrorMessageFromJson(value: unknown): string | null {
  if (!isRecord(value)) return null;
  const error = value.error;
  if (typeof error === "string" && error.trim()) return error.trim();
  if (isRecord(error) && typeof error.message === "string") {
    const message = error.message.trim();
    if (message) return message;
  }
  if (typeof value.message === "string" && value.message.trim()) {
    return value.message.trim();
  }
  return null;
}

/** Include Groq's response body so a 400 is diagnosable in Convex logs. */
export function groqFailureMessage(
  status: number,
  statusText: string,
  body: string,
): string {
  const statusBit = `Groq transcription failed: ${status} ${statusText}`;
  const trimmed = body.trim();
  if (!trimmed) return statusBit;

  let detail = trimmed;
  try {
    const parsed: unknown = JSON.parse(trimmed);
    const fromJson = groqErrorMessageFromJson(parsed);
    if (fromJson) detail = fromJson;
  } catch {
    // keep raw body (HTML / ffmpeg text)
  }

  const clipped = detail
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, GROQ_ERROR_BODY_LIMIT);
  return clipped ? `${statusBit}: ${clipped}` : statusBit;
}
