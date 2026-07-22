import { v, type Infer } from "convex/values";

import { noteBodyValue } from "./noteContent";

export const verseRefSummaryValue = v.object({
  book: v.string(),
  chapter: v.number(),
  startVerse: v.number(),
  endVerse: v.number(),
});

export type VerseRefSummary = Infer<typeof verseRefSummaryValue>;

export const verseRefLinkValue = v.object({
  _id: v.id("verseRefs"),
  book: v.string(),
  chapter: v.number(),
  startVerse: v.number(),
  endVerse: v.number(),
});

export type VerseRefLink = Infer<typeof verseRefLinkValue>;

export const noteSummaryValue = v.object({
  _id: v.id("notes"),
  content: v.string(),
  body: v.optional(noteBodyValue),
  tags: v.array(v.string()),
  createdAt: v.number(),
  updatedAt: v.number(),
});

export type NoteSummary = Infer<typeof noteSummaryValue>;

export const chapterNoteEntryValue = v.object({
  verseRef: verseRefSummaryValue,
  notes: v.array(noteSummaryValue),
});

export type ChapterNoteEntry = Infer<typeof chapterNoteEntryValue>;

export const exportableLinkedNoteValue = v.object({
  noteId: v.id("notes"),
  content: v.string(),
  tags: v.array(v.string()),
  createdAt: v.number(),
  updatedAt: v.number(),
  verseRef: verseRefSummaryValue,
});

export type ExportableLinkedNote = Infer<typeof exportableLinkedNoteValue>;

export const esvVerseValue = v.object({
  number: v.number(),
  text: v.string(),
  heading: v.optional(v.string()),
});

export type EsvVerse = Infer<typeof esvVerseValue>;

export const esvChapterDataValue = v.object({
  canonical: v.string(),
  verses: v.array(esvVerseValue),
  copyright: v.string(),
});

export type EsvChapterData = Infer<typeof esvChapterDataValue>;

export const esvChapterResultValue = v.object({
  chapter: v.number(),
  data: esvChapterDataValue,
});

export type EsvChapterResult = Infer<typeof esvChapterResultValue>;

export const gospelParallelPassageValue = v.object({
  book: v.string(),
  chapter: v.number(),
  startVerse: v.number(),
  endVerse: v.number(),
});

export type GospelParallelPassage = Infer<typeof gospelParallelPassageValue>;

export const gospelParallelValue = v.object({
  _id: v.id("gospelParallels"),
  label: v.string(),
  passages: v.array(gospelParallelPassageValue),
});

export type GospelParallel = Infer<typeof gospelParallelValue>;
