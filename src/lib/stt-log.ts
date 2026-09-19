/**
 * Verse-dictation STT diagnostics. One import path for client and Convex:
 * wraps the existing `devLog` overlay on the browser, and Convex `console`
 * on the server. Do not add a second logger.
 *
 * Enable in the browser (survives TanStack search stripping via hash):
 *   localStorage.setItem("berean:debugStt", "1")  then reload
 *   or open with ?debugStt=1 or #debugStt=1
 *
 * Disable:
 *   localStorage.removeItem("berean:debugStt")
 *   or ?debugStt=0 / #debugStt=0
 *
 * Where logs appear:
 *   - In-app Dev log overlay (bug button, bottom-right), channel `stt`.
 *     Shown in local `pnpm dev`, Vercel preview, and any build once the
 *     flag is on. `?debugStt=1` also opens the overlay and mirrors to the
 *     browser console for that tab.
 *   - Browser console when "Mirror new lines to browser console" is on.
 *   - Convex dashboard logs for `transcribe:transcribeAudio` (always on
 *     the server; filter for `[stt]`). Never logs GROQ_API_KEY / tokens.
 */

import { devLog } from "./dev-log/dev-log";
import { requestOpenDevLogOverlay, setMirrorToConsole } from "./dev-log/store";

export const STT_LOG_CHANNEL = "stt";
export const STT_DEBUG_STORAGE_KEY = "berean:debugStt";
export const STT_DEBUG_FLAG = "debugStt";

const MAX_STT_LOG_STRING = 1_500;

const SECRET_KEY_RE =
  /^(?:api[_-]?key|groq_api_key|authorization|auth_?token|bearer|secret|password|token|audiobase64)$/i;

const SECRET_VALUE_RE =
  /(?:GROQ_API_KEY|api[_-]?key|authorization)\s*[=:]\s*\S+|\bBearer\s+\S+/gi;

export type SttLogLevel = "debug" | "info" | "warn" | "error";

export type SpokenStitchDecision =
  | "empty-incoming"
  | "first"
  | "incoming-covers-previous"
  | "previous-covers-incoming"
  | "overlap"
  | "append";

export type SpokenStitchClassification = {
  decision: SpokenStitchDecision;
  overlapWords: number;
};

type ConsoleLogger = Pick<Console, SttLogLevel>;

function readUrlFlag(name: string): "on" | "off" | null {
  if (typeof window === "undefined") return null;
  const sources = [window.location.search, window.location.hash];
  for (const source of sources) {
    const query =
      source.startsWith("#") || source.startsWith("?")
        ? source.slice(1)
        : source;
    if (!query) continue;
    const params = new URLSearchParams(query);
    if (!params.has(name)) continue;
    const value = (params.get(name) ?? "").trim().toLowerCase();
    if (value === "0" || value === "false" || value === "off") return "off";
    return "on";
  }
  return null;
}

function applyUrlDebugSideEffects(): void {
  requestOpenDevLogOverlay();
  setMirrorToConsole(true);
}

/** True when the browser STT debug flag is on. Always false on Convex. */
export function sttDebugEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const urlFlag = readUrlFlag(STT_DEBUG_FLAG);
    if (urlFlag === "on") {
      window.localStorage.setItem(STT_DEBUG_STORAGE_KEY, "1");
      applyUrlDebugSideEffects();
      return true;
    }
    if (urlFlag === "off") {
      window.localStorage.removeItem(STT_DEBUG_STORAGE_KEY);
      return false;
    }
    return window.localStorage.getItem(STT_DEBUG_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function clipLogString(value: string): string {
  if (value.length <= MAX_STT_LOG_STRING) return value;
  const omitted = value.length - MAX_STT_LOG_STRING;
  return `${value.slice(0, MAX_STT_LOG_STRING)}…[truncated ${omitted} chars]`;
}

function redactSecretText(value: string): string {
  return clipLogString(value.replace(SECRET_VALUE_RE, "<redacted-secret>"));
}

function sanitizeSttLogValue(value: unknown, depth = 0): unknown {
  if (depth > 6) return "[max-depth]";
  if (typeof value === "string") return redactSecretText(value);
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (value == null) return value;
  if (value instanceof Error) {
    return {
      name: value.name,
      message: redactSecretText(value.message),
    };
  }
  if (Array.isArray(value)) {
    return value
      .slice(0, 40)
      .map((item) => sanitizeSttLogValue(item, depth + 1));
  }
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value)) {
      if (SECRET_KEY_RE.test(key)) {
        out[key] = "<redacted>";
        continue;
      }
      if (nested === undefined) continue;
      out[key] = sanitizeSttLogValue(nested, depth + 1);
    }
    return out;
  }
  if (typeof value === "bigint") return `${value}n`;
  if (typeof value === "symbol") {
    const description = value.description;
    return description !== undefined ? `Symbol(${description})` : "Symbol()";
  }
  if (typeof value === "function") {
    return value.name ? `function ${value.name}()` : "function ()";
  }
  return "[unknown]";
}

