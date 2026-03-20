export function assertDevOnlySeedAllowed(): void {
  const deployment = process.env.CONVEX_DEPLOYMENT;
  if (deployment?.startsWith("prod:")) {
    throw new Error(
      "This seed mutation is dev-only and cannot run on production deployments.",
    );
  }
}

export function normalizeTag(rawTag: string): string {
  return rawTag.trim().toLowerCase().replace(/\s+/g, " ").slice(0, 48);
}

export function normalizeTags(rawTags: string[]): string[] {
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const rawTag of rawTags) {
    const tag = normalizeTag(rawTag);
    if (!tag || seen.has(tag)) continue;
    seen.add(tag);
    tags.push(tag);
  }
  return tags;
}

export function clampInteger(
  value: number | undefined,
  min: number,
  max: number,
  fallback: number,
): number {
  if (typeof value !== "number" || Number.isNaN(value)) return fallback;
  const normalized = Math.floor(value);
  if (normalized < min) return min;
  if (normalized > max) return max;
  return normalized;
}

export function createRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randomInt(rng: () => number, min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

export function pickOne<T>(rng: () => number, items: T[]): T {
  return items[randomInt(rng, 0, items.length - 1)];
}

export function sampleWithoutReplacement<T>(
  rng: () => number,
  items: T[],
  count: number,
): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = randomInt(rng, 0, i);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, count);
}

export function chapterKey(chapter: { book: string; chapter: number }): string {
  return `${chapter.book}:${chapter.chapter}`;
}

const DEV_MAX_NOTES_PER_VERSE = 8;
const DEV_MIN_ANCHOR_VERSES = 4;
const DEV_MAX_ANCHOR_VERSES = 8;

export function buildVerseAnchorsForChapter(noteCount: number): number[] {
  const minAnchorsNeeded = Math.ceil(noteCount / DEV_MAX_NOTES_PER_VERSE);
  const anchorCount = Math.min(
    DEV_MAX_ANCHOR_VERSES,
    Math.max(DEV_MIN_ANCHOR_VERSES, minAnchorsNeeded),
  );
  return Array.from({ length: anchorCount }, (_, index) => index + 1);
}

export function pickBalancedVerseAnchor(
  rng: () => number,
  anchors: number[],
  verseUsage: Map<number, number>,
): number {
  let minUsage = Number.POSITIVE_INFINITY;
  for (const anchor of anchors) {
    const usage = verseUsage.get(anchor) ?? 0;
    if (usage < minUsage) {
      minUsage = usage;
    }
  }

  const leastUsedAnchors = anchors.filter(
    (anchor) => (verseUsage.get(anchor) ?? 0) === minUsage,
  );
  return pickOne(rng, leastUsedAnchors);
}
