import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

/**
 * Words Memory never shows. Later PRs extend this list as more internal terms
 * leave the UI.
 */
export const BANNED_MEMORY_COPY: readonly {
  word: string;
  pattern: RegExp;
}[] = [
  { word: "come back tomorrow", pattern: /come back tomorrow/i },
  { word: "band", pattern: /\bband\b/i },
  { word: "Guided", pattern: /\bGuided\b/ },
  { word: "Challenge", pattern: /\bChallenge\b/ },
  { word: "Reviewing", pattern: /\bReviewing\b/ },
  { word: "Learn as a passage", pattern: /\bLearn as a passage\b/i },
  { word: "Learn whole passage", pattern: /\bLearn whole passage\b/i },
  { word: "Memorize whole passage", pattern: /\bMemorize whole passage\b/i },
  { word: "Recite as one passage", pattern: /\bRecite as one passage\b/i },
];

/**
 * Strings that must keep a banned word, matched by repo-relative file and
 * exact text. Every entry needs a reason.
 */
export const MEMORY_COPY_ALLOWLIST: readonly {
  file: string;
  text: string;
  reason: string;
}[] = [];

const ROOT = process.cwd();

function isGuardedSource(file: string): boolean {
  return /\.(ts|tsx)$/.test(file) && !/\.test\.(ts|tsx)$/.test(file);
}

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return isGuardedSource(entry.name) ? [full] : [];
  });
}

function guardedFiles(): string[] {
  const memoryDir = path.join(ROOT, "src/components/memory");
  const routesDir = path.join(ROOT, "src/components/routes");
  const routeFiles = fs
    .readdirSync(routesDir)
    .filter((name) => /^memory-.*\.tsx$/.test(name) && isGuardedSource(name))
    .map((name) => path.join(routesDir, name));
  return [...walk(memoryDir), ...routeFiles].sort();
}

/**
 * Text a user could see: string literals, template text, and JSX text.
 * Comments are not nodes in the syntax tree, so they never count.
 */
export function userVisibleStrings(
  source: string,
  fileName = "source.tsx",
): string[] {
  const sourceFile = ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.Latest,
    false,
    fileName.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const strings: string[] = [];
  const visit = (node: ts.Node): void => {
    if (
      ts.isStringLiteral(node) ||
      ts.isNoSubstitutionTemplateLiteral(node) ||
      ts.isTemplateHead(node) ||
      ts.isTemplateMiddle(node) ||
      ts.isTemplateTail(node) ||
      ts.isJsxText(node)
    ) {
      const text = node.text.replace(/\s+/g, " ").trim();
      if (text.length > 0) strings.push(text);
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return strings;
}

export function bannedCopyIn(strings: readonly string[]): string[] {
  return strings.flatMap((text) =>
    BANNED_MEMORY_COPY.filter(({ pattern }) => pattern.test(text)).map(
      ({ word }) => `"${word}" in "${text}"`,
    ),
  );
}

describe("Memory copy guard", () => {
  it("finds banned words in literals and JSX text, not comments", () => {
    const sample = [
      "// Guided band, come back tomorrow",
      "/* Reviewing */",
      'const a = "Come back tomorrow.";',
      "const b = `${label} band`;",
      "const c = <p>Next: Challenge</p>;",
      'const d = <span title="Guided">Reviewing</span>;',
      'const ok = "Up next tomorrow · bandwidth";',
    ].join("\n");

    expect(bannedCopyIn(userVisibleStrings(sample))).toEqual([
      '"come back tomorrow" in "Come back tomorrow."',
      '"band" in "band"',
      '"Challenge" in "Next: Challenge"',
      '"Guided" in "Guided"',
      '"Reviewing" in "Reviewing"',
    ]);
  });

  it("joins JSX text that wraps across lines", () => {
    const sample = "const e = <p>Come back\n      tomorrow to continue.</p>;";
    expect(bannedCopyIn(userVisibleStrings(sample))).toEqual([
      '"come back tomorrow" in "Come back tomorrow to continue."',
    ]);
  });

  it("catches the old passage paths but not the one remaining offer", () => {
    const sample = [
      'const a = "Learn as a passage";',
      "const b = <p>Learn whole passage</p>;",
      'const c = "Memorize whole passage";',
      'const d = <label aria-label="Recite as one passage" />;',
      'const ok = "Learn it as a passage";',
    ].join("\n");

    expect(bannedCopyIn(userVisibleStrings(sample))).toEqual([
      '"Learn as a passage" in "Learn as a passage"',
      '"Learn whole passage" in "Learn whole passage"',
      '"Memorize whole passage" in "Memorize whole passage"',
      '"Recite as one passage" in "Recite as one passage"',
    ]);
  });

  it("keeps banned words out of Memory components", () => {
    const files = guardedFiles();
    expect(files.length).toBeGreaterThan(0);

    const violations = files.flatMap((file) => {
      const relative = path.relative(ROOT, file);
      const source = fs.readFileSync(file, "utf8");
      const allowed = new Set(
        MEMORY_COPY_ALLOWLIST.filter((entry) => entry.file === relative).map(
          (entry) => entry.text,
        ),
      );
      const strings = userVisibleStrings(source, file).filter(
        (text) => !allowed.has(text),
      );
      return bannedCopyIn(strings).map((hit) => `${relative}: ${hit}`);
    });

    expect(violations).toEqual([]);
  });
});
