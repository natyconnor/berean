/**
 * Parse Crossway ESV passage HTML into the same EsvVerse / EsvChapterData
 * shapes as the text parser in `shared/esv-api.ts`.
 *
 * Tag / class map (Crossway HTML, fixture-driven):
 * - Section (editorial) heading → `h3` (empty nodes ignored)
 * - Subheading (speakers, acrostics, psalm titles) → `h4`
 *   - Song speakers: `h4.speaker`
 *   - Psalm 119 letters: `h4.psalm-acrostic-title`
 *   - Other marked subs (e.g. psalm titles): any non-empty `h4`
 * - Verse number → `b.verse-num` (optionally `.inline` in poetry)
 * - Chapter+verse at chapter start → `b.chapter-num` (e.g. `1:1`, `119:1`)
 * - Copyright → `p.copyright` / `.copyright`
 * - Poetry soft breaks → `br`; block boundaries → `p` (and similar)
 * - Footnote / crossref chrome is requested off via API params
 */
import { type HTMLElement, type Node, NodeType, parse } from "node-html-parser";

import type { EsvChapterData, EsvVerse, EsvVerseHeading } from "./esv-api";

/** Crossway HTML selectors — rename here if Crossway changes markup. */
export const ESV_HTML_ADAPTER = {
  sectionHeadingTag: "H3",
  subheadingTag: "H4",
  verseNumClass: "verse-num",
  chapterNumClass: "chapter-num",
  copyrightClass: "copyright",
  speakerClass: "speaker",
  acrosticClass: "psalm-acrostic-title",
  blockTags: new Set(["P", "DIV", "BLOCKQUOTE"]),
  skipTags: new Set(["SCRIPT", "STYLE", "LINK"]),
} as const;

const DEFAULT_COPYRIGHT =
  "Scripture quotations are from the ESV\u00AE Bible (The Holy Bible, English Standard Version\u00AE), \u00A9 2001 by Crossway, a publishing ministry of Good News Publishers. Used by permission. All rights reserved.";

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

function asNonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function isElement(node: Node): node is HTMLElement {
  return node.nodeType === NodeType.ELEMENT_NODE;
}

function isTextNode(node: Node): boolean {
  return node.nodeType === NodeType.TEXT_NODE;
}

function hasClass(el: HTMLElement, className: string): boolean {
  const raw = el.getAttribute("class");
  if (!raw) return false;
  return raw.split(/\s+/).includes(className);
}

function joinOptional(
  a: string | null | undefined,
  b: string | null | undefined,
): string | null {
  const parts = [a, b].filter((part): part is string => !!part);
  return parts.length > 0 ? parts.join("\n") : null;
}

function parseVerseNumberLabel(raw: string): number | null {
  const trimmed = raw.replace(/\u00a0/g, " ").trim();
  // chapter-num: "1:1" / "119:1"; verse-num: "15"
  const chapterVerse = /^(\d+)\s*:\s*(\d+)\s*$/.exec(trimmed);
  if (chapterVerse) {
    const verse = chapterVerse[2];
    return verse === undefined ? null : Number.parseInt(verse, 10);
  }
  const verseOnly = /^(\d+)\s*$/.exec(trimmed);
  if (verseOnly) {
    const verse = verseOnly[1];
    return verse === undefined ? null : Number.parseInt(verse, 10);
  }
  return null;
}

type WalkEvent =
  | { kind: "verse-start"; number: number }
  | { kind: "section"; text: string }
  | { kind: "sub"; text: string }
  | { kind: "text"; value: string }
  | { kind: "soft-break" }
  | { kind: "block-break" };

function classifyElement(el: HTMLElement): WalkEvent | "skip" | "descend" {
  const tag = el.rawTagName?.toUpperCase() ?? "";

  if (ESV_HTML_ADAPTER.skipTags.has(tag)) return "skip";
  if (hasClass(el, ESV_HTML_ADAPTER.copyrightClass)) return "skip";

  if (
    hasClass(el, ESV_HTML_ADAPTER.verseNumClass) ||
    hasClass(el, ESV_HTML_ADAPTER.chapterNumClass)
  ) {
    const number = parseVerseNumberLabel(el.text);
    if (number !== null) {
      return { kind: "verse-start", number };
    }
    return "skip";
  }

  if (tag === ESV_HTML_ADAPTER.sectionHeadingTag) {
    const text = el.text.replace(/\u00a0/g, " ").trim();
    if (text.length === 0) return "skip";
    return { kind: "section", text };
  }

  if (tag === ESV_HTML_ADAPTER.subheadingTag) {
    const text = el.text.replace(/\u00a0/g, " ").trim();
    if (text.length === 0) return "skip";
    return { kind: "sub", text };
  }

  if (tag === "BR") {
    return { kind: "soft-break" };
  }

  return "descend";
}

