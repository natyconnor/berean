"use node";

import { v } from "convex/values";

import {
  audioFilenameForMime,
  baseAudioMimeType,
  GROQ_ERROR_BODY_LIMIT,
  groqFailureMessage,
  skipReasonForAudioBase64,
  skipReasonForAudioBytes,
} from "../src/lib/dictation-audio";
import { sttLog } from "../src/lib/stt-log";
import { action, type ActionCtx } from "./_generated/server";
import { requireActionIdentity } from "./lib/auth";

/**
 * Error-sensitive verse recitation (100% From Memory). Groq's large-v3 is
 * 10.3% WER vs turbo's 12%, and is the short-form accuracy pick. 189× vs
 * 216× realtime is tens of ms on a verse clip; Convex + upload dominate.
 * Never send `prompt` — never the expected verse.
 */
export const GROQ_WHISPER_MODEL = "whisper-large-v3";
const GROQ_TRANSCRIBE_URL =
  "https://api.groq.com/openai/v1/audio/transcriptions";

function clipGroqLogBody(body: string): string {
  return body.replace(/\s+/g, " ").trim().slice(0, GROQ_ERROR_BODY_LIMIT);
}

async function readConvexRequestId(
  ctx: ActionCtx,
): Promise<string | undefined> {
  try {
    const meta = await ctx.meta.getRequestMetadata();
    return meta.requestId;
  } catch {
    return undefined;
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function resultExtras(args: {
  requestId?: string;
  httpStatus?: number;
  latencyMs: number;
}): {
  requestId?: string;
  model: string;
  httpStatus?: number;
  latencyMs: number;
} {
  return {
    ...(args.requestId ? { requestId: args.requestId } : {}),
    model: GROQ_WHISPER_MODEL,
    ...(args.httpStatus != null ? { httpStatus: args.httpStatus } : {}),
    latencyMs: args.latencyMs,
  };
}

/**
 * Optional recall dictation: browser sends complete MediaRecorder files
 * (start → stop, never timeslice fragments), this action posts them to
 * Groq Whisper. Requires `GROQ_API_KEY` in the Convex environment
 * (dashboard or `npx convex env set GROQ_API_KEY …`). Never put that key in
 * Vite / `VITE_*` client env.
 *
 * `prompt` is omitted on purpose — never the expected verse.
 *
 * STT debug: Convex dashboard logs are always tagged `[stt]` via `sttLog`
 * (never the API key). The client overlay reads returned `requestId` /
 * `httpStatus` / model / latency when `berean:debugStt` is on.
 */
export const transcribeAudio = action({
  args: {
    audioBase64: v.string(),
    mimeType: v.string(),
  },
  returns: v.object({
    text: v.string(),
    requestId: v.optional(v.string()),
    model: v.optional(v.string()),
    httpStatus: v.optional(v.number()),
    latencyMs: v.optional(v.number()),
  }),
  handler: async (ctx, args) => {
    const started = Date.now();
    const requestId = await readConvexRequestId(ctx);
    const mimeType = baseAudioMimeType(args.mimeType);

    sttLog.info("transcribe-start", {
      requestId,
      model: GROQ_WHISPER_MODEL,
      mimeType,
      audioBase64Chars: args.audioBase64.length,
    });

    await requireActionIdentity(ctx);

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      sttLog.error("transcribe-error", {
        requestId,
        model: GROQ_WHISPER_MODEL,
        reason: "missing-groq-api-key",
        latencyMs: Date.now() - started,
      });
      throw new Error(
        "GROQ_API_KEY not configured in Convex environment variables",
      );
    }

    const base64Skip = skipReasonForAudioBase64(args.audioBase64);
    if (base64Skip) {
      sttLog.info("transcribe-skip", {
        requestId,
        model: GROQ_WHISPER_MODEL,
        reason: base64Skip,
        audioBase64Chars: args.audioBase64.length,
        latencyMs: Date.now() - started,
      });
      return {
        text: "",
        ...resultExtras({ requestId, latencyMs: Date.now() - started }),
      };
    }

    const audio = Buffer.from(args.audioBase64, "base64");
    const bytes = new Uint8Array(
      audio.buffer,
      audio.byteOffset,
      audio.byteLength,
    );
    const bytesSkip = skipReasonForAudioBytes(bytes);
    if (bytesSkip) {
      sttLog.info("transcribe-skip", {
        requestId,
        model: GROQ_WHISPER_MODEL,
        reason: bytesSkip,
        audioBytes: bytes.byteLength,
        mimeType,
        latencyMs: Date.now() - started,
      });
      return {
        text: "",
        ...resultExtras({ requestId, latencyMs: Date.now() - started }),
      };
    }

    const filename = audioFilenameForMime(mimeType);
    const form = new FormData();
    form.append("file", new Blob([bytes], { type: mimeType }), filename);
    form.append("model", GROQ_WHISPER_MODEL);
    form.append("language", "en");
    form.append("response_format", "json");
    form.append("temperature", "0");

    const groqStarted = Date.now();
    let response: Response;
    try {
      response = await fetch(GROQ_TRANSCRIBE_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}` },
        body: form,
      });
    } catch (error) {
      sttLog.error("transcribe-error", {
        requestId,
        model: GROQ_WHISPER_MODEL,
        reason: "fetch-failed",
        mimeType,
        audioBytes: bytes.byteLength,
        groqLatencyMs: Date.now() - groqStarted,
        latencyMs: Date.now() - started,
        message: errorMessage(error),
      });
      throw error;
    }

    const groqLatencyMs = Date.now() - groqStarted;

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      const groqBody = clipGroqLogBody(detail);
      sttLog.error("transcribe-http", {
        requestId,
        model: GROQ_WHISPER_MODEL,
        httpStatus: response.status,
        statusText: response.statusText,
        groqBody,
        mimeType,
        audioBytes: bytes.byteLength,
        groqLatencyMs,
        latencyMs: Date.now() - started,
      });
      const failure = groqFailureMessage(
        response.status,
        response.statusText,
        detail,
      );
      throw new Error(
        requestId ? `${failure} (requestId=${requestId})` : failure,
      );
    }

    const body = (await response.json()) as { text?: unknown };
    const text = typeof body.text === "string" ? body.text.trim() : "";
    let groqBody: string | undefined;
    try {
      groqBody = clipGroqLogBody(JSON.stringify(body));
    } catch {
      groqBody = undefined;
    }

    sttLog.info("transcribe-result", {
      requestId,
      model: GROQ_WHISPER_MODEL,
      httpStatus: response.status,
      mimeType,
      audioBytes: bytes.byteLength,
      groqLatencyMs,
      latencyMs: Date.now() - started,
      transcriptIn: text,
      transcriptOut: text,
      groqBody,
    });

    return {
      text,
      ...resultExtras({
        requestId,
        httpStatus: response.status,
        latencyMs: Date.now() - started,
      }),
    };
  },
});
