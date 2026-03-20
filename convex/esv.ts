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

  const response = await fetch(
    `https://api.esv.org/v3/passage/text/?${params}`,
    {
      headers: { Authorization: `Token ${apiKey}` },
    },
  );

  if (!response.ok) {
    throw new Error(`ESV API error: ${response.status} ${response.statusText}`);
  }

  const body = await response.text();
  return parseEsvResponse(parseJsonBody(body));
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
