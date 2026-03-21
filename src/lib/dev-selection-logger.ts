/**
 * Dev-only: logs Selection API state to the console for diagnosing verse text
 * selection glitches.
 *
 * Enable (pick one):
 *   localStorage.setItem("berean:debugSelection", "1")
 *   then reload.
 *
 * Or open the app with ?debugSelection=1 (persists the flag in localStorage).
 *
 * Disable:
 *   localStorage.removeItem("berean:debugSelection")
 */

const STORAGE_KEY = "berean:debugSelection";

function debugSelectionEnabled(): boolean {
  if (!import.meta.env.DEV || typeof window === "undefined") return false;
  try {
    const q = new URLSearchParams(window.location.search);
    if (q.get("debugSelection") === "1") {
      localStorage.setItem(STORAGE_KEY, "1");
    }
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function describeNode(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    const t = node.textContent ?? "";
    const preview =
      t.length > 48 ? `${JSON.stringify(t.slice(0, 48))}…` : JSON.stringify(t);
    return `#text(len=${t.length}, ${preview})`;
  }
  if (node instanceof HTMLElement) {
    const tag = node.tagName.toLowerCase();
    const id = node.id ? `#${node.id}` : "";
    const cls =
      typeof node.className === "string" && node.className
        ? `.${node.className.trim().split(/\s+/).slice(0, 4).join(".")}`
        : "";
    const mark = node.tagName === "MARK" ? "[mark]" : "";
    return `${tag}${id}${cls}${mark}`;
  }
  return node.nodeName;
}

function verseNumberFromNode(node: Node): number | null {
  let el: Node | null =
    node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
  while (el && el instanceof HTMLElement) {
    const raw = el.dataset.verseNumber;
    if (raw != null && raw !== "") {
      const n = Number.parseInt(raw, 10);
      return Number.isFinite(n) ? n : null;
    }
    el = el.parentElement;
  }
  return null;
}

function ancestorChain(node: Node, maxDepth: number): string[] {
  const out: string[] = [];
  let el: Node | null =
    node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
  let depth = 0;
  while (el && depth < maxDepth) {
    let label = describeNode(el);
    if (el instanceof HTMLElement && el.dataset.verseNumber != null) {
      label += `[data-verse-number=${el.dataset.verseNumber}]`;
    }
    out.push(label);
    el = el.parentElement;
    depth += 1;
  }
  return out;
}

/** True if common ancestor is the verse text column with two stacked copies. */
function dualTextLayerHint(range: Range): boolean | null {
  const root = range.commonAncestorContainer;
  let el: Node | null =
    root.nodeType === Node.TEXT_NODE ? root.parentElement : root;
  while (el && el instanceof HTMLElement) {
    if (el.classList.contains("relative") && el.classList.contains("flex-1")) {
      const children = el.querySelectorAll(":scope > span.font-serif");
      return children.length >= 2;
    }
    el = el.parentElement;
  }
  return null;
}

let seq = 0;
let lastCollapsed = true;

export function initDevSelectionLogger(): void {
  if (!import.meta.env.DEV) return;
  if (!debugSelectionEnabled()) return;

  console.info(
    "%c[berean:selection]%c logging on — copy console output when the glitch happens. Off: localStorage.removeItem(%s)",
    "color:#0a0;font-weight:bold",
    "color:inherit;font-weight:inherit",
    JSON.stringify(STORAGE_KEY),
  );

  const flush = (): void => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) {
      if (!lastCollapsed) {
        seq += 1;
        console.log("[berean:selection]", { seq, kind: "empty" });
        lastCollapsed = true;
      }
      return;
    }

    const range = sel.getRangeAt(0);
    const collapsed = range.collapsed;

    if (collapsed) {
      if (!lastCollapsed) {
        seq += 1;
        console.log("[berean:selection]", { seq, kind: "collapsed" });
      }
      lastCollapsed = true;
      return;
    }

    lastCollapsed = false;
    seq += 1;

    const rect = range.getBoundingClientRect();
    const str = sel.toString();
    const startVerse = verseNumberFromNode(range.startContainer);
    const endVerse = verseNumberFromNode(range.endContainer);

    console.log("[berean:selection]", {
      seq,
      kind: "range",
      tMs: Math.round(performance.now()),
      startOffset: range.startOffset,
      endOffset: range.endOffset,
      startContainer: describeNode(range.startContainer),
      endContainer: describeNode(range.endContainer),
      commonAncestor: describeNode(range.commonAncestorContainer),
      startVerse,
      endVerse,
      multiVerse:
        startVerse != null && endVerse != null && startVerse !== endVerse,
      textLen: str.length,
      textPreview: str.length > 120 ? `${str.slice(0, 120)}…` : str,
      rect: {
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        w: Math.round(rect.width),
        h: Math.round(rect.height),
      },
      dualTextLayerUnderCommonAncestor: dualTextLayerHint(range),
      startAncestors: ancestorChain(range.startContainer, 10),
      endAncestors: ancestorChain(range.endContainer, 10),
    });
  };

  let raf = 0;
  document.addEventListener("selectionchange", () => {
    if (raf !== 0) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      raf = 0;
      flush();
    });
  });
}