/** Drop secrets / audio payloads and cap string size for the overlay. */
export function sanitizeSttLogDetails(
  details?: Record<string, unknown>,
): Record<string, unknown> | undefined {
  if (!details) return undefined;
  const sanitized = sanitizeSttLogValue(details);
  if (
    sanitized == null ||
    typeof sanitized !== "object" ||
    Array.isArray(sanitized)
  ) {
    return undefined;
  }
  const entries = Object.entries(sanitized as Record<string, unknown>);
  if (entries.length === 0) return undefined;
  entries.sort(([a], [b]) => a.localeCompare(b));
  return Object.fromEntries(entries);
}

function overlapWordCount(previous: string, incoming: string): number {
  const leftWords = previous.split(/\s+/).filter(Boolean);
  const nextWords = incoming.split(/\s+/).filter(Boolean);
  const max = Math.min(leftWords.length, nextWords.length);
  for (let n = max; n >= 1; n -= 1) {
    if (
      leftWords.slice(-n).join(" ").toLowerCase() ===
      nextWords.slice(0, n).join(" ").toLowerCase()
    ) {
      return n;
    }
  }
  return 0;
}

/**
 * Label a `stitchSpokenText` result without changing that helper.
 * Later STT agents can call this after they stitch.
 */
export function classifySpokenStitch(
  previous: string,
  incoming: string,
  result: string,
): SpokenStitchClassification {
  const next = incoming.trim();
  const left = previous.trimEnd();
  if (!next) return { decision: "empty-incoming", overlapWords: 0 };
  if (!left) return { decision: "first", overlapWords: 0 };
  const leftLower = left.toLowerCase();
  const nextLower = next.toLowerCase();
  if (result === next && nextLower.startsWith(leftLower)) {
    return { decision: "incoming-covers-previous", overlapWords: 0 };
  }
  if (result === left && leftLower.endsWith(nextLower)) {
    return { decision: "previous-covers-incoming", overlapWords: 0 };
  }
  const overlapWords = overlapWordCount(left, next);
  if (overlapWords > 0 && result !== `${left} ${next}`) {
    return { decision: "overlap", overlapWords };
  }
  return { decision: "append", overlapWords: 0 };
}

function isConvexRuntime(): boolean {
  return typeof window === "undefined";
}

function emitSttLog(
  level: SttLogLevel,
  event: string,
  details?: Record<string, unknown>,
): void {
  const sanitized = sanitizeSttLogDetails(details);
  if (isConvexRuntime()) {
    const logger = console as ConsoleLogger;
    if (sanitized) {
      logger[level](`[${STT_LOG_CHANNEL}] ${event}`, sanitized);
      return;
    }
    logger[level](`[${STT_LOG_CHANNEL}] ${event}`);
    return;
  }
  if (!sttDebugEnabled()) return;
  if (sanitized) {
    devLog[level](STT_LOG_CHANNEL, event, sanitized);
    return;
  }
  devLog[level](STT_LOG_CHANNEL, event);
}

export const sttLog = {
  debug(event: string, details?: Record<string, unknown>): void {
    emitSttLog("debug", event, details);
  },
  info(event: string, details?: Record<string, unknown>): void {
    emitSttLog("info", event, details);
  },
  warn(event: string, details?: Record<string, unknown>): void {
    emitSttLog("warn", event, details);
  },
  error(event: string, details?: Record<string, unknown>): void {
    emitSttLog("error", event, details);
  },
};

/** Alias used by dictation code. Same gated `stt` channel as `sttLog.info`. */
export function logStt(
  action: string,
  details?: Record<string, unknown>,
): void {
  sttLog.info(action, details);
}
