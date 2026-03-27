import type { DevLogEntry, DevLogLevel } from "./types";

export const DEV_LOG_MAX_ENTRIES = 800;
export const DEV_LOG_MAX_AGE_MS = 90_000;

const MIRROR_SESSION_KEY = "berean:devLogMirrorConsole";

let entries: DevLogEntry[] = [];
let nextId = 1;
const listeners = new Set<() => void>();

let mirrorToConsole = false;

function readMirrorFromSession(): boolean {
  if (typeof sessionStorage === "undefined") return false;
  try {
    return sessionStorage.getItem(MIRROR_SESSION_KEY) === "1";
  } catch {
    return false;
  }
}

mirrorToConsole = readMirrorFromSession();

function notify(): void {
  for (const listener of listeners) {
    listener();
  }
}

function trimEntries(
  nextEntries: readonly DevLogEntry[],
  now: number,
): DevLogEntry[] {
  const minTs = now - DEV_LOG_MAX_AGE_MS;
  return nextEntries
    .filter((entry) => entry.ts >= minTs)
    .slice(-DEV_LOG_MAX_ENTRIES);
}

export function subscribeDevLog(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getDevLogEntries(): readonly DevLogEntry[] {
  return entries;
}

export function getRecentDevLogEntries(
  windowMs: number,
): readonly DevLogEntry[] {
  const minTs = Date.now() - Math.max(0, windowMs);
  return entries.filter((entry) => entry.ts >= minTs);
}

export function getMirrorToConsole(): boolean {
  return mirrorToConsole;
}

export function setMirrorToConsole(value: boolean): void {
  mirrorToConsole = value;
  try {
    if (typeof sessionStorage !== "undefined") {
      if (value) {
        sessionStorage.setItem(MIRROR_SESSION_KEY, "1");
      } else {
        sessionStorage.removeItem(MIRROR_SESSION_KEY);
      }
    }
  } catch {
    /* ignore quota / private mode */
  }
  notify();
}

export function pushDevLogEntry(partial: {
  ts: number;
  level: DevLogLevel;
  channel: string;
  body: string;
}): DevLogEntry {
  const entry: DevLogEntry = {
    id: nextId++,
    ts: partial.ts,
    level: partial.level,
    channel: partial.channel,
    body: partial.body,
  };
  entries = trimEntries([...entries, entry], entry.ts);
  notify();
  return entry;
}

export function clearDevLog(): void {
  entries = [];
  notify();
}
