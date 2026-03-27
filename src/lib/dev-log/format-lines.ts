import type { DevLogEntry } from "./types";
import { getRecentDevLogEntries } from "./store";

function truncateExportText(text: string, maxChars?: number): string {
  if (!maxChars || text.length <= maxChars) return text;
  const omittedChars = text.length - maxChars;
  return `[truncated ${omittedChars} chars]\n${text.slice(-maxChars)}`;
}

export function formatDevLogEntryLine(entry: DevLogEntry): string {
  const iso = new Date(entry.ts).toISOString();
  return `${iso} [${entry.level}] ${entry.channel} ${entry.body}`;
}

export function formatDevLogEntriesForExport(
  entries: readonly DevLogEntry[],
  options?: { maxChars?: number },
): string {
  return truncateExportText(
    entries.map((e) => formatDevLogEntryLine(e)).join("\n"),
    options?.maxChars,
  );
}

export function formatRecentDevLogEntriesForExport(
  windowMs: number,
  options?: { maxChars?: number },
): string {
  return formatDevLogEntriesForExport(
    getRecentDevLogEntries(windowMs),
    options,
  );
}
