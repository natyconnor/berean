import {
  MEMORY_LABEL,
  SUGGESTIONS_LABEL,
  YOUR_VERSES_LABEL,
} from "@/lib/memory-copy";
import { parseMemoryReturn } from "@/lib/memory-return";
import { isMemorySessionPath } from "@/lib/memory-session-path";
import { formatBookChapter, parsePassageId } from "@/lib/verse-ref-utils";

export const MEMORY_HOME = "/memory";

const NEW_PACK_LABEL = "New pack";
const PROGRESS_LABEL = "Progress";

const EXIT_PATH_ALIASES: Readonly<Record<string, string>> = {
  "/memory/library": "/memory/verses",
};

export type MemoryExit = {
  href: string;
  /** Full phrase, always "Back to {name}". */
  label: string;
  /** Short destination for the mobile control. */
  name: string;
};

export type MemoryExitLookups = {
  /** `undefined` while loading, `null` when gone. */
  packName?: string | null;
  /** `undefined` while loading, `null` when gone. */
  verseLabel?: string | null;
};

export type MemoryExitLookup =
  | { kind: "pack"; packId: string }
  | { kind: "verse"; verseRefId: string }
  | { kind: "none" };

type Classified =
  | { type: "memory" }
  | { type: "verses" }
  | { type: "progress" }
  | { type: "presets" }
  | { type: "new" }
  | { type: "pack"; packId: string }
  | { type: "verse"; verseRefId: string }
  | { type: "passage"; passageId: string }
  | { type: "other" };

function pathOf(href: string): string {
  const query = href.indexOf("?");
  const path = query === -1 ? href : href.slice(0, query);
  return path.replace(/\/+$/, "") || "/";
}

function canonicalHref(href: string): string {
  const dest = EXIT_PATH_ALIASES[pathOf(href)];
  if (!dest) return href;
  const query = href.indexOf("?");
  return query === -1 ? dest : `${dest}${href.slice(query)}`;
}

function classify(href: string): Classified {
  const path = pathOf(href);
  if (path === "/memory") return { type: "memory" };
  if (isMemorySessionPath(path)) return { type: "other" };

  if (path.startsWith("/passage/")) {
    const passageId = decodeURIComponent(path.slice("/passage/".length));
    if (passageId.length > 0 && !passageId.includes("/")) {
      return { type: "passage", passageId };
    }
    return { type: "other" };
  }

  if (!path.startsWith("/memory/")) return { type: "other" };

  const parts = path.slice("/memory/".length).split("/").filter(Boolean);
  if (parts.length === 1 && parts[0]) {
    if (parts[0] === "verses") return { type: "verses" };
    if (parts[0] === "progress") return { type: "progress" };
    if (parts[0] === "presets") return { type: "presets" };
    if (parts[0] === "new") return { type: "new" };
    if (parts[0] === "verse") return { type: "other" };
    return { type: "pack", packId: decodeURIComponent(parts[0]) };
  }
  if (parts.length === 2 && parts[0] === "verse" && parts[1]) {
    return { type: "verse", verseRefId: decodeURIComponent(parts[1]) };
  }
  return { type: "other" };
}

function named(href: string, name: string): MemoryExit {
  return { href, label: `Back to ${name}`, name };
}

function memoryHome(): MemoryExit {
  return named(MEMORY_HOME, MEMORY_LABEL);
}

function candidateHref(
  returnTo: string | undefined,
  fallbackHref: string,
): string {
  return canonicalHref(parseMemoryReturn(returnTo) ?? fallbackHref);
}

/** What the resolver may need to load before it can name or drop a target. */
export function memoryExitLookup(
  returnTo: string | undefined,
  fallbackHref: string = MEMORY_HOME,
): MemoryExitLookup {
  const dest = classify(candidateHref(returnTo, fallbackHref));
  if (dest.type === "pack") return { kind: "pack", packId: dest.packId };
  if (dest.type === "verse")
    return { kind: "verse", verseRefId: dest.verseRefId };
  return { kind: "none" };
}

export function isMemoryHomeHref(href: string): boolean {
  return pathOf(href) === "/memory";
}

export function memoryExitName(label: string): string {
  return label.startsWith("Back to ") ? label.slice("Back to ".length) : label;
}

/**
 * Session Back: a valid `return`, else the pack page, else Memory.
 * Never history. The label always names the destination.
 */
export function resolveMemoryExit(
  returnTo: string | undefined,
  fallbackHref: string = MEMORY_HOME,
  lookups: MemoryExitLookups = {},
): MemoryExit {
  return resolveHref(candidateHref(returnTo, fallbackHref), lookups);
}

function resolveHref(href: string, lookups: MemoryExitLookups): MemoryExit {
  const dest = classify(href);

  if (dest.type === "pack") {
    if (lookups.packName === null) return memoryHome();
    return named(href, lookups.packName ?? "pack");
  }

  if (dest.type === "verse") {
    if (lookups.verseLabel === null) return memoryHome();
    return named(href, lookups.verseLabel ?? "verse");
  }

  if (dest.type === "memory") return named(href, MEMORY_LABEL);
  if (dest.type === "verses") return named(href, YOUR_VERSES_LABEL);
  if (dest.type === "progress") return named(href, PROGRESS_LABEL);
  if (dest.type === "presets") return named(href, SUGGESTIONS_LABEL);
  if (dest.type === "new") return named(href, NEW_PACK_LABEL);

  if (dest.type === "passage") {
    const { book, chapter } = parsePassageId(dest.passageId);
    const name =
      book.length > 0 && Number.isFinite(chapter)
        ? formatBookChapter(book, chapter)
        : "passage";
    return named(href, name);
  }

  return memoryHome();
}
