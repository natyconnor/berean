"use node";

import { v } from "convex/values";

import { action } from "./_generated/server";
import { requireActionIdentity } from "./lib/auth";
import {
  audioFilenameForMime,
  baseAudioMimeType,
  groqFailureMessage,
  skipReasonForAudioBase64,
  skipReasonForAudioBytes,
} from "../src/lib/dictation-audio";

/**
 * Error-sensitive verse recitation (100% From Memory). Groq's large-v3 is
 * 10.3% WER vs turbo's 12%, and is the short-form accuracy pick. 189× vs
 * 216× realtime is tens of ms on a verse clip; Convex + upload dominate.
 * Never send `prompt` — never the expected verse.
 */
export const GROQ_WHISPER_MODEL = "whisper-large-v3";
const GROQ_TRANSCRIBE_URL =
  "https://api.groq.com/openai/v1/audio/transcriptions";

function logTranscribe(
  level: "info" | "error",
  event: string,
  details: Record<string, string | number | boolean>,
): void {
  const payload = { channel: "stt", event, ...details };
  if (level === "error") {
    console.error("[stt]", payload);
    return;
  }
  console.info("[stt]", payload);
}

/**
 * Optional recall dictation: browser sends complete MediaRecorder files
 * (start → stop, never timeslice fragments), this action posts them to
 * Groq Whisper. Requires `GROQ_API_KEY` in the Convex environment
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

    const base64Skip = skipReasonForAudioBase64(args.audioBase64);
    if (base64Skip) {
      logTranscribe("info", "skip", {
        reason: base64Skip,
        base64Chars: args.audioBase64.length,
      });
      return { text: "" };
    }

    const audio = Buffer.from(args.audioBase64, "base64");
    const bytes = new Uint8Array(
      audio.buffer,
      audio.byteOffset,
      audio.byteLength,
    );
    const bytesSkip = skipReasonForAudioBytes(bytes);
    if (bytesSkip) {
      logTranscribe("info", "skip", {
        reason: bytesSkip,
        bytes: bytes.byteLength,
        mimeType: args.mimeType,
      });
      return { text: "" };
    }

    const mimeType = baseAudioMimeType(args.mimeType);
    const filename = audioFilenameForMime(mimeType);
    const form = new FormData();
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
      const detail = await response.text().catch(() => "");
      const message = groqFailureMessage(
        response.status,
        response.statusText,
        detail,
      );
      logTranscribe("error", "groq-failed", {
        status: response.status,
        bytes: bytes.byteLength,
        mimeType,
        model: GROQ_WHISPER_MODEL,
        detail: message,
      });
      throw new Error(message);
    }

    const body = (await response.json()) as { text?: unknown };
    const text = typeof body.text === "string" ? body.text.trim() : "";
    logTranscribe("info", "transcribed", {
      bytes: bytes.byteLength,
      mimeType,
      model: GROQ_WHISPER_MODEL,
      textChars: text.length,
    });
    return { text };
  },
});
