import { serializeDevLogParts } from "./serialize";
import { getMirrorToConsole, pushDevLogEntry } from "./store";
import type { DevLogLevel } from "./types";

function emit(level: DevLogLevel, channel: string, parts: unknown[]): void {
  const body = serializeDevLogParts(parts);
  pushDevLogEntry({ ts: Date.now(), level, channel, body });
  if (!getMirrorToConsole()) return;
  const tag = `[devLog:${channel}]`;
  switch (level) {
    case "debug":
      console.debug(tag, ...parts);
      break;
    case "info":
      console.info(tag, ...parts);
      break;
    case "warn":
      console.warn(tag, ...parts);
      break;
    case "error":
      console.error(tag, ...parts);
      break;
  }
}

function normalizeDetails(
  details?: Record<string, unknown>,
): Record<string, unknown> | undefined {
  if (!details) return undefined;
  const entries = Object.entries(details).filter(
    ([, value]) => value !== undefined,
  );
  if (entries.length === 0) return undefined;
  entries.sort(([a], [b]) => a.localeCompare(b));
  return Object.fromEntries(entries);
}

export const devLog = {
  debug(channel: string, ...parts: unknown[]): void {
    emit("debug", channel, parts);
  },
  info(channel: string, ...parts: unknown[]): void {
    emit("info", channel, parts);
  },
  warn(channel: string, ...parts: unknown[]): void {
    emit("warn", channel, parts);
  },
  error(channel: string, ...parts: unknown[]): void {
    emit("error", channel, parts);
  },
};

export function logInteraction(
  category: string,
  action: string,
  details?: Record<string, unknown>,
): void {
  const normalized = normalizeDetails(details);
  if (normalized) {
    devLog.info(`interaction:${category}`, action, normalized);
    return;
  }
  devLog.info(`interaction:${category}`, action);
}