function walkNodes(node: Node, emit: (event: WalkEvent) => void): void {
  if (isTextNode(node)) {
    // Prefer `text` (entity-decoded) over `rawText`, which leaves literals
    // like `&nbsp;` in verse bodies. Map real NBSPs to spaces so poetry
    // indent from Crossway still works after soft breaks.
    const value = (node.text ?? "").replace(/\u00a0/g, " ");
    // Inter-tag whitespace from pretty-printed HTML is noise; intentional
    // poetry indent is non-empty after trim only when it has content nearby —
    // pure whitespace/newline text nodes are skipped.
    if (value.trim().length === 0) return;
    emit({ kind: "text", value });
    return;
  }

  if (!isElement(node)) return;

  const classified = classifyElement(node);
  if (classified === "skip") return;
  if (classified !== "descend") {
    emit(classified);
    return;
  }

  for (const child of node.childNodes) {
    walkNodes(child, emit);
  }

  const tag = node.rawTagName?.toUpperCase() ?? "";
  if (ESV_HTML_ADAPTER.blockTags.has(tag) && tag !== "DIV") {
    // Outer wrapping `div.esv` is not a paragraph break; `p` is.
    emit({ kind: "block-break" });
  }
}

interface OpenVerse {
  number: number;
  text: string;
  midHeadings: EsvVerseHeading[];
  pendingSections: string[];
  pendingSubs: string[];
  leadingSubs: string[];
  seenText: boolean;
  needsParagraphBreak: boolean;
}

function flushPendingsIntoMid(verse: OpenVerse): void {
  if (verse.pendingSections.length === 0 && verse.pendingSubs.length === 0) {
    return;
  }
  if (verse.text.length > 0 && !verse.text.endsWith("\n\n")) {
    verse.text = verse.text.replace(/\s+$/, "") + "\n\n";
  }
  verse.needsParagraphBreak = false;
  for (const heading of verse.pendingSections) {
    verse.midHeadings.push({
      text: heading,
      offset: verse.text.length,
      variant: "section",
    });
  }
  for (const sub of verse.pendingSubs) {
    verse.midHeadings.push({
      text: sub,
      offset: verse.text.length,
      variant: "sub",
    });
  }
  verse.pendingSections = [];
  verse.pendingSubs = [];
}

/**
 * Crossway HTML poetry uses 2-space `&nbsp;` steps (plus CSS on esv.org).
 * The text API uses 4-space monospace steps. Scale leading spaces so
 * `whitespace-pre-wrap` matches the text path.
 */
function expandHtmlPoetryIndent(part: string): string {
  const match = /^( +)/.exec(part);
  if (!match?.[1]) return part;
  return " ".repeat(match[1].length * 2) + part.slice(match[1].length);
}

function appendText(verse: OpenVerse, raw: string): void {
  const hasContent = raw.trim().length > 0;
  if (!hasContent) return;

  if (verse.seenText) {
    flushPendingsIntoMid(verse);
  } else if (verse.pendingSections.length > 0) {
    for (const heading of verse.pendingSections) {
      verse.midHeadings.push({
        text: heading,
        offset: 0,
        variant: "section",
      });
    }
    verse.pendingSections = [];
  }

  if (verse.needsParagraphBreak && verse.text.length > 0) {
    if (!verse.text.endsWith("\n\n")) {
      verse.text = verse.text.replace(/\s+$/, "") + "\n\n";
    }
    verse.needsParagraphBreak = false;
  }

  const isFirstPart = verse.text.length === 0;
  let part = raw.replace(/\s+$/, "");
  if (isFirstPart) {
    // Verse-start lines flush left (same as the text parser).
    part = part.replace(/^\s+/, "");
  } else if (verse.text.endsWith("\n")) {
    // Keep poetry indentation after soft breaks; drop only blank lead-ins.
    part = part.replace(/^(?:[ \t]*\n)+/, "");
    part = expandHtmlPoetryIndent(part);
  } else if (!verse.needsParagraphBreak) {
    // Soft-join when text continues after a heading flush already added \n\n.
  }

  if (
    !isFirstPart &&
    !verse.text.endsWith("\n") &&
    !verse.text.endsWith("\n\n")
  ) {
    // Adjacent text nodes without an explicit break — keep a single space if
    // neither side supplies separation (rare in Crossway HTML).
    if (!/\s$/.test(verse.text) && !/^\s/.test(part)) {
      verse.text += " ";
    }
  }

  verse.text += part;
  verse.seenText = true;
}

