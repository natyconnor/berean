/**
 * Memory drawers and their full pages. A drawer opens over Today at
 * `/memory?panel=…`; the same content has a full page for deep links.
 * `from=verses` marks a detail opened from Your verses, which shows the
 * "‹ Your verses" back link.
 */

export type MemoryPanel =
  | { kind: "progress" }
  | { kind: "verses" }
  | { kind: "pack"; packId: string }
  | { kind: "verse"; verseRefId: string };

export type MemoryPanelFrom = "verses";

/** Convex ids are short alphanumeric strings; anything else is junk. */
const PANEL_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

export function parseMemoryPanel(raw: unknown): MemoryPanel | undefined {
  if (typeof raw !== "string") return undefined;
  if (raw === "progress") return { kind: "progress" };
  if (raw === "verses") return { kind: "verses" };

  const colon = raw.indexOf(":");
  if (colon === -1) return undefined;
  const kind = raw.slice(0, colon);
  const id = raw.slice(colon + 1);
  if (!PANEL_ID_PATTERN.test(id)) return undefined;
  if (kind === "pack") return { kind: "pack", packId: id };
  if (kind === "verse") return { kind: "verse", verseRefId: id };
  return undefined;
}

/** "progress" | "verses" | "pack:<id>" | "verse:<id>" */
export function formatMemoryPanel(panel: MemoryPanel): string {
  switch (panel.kind) {
    case "progress":
    case "verses":
      return panel.kind;
    case "pack":
      return `pack:${panel.packId}`;
    case "verse":
      return `verse:${panel.verseRefId}`;
  }
}

export function parseMemoryPanelFrom(
  raw: unknown,
): MemoryPanelFrom | undefined {
  return raw === "verses" ? "verses" : undefined;
}

/** Your verses never links back to itself. */
function fromFor(
  panel: MemoryPanel,
  from: MemoryPanelFrom | undefined,
): MemoryPanelFrom | undefined {
  return panel.kind === "verses" ? undefined : from;
}

export interface MemoryHomeSearch {
  panel?: string;
  from?: MemoryPanelFrom;
}

/** `/memory` search: an unknown `panel` is dropped, and `from` with it. */
export function validateMemoryHomeSearch(
  search: Record<string, unknown>,
): MemoryHomeSearch {
  const panel = parseMemoryPanel(search.panel);
  if (!panel) return {};
  const from = fromFor(panel, parseMemoryPanelFrom(search.from));
  return from
    ? { panel: formatMemoryPanel(panel), from }
    : { panel: formatMemoryPanel(panel) };
}

export interface MemoryPanelPageSearch {
  from?: MemoryPanelFrom;
}

/** Search for the full pages (`/memory/progress`, `/memory/verse/$id`, …). */
export function validateMemoryPanelPageSearch(
  search: Record<string, unknown>,
): MemoryPanelPageSearch {
  const from = parseMemoryPanelFrom(search.from);
  return from ? { from } : {};
}

/** The drawer over Today, e.g. `/memory?panel=pack%3Aabc&from=verses`. */
export function memoryPanelDrawerHref(
  panel: MemoryPanel,
  opts?: { from?: MemoryPanelFrom },
): string {
  const params = new URLSearchParams({ panel: formatMemoryPanel(panel) });
  const from = fromFor(panel, opts?.from);
  if (from) params.set("from", from);
  return `/memory?${params.toString()}`;
}

/** `/memory/progress` | `/memory/verses` | `/memory/$packId` | `/memory/verse/$id`, plus `?from=`. */
export function memoryPanelFullPagePath(
  panel: MemoryPanel,
  opts?: { from?: MemoryPanelFrom },
): string {
  let path: string;
  switch (panel.kind) {
    case "progress":
      path = "/memory/progress";
      break;
    case "verses":
      path = "/memory/verses";
      break;
    case "pack":
      path = `/memory/${encodeURIComponent(panel.packId)}`;
      break;
    case "verse":
      path = `/memory/verse/${encodeURIComponent(panel.verseRefId)}`;
      break;
  }
  const from = fromFor(panel, opts?.from);
  return from ? `${path}?from=${from}` : path;
}
