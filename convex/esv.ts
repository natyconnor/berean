"use node";
import { action } from "./_generated/server";
import { v } from "convex/values";

import {
  esvChapterDataValue,
  esvChapterResultValue,
  type EsvChapterData,
  type EsvChapterResult,
} from "./lib/publicValues";
import { requireActionIdentity } from "./lib/auth";
import { parseEsvResponse } from "../shared/esv-api";

function parseJsonBody(value: string): unknown {
  return JSON.parse(value) as unknown;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

const MAX_RATE_LIMIT_ATTEMPTS = 6;
const MAX_BACKOFF_MS = 60_000;

/** Parse `Retry-After` as seconds (integer) or HTTP-date; returns ms to wait, capped. */
function parseRetryAfterMs(response: Response): number | null {
  const header = response.headers.get("retry-after");
  if (!header?.trim()) return null;

  const asSeconds = Number.parseInt(header, 10);
  if (Number.isFinite(asSeconds) && asSeconds >= 0) {
    return Math.min(asSeconds * 1000, MAX_BACKOFF_MS);
  }

  const dateMs = Date.parse(header);
  if (!Number.isFinite(dateMs)) return null;
  const delta = dateMs - Date.now();
  if (delta <= 0) return null;
  return Math.min(delta, MAX_BACKOFF_MS);
}

async function fetchPassageText(
  apiKey: string,
  query: string,
): Promise<EsvChapterData> {
  const params = new URLSearchParams({
    q: query,
    "include-verse-numbers": "true",
    "include-first-verse-numbers": "true",
    "include-headings": "false",
    "include-footnotes": "false",
    "include-footnote-body": "false",
    "include-passage-references": "true",
    "include-short-copyright": "false",
    "include-copyright": "true",
    "indent-poetry": "true",
    "indent-using": "space",
    "line-length": "0",
  });

  const url = `https://api.esv.org/v3/passage/text/?${params}`;

  for (let attempt = 0; attempt < MAX_RATE_LIMIT_ATTEMPTS; attempt++) {
    const response = await fetch(url, {
      headers: { Authorization: `Token ${apiKey}` },
    });

    if (response.status === 429 && attempt < MAX_RATE_LIMIT_ATTEMPTS - 1) {
      void response.text().catch(() => {
        /* drain body for connection hygiene */
      });
      const fromHeader = parseRetryAfterMs(response);
      const exponential = Math.min(1000 * 2 ** attempt, MAX_BACKOFF_MS);
      const waitMs = fromHeader ?? exponential;
      await sleep(waitMs);
      continue;
    }

    if (!response.ok) {
      throw new Error(
        `ESV API error: ${response.status} ${response.statusText}`,
      );
    }

    const body = await response.text();
    return parseEsvResponse(parseJsonBody(body));
  }

  throw new Error("ESV API error: 429 Too Many Requests (retries exhausted)");
}

export const getPassageText = action({
  args: {
    query: v.string(),
  },
  returns: esvChapterDataValue,
  handler: async (ctx, args) => {
    await requireActionIdentity(ctx);
    const apiKey = process.env.ESV_API_KEY;
    if (!apiKey)
      throw new Error(
        "ESV_API_KEY not configured in Convex environment variables",
      );
    return await fetchPassageText(apiKey, args.query);
  },
});

export const getChaptersTextBatch = action({
  args: {
    book: v.string(),
    chapters: v.array(v.number()),
  },
  returns: v.array(esvChapterResultValue),
  handler: async (ctx, args) => {
    await requireActionIdentity(ctx);
    const apiKey = process.env.ESV_API_KEY;
    if (!apiKey) {
      throw new Error(
        "ESV_API_KEY not configured in Convex environment variables",
      );
    }

    const uniqueChapters = Array.from(
      new Set(args.chapters.map((chapter) => Math.floor(chapter))),
    ).filter((chapter) => chapter > 0);

    const results: EsvChapterResult[] = [];
    for (const chapter of uniqueChapters) {
      const data = await fetchPassageText(apiKey, `${args.book} ${chapter}`);
      results.push({
        chapter,
        data,
      });
    }

    return results;
  },
});