function finalizeOpenVerse(
  verse: OpenVerse,
  pendingHeading: string | null,
  pendingSubheading: string | null,
): {
  verse: EsvVerse;
  trailingHeading: string | null;
  trailingSubheading: string | null;
} {
  const trailingHeading =
    verse.pendingSections.length > 0 ? verse.pendingSections.join("\n") : null;
  const trailingSubheading =
    verse.pendingSubs.length > 0 ? verse.pendingSubs.join("\n") : null;

  const atStart = verse.midHeadings.filter(
    (heading) => heading.offset === 0 && heading.variant !== "sub",
  );
  const midOnly = verse.midHeadings.filter(
    (heading) => heading.offset > 0 || heading.variant === "sub",
  );

  const heading = joinOptional(
    pendingHeading,
    atStart.length > 0 ? atStart.map((h) => h.text).join("\n") : null,
  );
  const subheading = joinOptional(
    pendingSubheading,
    verse.leadingSubs.length > 0 ? verse.leadingSubs.join("\n") : null,
  );

  const result: EsvVerse = {
    number: verse.number,
    text: verse.text.replace(/\s+$/, ""),
  };
  if (heading) result.heading = heading;
  if (subheading) result.subheading = subheading;
  if (midOnly.length > 0) result.midHeadings = midOnly;

  return {
    verse: result,
    trailingHeading,
    trailingSubheading,
  };
}

/**
 * Walk Crossway passage HTML in document order and build EsvVerse[].
 */
export function parsePassageHtmlIntoVerses(html: string): EsvVerse[] {
  const root = parse(html, { blockTextElements: {} });
  const verses: EsvVerse[] = [];

  let pendingHeading: string | null = null;
  let pendingSubheading: string | null = null;
  let current: OpenVerse | null = null;

  const closeCurrent = () => {
    if (!current) return;
    const closed = finalizeOpenVerse(
      current,
      pendingHeading,
      pendingSubheading,
    );
    verses.push(closed.verse);
    pendingHeading = closed.trailingHeading;
    pendingSubheading = closed.trailingSubheading;
    current = null;
  };

  const startVerse = (number: number) => {
    closeCurrent();
    current = {
      number,
      text: "",
      midHeadings: [],
      pendingSections: [],
      pendingSubs: [],
      leadingSubs: [],
      seenText: false,
      needsParagraphBreak: false,
    };
    // Pending labels collected before this verse number belong on it.
    // They stay in pendingHeading/Sub until finalize reads them.
  };

  walkNodes(root, (event) => {
    switch (event.kind) {
      case "verse-start":
        startVerse(event.number);
        return;
      case "section": {
        if (current?.seenText) {
          current.pendingSections.push(event.text);
        } else if (current && !current.seenText) {
          pendingHeading = joinOptional(pendingHeading, event.text);
        } else {
          pendingHeading = joinOptional(pendingHeading, event.text);
        }
        return;
      }
      case "sub": {
        if (current?.seenText) {
          current.pendingSubs.push(event.text);
        } else if (current && !current.seenText) {
          current.leadingSubs.push(event.text);
        } else {
          pendingSubheading = joinOptional(pendingSubheading, event.text);
        }
        return;
      }
      case "text":
        if (!current) return;
        appendText(current, event.value);
        return;
      case "soft-break":
        if (!current || !current.seenText) return;
        if (!current.text.endsWith("\n")) {
          current.text += "\n";
        }
        return;
      case "block-break":
        if (!current || !current.seenText) return;
        current.needsParagraphBreak = true;
        return;
    }
  });

  closeCurrent();
  return verses;
}

function extractCopyright(html: string): string {
  const root = parse(html, { blockTextElements: {} });
  const node = root.querySelector(`.${ESV_HTML_ADAPTER.copyrightClass}`);
  if (!node) return DEFAULT_COPYRIGHT;
  const text = node.text
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > 0 ? text : DEFAULT_COPYRIGHT;
}

/**
 * Parse an ESV `/v3/passage/html/` JSON body into EsvChapterData.
 */
export function parseEsvHtmlResponse(raw: unknown): EsvChapterData {
  const value = isRecord(raw) ? raw : {};
  const passages = Array.isArray(value.passages)
    ? value.passages.filter(
        (entry): entry is string => typeof entry === "string",
      )
    : [];
  const html = passages[0] ?? "";
  const canonical = asNonEmptyString(value.canonical) ?? "";

  return {
    canonical,
    verses: parsePassageHtmlIntoVerses(html),
    copyright: extractCopyright(html),
  };
}
