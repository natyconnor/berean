import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

/**
 * A word as a label ("Scope", "Presets") anywhere, or lowercase in prose
 * ("in this scope"). Code values in string literals ("scope",
 * "/memory/presets", "@/lib/verse-scope-match") have no spaces, so they pass.
 */
function uiWord(lowercase: string): RegExp {
  const label = lowercase.charAt(0).toUpperCase() + lowercase.slice(1);
  return new RegExp(`\\b${label}s?\\b|^(?=.*\\s).*\\b${lowercase}s?\\b`);
}

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
  { word: "Scope", pattern: uiWord("scope") },
  { word: "Custom pack", pattern: /\bcustom packs?\b/i },
  { word: "Scope pack", pattern: /\bscope packs?\b/i },
  { word: "Preset", pattern: uiWord("preset") },
  { word: "Collection", pattern: uiWord("collection") },
  { word: "Browse presets", pattern: /\bbrowse presets\b/i },
];

/**
 * Strings that must keep a banned word, matched by repo-relative file and
 * exact text. Every entry needs a reason.
 */
export const MEMORY_COPY_ALLOWLIST: readonly {
  file: string;
  text: string;
  reason: string;
}[] = [
  {
    file: "src/components/memory/preview-memory-seed-card.tsx",
    text: "Loads hearted verses at every stage, custom packs, and five distinct-scope passage packs (Psalm 1 start, Jude building, 3 John budget used, Psalm 23 maintenance, multi-book collection-only). Replaces this account&apos;s hearted verses and packs.",
    reason:
      "Developer seed tool shown only on preview deployments; it names the seeded data shapes.",
  },
];

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

  it("catches pack type words in copy but not in code values", () => {
    const sample = [
      'const a = <h2 title="Scope">Collections</h2>;',
      'const b = "No hearted verses in this scope yet.";',
      "const c = <p>Start from a preset chapter.</p>;",
      'const d = "Custom packs";',
      "const e = <span>Scope pack</span>;",
      'const f = <a href="/memory/presets">Browse presets</a>;',
      'const g = "Every passage in this collection";',
      'const ok1 = pack.kind === "scope" || preset.kind === "collection";',
      'const ok2 = "/memory/presets/$presetId";',
      'import { x } from "@/lib/verse-scope-match";',
      "const ok3 = <p>Suggestions · Packs</p>;",
    ].join("\n");

    expect(bannedCopyIn(userVisibleStrings(sample))).toEqual([
      '"Scope" in "Scope"',
      '"Collection" in "Collections"',
      '"Scope" in "No hearted verses in this scope yet."',
      '"Preset" in "Start from a preset chapter."',
      '"Custom pack" in "Custom packs"',
      '"Scope" in "Scope pack"',
      '"Scope pack" in "Scope pack"',
      '"Preset" in "Browse presets"',
      '"Browse presets" in "Browse presets"',
      '"Collection" in "Every passage in this collection"',
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
