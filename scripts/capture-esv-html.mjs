#!/usr/bin/env node
/**
 * Fetch real Crossway HTML for hard chapters and write fixtures under
 * shared/fixtures/esv-html/. Requires ESV_API_KEY in the environment.
 *
 * Example:
 *   ESV_API_KEY="$(npx convex env get ESV_API_KEY)" node scripts/capture-esv-html.mjs
 */

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = join(__dirname, "..", "shared", "fixtures", "esv-html");

const PASSAGES = [
  { slug: "song-of-solomon-1", query: "Song of Solomon 1" },
  { slug: "psalm-119-1-16", query: "Psalm 119:1-16" },
  { slug: "2-samuel-12-15-16", query: "2 Samuel 12:15-16" },
];

function buildHtmlUrl(query) {
  const params = new URLSearchParams({
    q: query,
    "include-passage-references": "false",
    "include-verse-numbers": "true",
    "include-first-verse-numbers": "true",
    "include-footnotes": "false",
    "include-footnote-body": "false",
    "include-headings": "true",
    "include-subheadings": "true",
    "include-surrounding-chapters": "false",
    "include-audio-link": "false",
    "include-short-copyright": "false",
    "include-copyright": "true",
    "include-css-link": "false",
    "inline-styles": "false",
    "wrapping-div": "true",
    "div-classes": "esv",
    "paragraph-tag": "p",
  });
  return `https://api.esv.org/v3/passage/html/?${params}`;
}

async function fetchPassage(apiKey, query) {
  const response = await fetch(buildHtmlUrl(query), {
    headers: { Authorization: `Token ${apiKey}` },
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      `ESV API error for ${query}: ${response.status} ${response.statusText}\n${body}`,
    );
  }
  return response.json();
}

async function main() {
  const apiKey = process.env.ESV_API_KEY?.trim();
  if (!apiKey) {
    console.error(
      "ESV_API_KEY is required. Example:\n" +
        '  ESV_API_KEY="$(npx convex env get ESV_API_KEY)" node scripts/capture-esv-html.mjs',
    );
    process.exit(1);
  }

  await mkdir(FIXTURES_DIR, { recursive: true });

  for (const { slug, query } of PASSAGES) {
    console.log(`Fetching ${query}…`);
    const payload = await fetchPassage(apiKey, query);
    const outPath = join(FIXTURES_DIR, `${slug}.json`);
    await writeFile(outPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
    console.log(`Wrote ${outPath}`);
  }

  console.log("Done.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
