import { describe, expect, it } from "vitest";

import {
  audioFilenameForMime,
  baseAudioMimeType,
  groqFailureMessage,
  looksLikeCompleteAudioContainer,
  MIN_TRANSCRIBE_AUDIO_BYTES,
  skipReasonForAudioBase64,
  skipReasonForAudioBytes,
} from "./dictation-audio";

function bytesWith(magic: number[], size: number, extra?: [number, number[]]) {
  const bytes = new Uint8Array(size);
  bytes.set(magic, 0);
  if (extra) bytes.set(extra[1], extra[0]);
  return bytes;
}

describe("dictation audio validation", () => {
  it("skips empty and oversized base64 before decode", () => {
    expect(skipReasonForAudioBase64("")).toBe("empty");
    expect(skipReasonForAudioBase64("   ")).toBe("empty");
    expect(skipReasonForAudioBase64("abc")).toBeNull();
    expect(skipReasonForAudioBase64("x".repeat(4_000_001))).toBe("too-large");
  });

  it("skips empty, tiny, and headerless byte buffers", () => {
    expect(skipReasonForAudioBytes(new Uint8Array(0))).toBe("empty");
    expect(
      skipReasonForAudioBytes(new Uint8Array(MIN_TRANSCRIBE_AUDIO_BYTES - 1)),
    ).toBe("too-small");
    expect(
      skipReasonForAudioBytes(
        new Uint8Array(MIN_TRANSCRIBE_AUDIO_BYTES).fill(1),
      ),
    ).toBe("invalid-container");
  });

  it("accepts WebM with EBML + Cluster and rejects Cluster-only fragments", () => {
    const complete = bytesWith([0x1a, 0x45, 0xdf, 0xa3], 320, [
      40,
      [0x1f, 0x43, 0xb6, 0x75],
    ]);
    expect(looksLikeCompleteAudioContainer(complete)).toBe(true);
    expect(skipReasonForAudioBytes(complete)).toBeNull();

    const headerOnly = bytesWith([0x1a, 0x45, 0xdf, 0xa3], 320);
    expect(looksLikeCompleteAudioContainer(headerOnly)).toBe(false);

    const timeslice = bytesWith([0x1f, 0x43, 0xb6, 0x75], 320);
    expect(looksLikeCompleteAudioContainer(timeslice)).toBe(false);
  });

  it("accepts Ogg with two pages, MP4 with ftyp+mdat, and WAV", () => {
    const ogg = bytesWith([0x4f, 0x67, 0x67, 0x53], 320, [
      80,
      [0x4f, 0x67, 0x67, 0x53],
    ]);
    expect(looksLikeCompleteAudioContainer(ogg)).toBe(true);

    const mp4 = new Uint8Array(320);
    mp4.set([0x66, 0x74, 0x79, 0x70], 4);
    mp4.set([0x6d, 0x64, 0x61, 0x74], 24);
    expect(looksLikeCompleteAudioContainer(mp4)).toBe(true);

    const wav = bytesWith([0x52, 0x49, 0x46, 0x46], 320, [
      8,
      [0x57, 0x41, 0x56, 0x45],
    ]);
    expect(looksLikeCompleteAudioContainer(wav)).toBe(true);
  });

  it("picks Groq filenames from mime and strips codec parameters", () => {
    expect(audioFilenameForMime("audio/webm;codecs=opus")).toBe("audio.webm");
    expect(audioFilenameForMime("audio/ogg;codecs=opus")).toBe("audio.ogg");
    expect(audioFilenameForMime("audio/mp4")).toBe("audio.m4a");
    expect(baseAudioMimeType("audio/webm;codecs=opus")).toBe("audio/webm");
    expect(baseAudioMimeType("")).toBe("audio/webm");
  });

  it("prefers Groq JSON error.message and otherwise clips the raw body", () => {
    expect(groqFailureMessage(400, "Bad Request", "")).toBe(
      "Groq transcription failed: 400 Bad Request",
    );
    expect(
      groqFailureMessage(
        400,
        "Bad Request",
        JSON.stringify({
          error: { message: "failed to decode file: invalid webm" },
        }),
      ),
    ).toBe(
      "Groq transcription failed: 400 Bad Request: failed to decode file: invalid webm",
    );
    expect(
      groqFailureMessage(400, "Bad Request", "ffmpeg:  not   a valid  cluster"),
    ).toBe(
      "Groq transcription failed: 400 Bad Request: ffmpeg: not a valid cluster",
    );
  });
});
