export const MAX_TAG_LENGTH = 48

export type TagMatchMode = "any" | "all"

export function normalizeTag(rawTag: string): string {
  return rawTag.trim().toLowerCase().replace(/\s+/g, " ").slice(0, MAX_TAG_LENGTH)
}

export function normalizeTags(rawTags: string[]): string[] {
  const seen = new Set<string>()
  const normalized: string[] = []

  for (const rawTag of rawTags) {
    const tag = normalizeTag(rawTag)
    if (!tag || seen.has(tag)) continue
    seen.add(tag)
    normalized.push(tag)
  }

  return normalized
}
