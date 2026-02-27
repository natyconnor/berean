"use node"
import { action } from "./_generated/server"
import { v } from "convex/values"

export const getPassageText = action({
  args: {
    query: v.string(),
  },
  handler: async (_ctx, args) => {
    const apiKey = process.env.ESV_API_KEY
    if (!apiKey) throw new Error("ESV_API_KEY not configured in Convex environment variables")

    const params = new URLSearchParams({
      q: args.query,
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
    })

    const response = await fetch(
      `https://api.esv.org/v3/passage/text/?${params}`,
      {
        headers: { Authorization: `Token ${apiKey}` },
      }
    )

    if (!response.ok) {
      throw new Error(`ESV API error: ${response.status} ${response.statusText}`)
    }

    return await response.json()
  },
})
