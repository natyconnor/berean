"use node";

import { v } from "convex/values";

import { action } from "./_generated/server";
import { requireActionIdentity } from "./lib/auth";

/** Groq Speech-to-Text. Set in the Convex dashboard / CLI — never Vite. */
export const GROQ_WHISPER_MODEL = "whisper-large-v3-turbo";
const GROQ_TRANSCRIBE_URL =
  "https://api.groq.com/openai/v1/audio/transcriptions";
const MAX_AUDIO_BASE64_CHARS = 4_000_000;

function audioFilenameForMime(mimeType: string): string {
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

/**
 * Optional recall dictation: browser sends growing snapshots of one
 * recording, this action posts them to Groq Whisper. Requires `GROQ_API_KEY`
 * in the Convex environment
 * (dashboard or `npx convex env set GROQ_API_KEY …`). Never put that key in
 * Vite / `VITE_*` client env.
 *
 * `prompt` is omitted on purpose — never the expected verse.
 */
export const transcribeAudio = action({
  args: {
    audioBase64: v.string(),
    mimeType: v.string(),
  },
  returns: v.object({ text: v.string() }),
  handler: async (ctx, args) => {
    await requireActionIdentity(ctx);

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      throw new Error(
        "GROQ_API_KEY not configured in Convex environment variables",
      );
    }
    if (!args.audioBase64 || args.audioBase64.length > MAX_AUDIO_BASE64_CHARS) {
      return { text: "" };
    }

    const audio = Buffer.from(args.audioBase64, "base64");
    if (audio.length < 64) return { text: "" };

    const mimeType = args.mimeType.trim() || "audio/webm";
    const filename = audioFilenameForMime(mimeType);
    const form = new FormData();
    const bytes = new Uint8Array(
      audio.buffer,
      audio.byteOffset,
      audio.byteLength,
    );
    form.append("file", new Blob([bytes], { type: mimeType }), filename);
    form.append("model", GROQ_WHISPER_MODEL);
    form.append("language", "en");
    form.append("response_format", "json");
    form.append("temperature", "0");

    const response = await fetch(GROQ_TRANSCRIBE_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });

    if (!response.ok) {
      void response.text().catch(() => {
        /* drain */
      });
      throw new Error(
        `Groq transcription failed: ${response.status} ${response.statusText}`,
      );
    }

    const body = (await response.json()) as { text?: unknown };
    const text = typeof body.text === "string" ? body.text.trim() : "";
    return { text };
  },
});
