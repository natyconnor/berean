import { normalizeTags } from "@/lib/tag-utils";

function trimTrailingEmptyLines(lines: string[]): string[] {
  const result = [...lines];
  while (result.length > 0 && result[result.length - 1].trim().length === 0) {
    result.pop();
  }
  return result;
}

function parseTagLine(line: string): string[] | null {
  const pieces = line
    .split(",")
    .map((piece) => piece.trim())
    .filter((piece) => piece.length > 0);

  if (pieces.length === 0) {
    return null;
  }

  if (pieces.some((piece) => !piece.startsWith("#") || piece === "#")) {
    return null;
  }

  return normalizeTags(pieces.map((piece) => piece.slice(1)));
}

export function parseImportedNoteCell(rawValue: unknown): {
  content: string;
  tags: string[];
} | null {
  const value =
    typeof rawValue === "string"
      ? rawValue.replace(/\r\n/g, "\n").trim()
      : typeof rawValue === "number" ||
          typeof rawValue === "boolean" ||
          typeof rawValue === "bigint"
        ? String(rawValue).trim()
        : "";
  if (value.length === 0) {
    return null;
  }

  const lines = trimTrailingEmptyLines(value.split("\n"));
  if (lines.length === 0) {
    return null;
  }

  const parsedTags = parseTagLine(lines[lines.length - 1]);
  const contentLines = parsedTags
    ? trimTrailingEmptyLines(lines.slice(0, -1))
    : lines;
  const content = contentLines.join("\n").trim();

  if (content.length === 0) {
    return null;
  }

  return {
    content,
    tags: parsedTags ?? [],
  };
}

export function serializeExportedNoteCell(
  content: string,
  tags: string[],
): string {
  const normalizedContent = content.replace(/\r\n/g, "\n").trim();
  const normalizedTags = normalizeTags(tags);
  if (normalizedTags.length === 0) {
    return normalizedContent;
  }

  const tagLine = normalizedTags.map((tag) => `#${tag}`).join(", ");
  return normalizedContent.length > 0
    ? `${normalizedContent}\n${tagLine}`
    : tagLine;
}
