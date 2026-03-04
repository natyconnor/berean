import { defineSchema, defineTable } from "convex/server"
import { v } from "convex/values"
import { authTables } from "@convex-dev/auth/server"

export default defineSchema({
  ...authTables,

  notes: defineTable({
    userId: v.optional(v.id("users")),
    content: v.string(),
    tags: v.array(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_createdAt", ["createdAt"])
    .index("by_updatedAt", ["updatedAt"])
    .searchIndex("search_content", {
      searchField: "content",
      filterFields: ["tags", "userId"],
    }),

  userTags: defineTable({
    userId: v.id("users"),
    tag: v.string(),
    label: v.string(),
    source: v.union(v.literal("custom"), v.literal("starter")),
    createdAt: v.number(),
    updatedAt: v.number(),
    lastUsedAt: v.optional(v.number()),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_tag", ["userId", "tag"])
    .index("by_userId_updatedAt", ["userId", "updatedAt"]),

  userSettings: defineTable({
    userId: v.id("users"),
    starterTagsSetupCompletedAt: v.optional(v.number()),
    starterTagCategoryColors: v.optional(v.record(v.string(), v.string())),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_updatedAt", ["userId", "updatedAt"]),

  verseRefs: defineTable({
    userId: v.optional(v.id("users")),
    book: v.string(),
    chapter: v.number(),
    startVerse: v.number(),
    endVerse: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_book_chapter", ["book", "chapter"])
    .index("by_userId_book_chapter", ["userId", "book", "chapter"])
    .index("by_book_chapter_verses", [
      "book",
      "chapter",
      "startVerse",
      "endVerse",
    ])
    .index("by_userId_book_chapter_verses", [
      "userId",
      "book",
      "chapter",
      "startVerse",
      "endVerse",
    ]),

  noteVerseLinks: defineTable({
    userId: v.optional(v.id("users")),
    noteId: v.id("notes"),
    verseRefId: v.id("verseRefs"),
  })
    .index("by_userId", ["userId"])
    .index("by_noteId", ["noteId"])
    .index("by_verseRefId", ["verseRefId"])
    .index("by_noteId_verseRefId", ["noteId", "verseRefId"]),

  verseLinks: defineTable({
    userId: v.optional(v.id("users")),
    verseRefId1: v.id("verseRefs"),
    verseRefId2: v.id("verseRefs"),
  })
    .index("by_userId", ["userId"])
    .index("by_verseRefId1", ["verseRefId1"])
    .index("by_verseRefId2", ["verseRefId2"])
    .index("by_userId_verseRefId1", ["userId", "verseRefId1"]),

  gospelParallels: defineTable({
    label: v.string(),
    passages: v.array(
      v.object({
        book: v.string(),
        chapter: v.number(),
        startVerse: v.number(),
        endVerse: v.number(),
      })
    ),
  }).index("by_label", ["label"]),
})
