import { getChapterVerseCount } from "../src/lib/bible-verse-counts";
import { packAllowsPassageMode } from "../src/lib/passage-eligibility";
import type { FullScope } from "../src/lib/scope-equality";

/**
 * Curated memory presets. Add another pack by appending to this module.
 * References only — verse text is loaded from the ESV at read time.
 * A letter suffix in a source citation (3a, 6b) is stored as the whole verse.
 */

export interface PresetPassage {
  id: string;
  book: string;
  chapter: number;
  startVerse: number;
  endVerse: number;
}

export type ChapterPresetGroup = "Psalms" | "Prophets" | "Gospels" | "Letters";

export const CHAPTER_PRESET_GROUPS: readonly ChapterPresetGroup[] = [
  "Psalms",
  "Prophets",
  "Gospels",
  "Letters",
];

export interface CollectionPreset {
  kind: "collection";
  id: string;
  title: string;
  description: string;
  passages: readonly PresetPassage[];
}

export interface ChapterPreset {
  kind: "chapter";
  id: string;
  title: string;
  book: string;
  startChapter: number;
  endChapter: number;
  group: ChapterPresetGroup;
}

export type MemoryPreset = CollectionPreset | ChapterPreset;

const HUNDRED_VERSES_PASSAGES: readonly PresetPassage[] = [
  {
    id: "exodus-19-4-6",
    book: "Exodus",
    chapter: 19,
    startVerse: 4,
    endVerse: 6,
  },
  {
    id: "deuteronomy-6-4-5",
    book: "Deuteronomy",
    chapter: 6,
    startVerse: 4,
    endVerse: 5,
  },
  {
    id: "joshua-1-7-9",
    book: "Joshua",
    chapter: 1,
    startVerse: 7,
    endVerse: 9,
  },
  {
    id: "1-samuel-12-23",
    book: "1 Samuel",
    chapter: 12,
    startVerse: 23,
    endVerse: 23,
  },
  {
    id: "1-samuel-15-22",
    book: "1 Samuel",
    chapter: 15,
    startVerse: 22,
    endVerse: 22,
  },
  {
    id: "2-chronicles-7-14",
    book: "2 Chronicles",
    chapter: 7,
    startVerse: 14,
    endVerse: 14,
  },
  {
    id: "2-chronicles-16-9",
    book: "2 Chronicles",
    chapter: 16,
    startVerse: 9,
    endVerse: 9,
  },
  {
    id: "job-19-25-27",
    book: "Job",
    chapter: 19,
    startVerse: 25,
    endVerse: 27,
  },
  { id: "job-42-5-6", book: "Job", chapter: 42, startVerse: 5, endVerse: 6 },
  {
    id: "psalms-16-2-3",
    book: "Psalms",
    chapter: 16,
    startVerse: 2,
    endVerse: 3,
  },
  {
    id: "psalms-34-8-9",
    book: "Psalms",
    chapter: 34,
    startVerse: 8,
    endVerse: 9,
  },
  {
    id: "psalms-37-4-7",
    book: "Psalms",
    chapter: 37,
    startVerse: 4,
    endVerse: 7,
  },
  {
    id: "psalms-46-10",
    book: "Psalms",
    chapter: 46,
    startVerse: 10,
    endVerse: 10,
  },
  {
    id: "psalms-51-10-12",
    book: "Psalms",
    chapter: 51,
    startVerse: 10,
    endVerse: 12,
  },
  {
    id: "psalms-84-10",
    book: "Psalms",
    chapter: 84,
    startVerse: 10,
    endVerse: 10,
  },
  {
    id: "psalms-103-8-12",
    book: "Psalms",
    chapter: 103,
    startVerse: 8,
    endVerse: 12,
  },
  {
    id: "psalms-119-11",
    book: "Psalms",
    chapter: 119,
    startVerse: 11,
    endVerse: 11,
  },
  {
    id: "psalms-119-105",
    book: "Psalms",
    chapter: 119,
    startVerse: 105,
    endVerse: 105,
  },
  {
    id: "proverbs-3-5-6",
    book: "Proverbs",
    chapter: 3,
    startVerse: 5,
    endVerse: 6,
  },
  {
    id: "isaiah-1-18",
    book: "Isaiah",
    chapter: 1,
    startVerse: 18,
    endVerse: 18,
  },
  {
    id: "isaiah-40-6-8",
    book: "Isaiah",
    chapter: 40,
    startVerse: 6,
    endVerse: 8,
  },
  {
    id: "isaiah-40-28-31",
    book: "Isaiah",
    chapter: 40,
    startVerse: 28,
    endVerse: 31,
  },
  {
    id: "isaiah-54-2-3",
    book: "Isaiah",
    chapter: 54,
    startVerse: 2,
    endVerse: 3,
  },
  {
    id: "isaiah-55-1-3",
    book: "Isaiah",
    chapter: 55,
    startVerse: 1,
    endVerse: 3,
  },
  {
    id: "isaiah-55-8-9",
    book: "Isaiah",
    chapter: 55,
    startVerse: 8,
    endVerse: 9,
  },
  {
    id: "isaiah-57-15",
    book: "Isaiah",
    chapter: 57,
    startVerse: 15,
    endVerse: 15,
  },
  {
    id: "isaiah-66-1-2",
    book: "Isaiah",
    chapter: 66,
    startVerse: 1,
    endVerse: 2,
  },
  {
    id: "jeremiah-9-23-24",
    book: "Jeremiah",
    chapter: 9,
    startVerse: 23,
    endVerse: 24,
  },
  {
    id: "jeremiah-29-11-13",
    book: "Jeremiah",
    chapter: 29,
    startVerse: 11,
    endVerse: 13,
  },
  {
    id: "jeremiah-33-3",
    book: "Jeremiah",
    chapter: 33,
    startVerse: 3,
    endVerse: 3,
  },
  {
    id: "lamentations-3-21-23",
    book: "Lamentations",
    chapter: 3,
    startVerse: 21,
    endVerse: 23,
  },
  { id: "joel-2-13", book: "Joel", chapter: 2, startVerse: 13, endVerse: 13 },
  { id: "micah-6-8", book: "Micah", chapter: 6, startVerse: 8, endVerse: 8 },
  {
    id: "habakkuk-3-17-18",
    book: "Habakkuk",
    chapter: 3,
    startVerse: 17,
    endVerse: 18,
  },
  {
    id: "zephaniah-3-17",
    book: "Zephaniah",
    chapter: 3,
    startVerse: 17,
    endVerse: 17,
  },
  {
    id: "zechariah-4-6",
    book: "Zechariah",
    chapter: 4,
    startVerse: 6,
    endVerse: 6,
  },
  {
    id: "malachi-3-10",
    book: "Malachi",
    chapter: 3,
    startVerse: 10,
    endVerse: 10,
  },
  {
    id: "matthew-6-19-21",
    book: "Matthew",
    chapter: 6,
    startVerse: 19,
    endVerse: 21,
  },
  {
    id: "matthew-6-24",
    book: "Matthew",
    chapter: 6,
    startVerse: 24,
    endVerse: 24,
  },
  {
    id: "matthew-6-33-34",
    book: "Matthew",
    chapter: 6,
    startVerse: 33,
    endVerse: 34,
  },
  {
    id: "matthew-7-7-8",
    book: "Matthew",
    chapter: 7,
    startVerse: 7,
    endVerse: 8,
  },
  {
    id: "matthew-7-13-14",
    book: "Matthew",
    chapter: 7,
    startVerse: 13,
    endVerse: 14,
  },
  {
    id: "matthew-11-28-29",
    book: "Matthew",
    chapter: 11,
    startVerse: 28,
    endVerse: 29,
  },
  {
    id: "matthew-22-37-39",
    book: "Matthew",
    chapter: 22,
    startVerse: 37,
    endVerse: 39,
  },
  {
    id: "matthew-28-18-20",
    book: "Matthew",
    chapter: 28,
    startVerse: 18,
    endVerse: 20,
  },
  {
    id: "mark-10-43-45",
    book: "Mark",
    chapter: 10,
    startVerse: 43,
    endVerse: 45,
  },
  { id: "luke-9-23", book: "Luke", chapter: 9, startVerse: 23, endVerse: 23 },
  {
    id: "luke-9-24-25",
    book: "Luke",
    chapter: 9,
    startVerse: 24,
    endVerse: 25,
  },
  { id: "luke-10-20", book: "Luke", chapter: 10, startVerse: 20, endVerse: 20 },
  { id: "luke-11-13", book: "Luke", chapter: 11, startVerse: 13, endVerse: 13 },
  { id: "luke-12-32", book: "Luke", chapter: 12, startVerse: 32, endVerse: 32 },
  { id: "luke-12-48", book: "Luke", chapter: 12, startVerse: 48, endVerse: 48 },
  { id: "luke-14-26", book: "Luke", chapter: 14, startVerse: 26, endVerse: 26 },
  { id: "luke-17-10", book: "Luke", chapter: 17, startVerse: 10, endVerse: 10 },
  { id: "john-1-12", book: "John", chapter: 1, startVerse: 12, endVerse: 12 },
  { id: "john-1-14", book: "John", chapter: 1, startVerse: 14, endVerse: 14 },
  { id: "john-3-16", book: "John", chapter: 3, startVerse: 16, endVerse: 16 },
  { id: "john-5-44", book: "John", chapter: 5, startVerse: 44, endVerse: 44 },
  {
    id: "john-6-68-69",
    book: "John",
    chapter: 6,
    startVerse: 68,
    endVerse: 69,
  },
  {
    id: "john-8-31-32",
    book: "John",
    chapter: 8,
    startVerse: 31,
    endVerse: 32,
  },
  {
    id: "john-10-10-11",
    book: "John",
    chapter: 10,
    startVerse: 10,
    endVerse: 11,
  },
  {
    id: "john-10-27-30",
    book: "John",
    chapter: 10,
    startVerse: 27,
    endVerse: 30,
  },
  {
    id: "john-12-24-25",
    book: "John",
    chapter: 12,
    startVerse: 24,
    endVerse: 25,
  },
  {
    id: "john-13-34-35",
    book: "John",
    chapter: 13,
    startVerse: 34,
    endVerse: 35,
  },
  { id: "john-14-1-3", book: "John", chapter: 14, startVerse: 1, endVerse: 3 },
  { id: "john-14-6", book: "John", chapter: 14, startVerse: 6, endVerse: 6 },
  { id: "john-14-27", book: "John", chapter: 14, startVerse: 27, endVerse: 27 },
  { id: "john-15-5", book: "John", chapter: 15, startVerse: 5, endVerse: 5 },
  { id: "john-16-33", book: "John", chapter: 16, startVerse: 33, endVerse: 33 },
  { id: "acts-1-8", book: "Acts", chapter: 1, startVerse: 8, endVerse: 8 },
  {
    id: "acts-3-19-20",
    book: "Acts",
    chapter: 3,
    startVerse: 19,
    endVerse: 20,
  },
  { id: "acts-4-12", book: "Acts", chapter: 4, startVerse: 12, endVerse: 12 },
  { id: "acts-20-24", book: "Acts", chapter: 20, startVerse: 24, endVerse: 24 },
  {
    id: "romans-1-16",
    book: "Romans",
    chapter: 1,
    startVerse: 16,
    endVerse: 16,
  },
  { id: "romans-2-4", book: "Romans", chapter: 2, startVerse: 4, endVerse: 4 },
  {
    id: "romans-3-23",
    book: "Romans",
    chapter: 3,
    startVerse: 23,
    endVerse: 23,
  },
  {
    id: "romans-5-6-10",
    book: "Romans",
    chapter: 5,
    startVerse: 6,
    endVerse: 10,
  },
  {
    id: "romans-6-12-13",
    book: "Romans",
    chapter: 6,
    startVerse: 12,
    endVerse: 13,
  },
  {
    id: "romans-6-23",
    book: "Romans",
    chapter: 6,
    startVerse: 23,
    endVerse: 23,
  },
  {
    id: "romans-8-1-2",
    book: "Romans",
    chapter: 8,
    startVerse: 1,
    endVerse: 2,
  },
  {
    id: "romans-8-15-16",
    book: "Romans",
    chapter: 8,
    startVerse: 15,
    endVerse: 16,
  },
  {
    id: "romans-8-28",
    book: "Romans",
    chapter: 8,
    startVerse: 28,
    endVerse: 28,
  },
  {
    id: "romans-8-37-39",
    book: "Romans",
    chapter: 8,
    startVerse: 37,
    endVerse: 39,
  },
  {
    id: "romans-10-9-10",
    book: "Romans",
    chapter: 10,
    startVerse: 9,
    endVerse: 10,
  },
  {
    id: "romans-12-1-2",
    book: "Romans",
    chapter: 12,
    startVerse: 1,
    endVerse: 2,
  },
  {
    id: "romans-13-8",
    book: "Romans",
    chapter: 13,
    startVerse: 8,
    endVerse: 8,
  },
  {
    id: "romans-14-8",
    book: "Romans",
    chapter: 14,
    startVerse: 8,
    endVerse: 8,
  },
  {
    id: "1-corinthians-1-18",
    book: "1 Corinthians",
    chapter: 1,
    startVerse: 18,
    endVerse: 18,
  },
  {
    id: "1-corinthians-2-2",
    book: "1 Corinthians",
    chapter: 2,
    startVerse: 2,
    endVerse: 2,
  },
  {
    id: "1-corinthians-2-14",
    book: "1 Corinthians",
    chapter: 2,
    startVerse: 14,
    endVerse: 14,
  },
  {
    id: "1-corinthians-6-19-20",
    book: "1 Corinthians",
    chapter: 6,
    startVerse: 19,
    endVerse: 20,
  },
  {
    id: "1-corinthians-9-22",
    book: "1 Corinthians",
    chapter: 9,
    startVerse: 22,
    endVerse: 22,
  },
  {
    id: "1-corinthians-9-26-27",
    book: "1 Corinthians",
    chapter: 9,
    startVerse: 26,
    endVerse: 27,
  },
  {
    id: "1-corinthians-10-13",
    book: "1 Corinthians",
    chapter: 10,
    startVerse: 13,
    endVerse: 13,
  },
  {
    id: "1-corinthians-12-18",
    book: "1 Corinthians",
    chapter: 12,
    startVerse: 18,
    endVerse: 18,
  },
  {
    id: "1-corinthians-13-13",
    book: "1 Corinthians",
    chapter: 13,
    startVerse: 13,
    endVerse: 13,
  },
  {
    id: "1-corinthians-15-58",
    book: "1 Corinthians",
    chapter: 15,
    startVerse: 58,
    endVerse: 58,
  },
  {
    id: "2-corinthians-3-5",
    book: "2 Corinthians",
    chapter: 3,
    startVerse: 5,
    endVerse: 5,
  },
  {
    id: "2-corinthians-3-17",
    book: "2 Corinthians",
    chapter: 3,
    startVerse: 17,
    endVerse: 17,
  },
  {
    id: "2-corinthians-4-4",
    book: "2 Corinthians",
    chapter: 4,
    startVerse: 4,
    endVerse: 4,
  },
  {
    id: "2-corinthians-4-7",
    book: "2 Corinthians",
    chapter: 4,
    startVerse: 7,
    endVerse: 7,
  },
  {
    id: "2-corinthians-4-16-18",
    book: "2 Corinthians",
    chapter: 4,
    startVerse: 16,
    endVerse: 18,
  },
  {
    id: "2-corinthians-5-7",
    book: "2 Corinthians",
    chapter: 5,
    startVerse: 7,
    endVerse: 7,
  },
  {
    id: "2-corinthians-5-14",
    book: "2 Corinthians",
    chapter: 5,
    startVerse: 14,
    endVerse: 14,
  },
  {
    id: "2-corinthians-5-17",
    book: "2 Corinthians",
    chapter: 5,
    startVerse: 17,
    endVerse: 17,
  },
  {
    id: "2-corinthians-6-14",
    book: "2 Corinthians",
    chapter: 6,
    startVerse: 14,
    endVerse: 14,
  },
  {
    id: "2-corinthians-7-10",
    book: "2 Corinthians",
    chapter: 7,
    startVerse: 10,
    endVerse: 10,
  },
  {
    id: "2-corinthians-9-7",
    book: "2 Corinthians",
    chapter: 9,
    startVerse: 7,
    endVerse: 7,
  },
  {
    id: "2-corinthians-11-14",
    book: "2 Corinthians",
    chapter: 11,
    startVerse: 14,
    endVerse: 14,
  },
  {
    id: "2-corinthians-12-9-10",
    book: "2 Corinthians",
    chapter: 12,
    startVerse: 9,
    endVerse: 10,
  },
  {
    id: "galatians-1-10",
    book: "Galatians",
    chapter: 1,
    startVerse: 10,
    endVerse: 10,
  },
  {
    id: "galatians-2-20",
    book: "Galatians",
    chapter: 2,
    startVerse: 20,
    endVerse: 20,
  },
  {
    id: "galatians-5-16-17",
    book: "Galatians",
    chapter: 5,
    startVerse: 16,
    endVerse: 17,
  },
  {
    id: "galatians-5-22-23",
    book: "Galatians",
    chapter: 5,
    startVerse: 22,
    endVerse: 23,
  },
  {
    id: "galatians-6-2",
    book: "Galatians",
    chapter: 6,
    startVerse: 2,
    endVerse: 2,
  },
  {
    id: "galatians-6-7-9",
    book: "Galatians",
    chapter: 6,
    startVerse: 7,
    endVerse: 9,
  },
  {
    id: "galatians-6-14",
    book: "Galatians",
    chapter: 6,
    startVerse: 14,
    endVerse: 14,
  },
  {
    id: "ephesians-1-3",
    book: "Ephesians",
    chapter: 1,
    startVerse: 3,
    endVerse: 3,
  },
  {
    id: "ephesians-2-8-10",
    book: "Ephesians",
    chapter: 2,
    startVerse: 8,
    endVerse: 10,
  },
  {
    id: "ephesians-2-14",
    book: "Ephesians",
    chapter: 2,
    startVerse: 14,
    endVerse: 14,
  },
  {
    id: "ephesians-3-16-21",
    book: "Ephesians",
    chapter: 3,
    startVerse: 16,
    endVerse: 21,
  },
  {
    id: "ephesians-4-11-12",
    book: "Ephesians",
    chapter: 4,
    startVerse: 11,
    endVerse: 12,
  },
  {
    id: "ephesians-4-22-24",
    book: "Ephesians",
    chapter: 4,
    startVerse: 22,
    endVerse: 24,
  },
  {
    id: "ephesians-5-1-2",
    book: "Ephesians",
    chapter: 5,
    startVerse: 1,
    endVerse: 2,
  },
  {
    id: "ephesians-5-11",
    book: "Ephesians",
    chapter: 5,
    startVerse: 11,
    endVerse: 11,
  },
  {
    id: "ephesians-5-15-16",
    book: "Ephesians",
    chapter: 5,
    startVerse: 15,
    endVerse: 16,
  },
  {
    id: "ephesians-6-10-12",
    book: "Ephesians",
    chapter: 6,
    startVerse: 10,
    endVerse: 12,
  },
  {
    id: "philippians-1-6",
    book: "Philippians",
    chapter: 1,
    startVerse: 6,
    endVerse: 6,
  },
  {
    id: "philippians-1-21",
    book: "Philippians",
    chapter: 1,
    startVerse: 21,
    endVerse: 21,
  },
  {
    id: "philippians-2-1-11",
    book: "Philippians",
    chapter: 2,
    startVerse: 1,
    endVerse: 11,
  },
  {
    id: "philippians-2-13",
    book: "Philippians",
    chapter: 2,
    startVerse: 13,
    endVerse: 13,
  },
  {
    id: "philippians-3-7-8",
    book: "Philippians",
    chapter: 3,
    startVerse: 7,
    endVerse: 8,
  },
  {
    id: "philippians-3-13-14",
    book: "Philippians",
    chapter: 3,
    startVerse: 13,
    endVerse: 14,
  },
  {
    id: "philippians-4-6-7",
    book: "Philippians",
    chapter: 4,
    startVerse: 6,
    endVerse: 7,
  },
  {
    id: "philippians-4-8",
    book: "Philippians",
    chapter: 4,
    startVerse: 8,
    endVerse: 8,
  },
  {
    id: "philippians-4-19",
    book: "Philippians",
    chapter: 4,
    startVerse: 19,
    endVerse: 19,
  },
  {
    id: "colossians-3-1-2",
    book: "Colossians",
    chapter: 3,
    startVerse: 1,
    endVerse: 2,
  },
  {
    id: "1-thessalonians-5-16-18",
    book: "1 Thessalonians",
    chapter: 5,
    startVerse: 16,
    endVerse: 18,
  },
  {
    id: "1-timothy-6-6-8",
    book: "1 Timothy",
    chapter: 6,
    startVerse: 6,
    endVerse: 8,
  },
  {
    id: "2-timothy-1-7",
    book: "2 Timothy",
    chapter: 1,
    startVerse: 7,
    endVerse: 7,
  },
  {
    id: "2-timothy-1-12",
    book: "2 Timothy",
    chapter: 1,
    startVerse: 12,
    endVerse: 12,
  },
  {
    id: "2-timothy-2-3-4",
    book: "2 Timothy",
    chapter: 2,
    startVerse: 3,
    endVerse: 4,
  },
  {
    id: "2-timothy-2-21",
    book: "2 Timothy",
    chapter: 2,
    startVerse: 21,
    endVerse: 21,
  },
  {
    id: "2-timothy-3-16-17",
    book: "2 Timothy",
    chapter: 3,
    startVerse: 16,
    endVerse: 17,
  },
  {
    id: "2-timothy-4-6-8",
    book: "2 Timothy",
    chapter: 4,
    startVerse: 6,
    endVerse: 8,
  },
  {
    id: "hebrews-4-12",
    book: "Hebrews",
    chapter: 4,
    startVerse: 12,
    endVerse: 12,
  },
  {
    id: "hebrews-4-15-16",
    book: "Hebrews",
    chapter: 4,
    startVerse: 15,
    endVerse: 16,
  },
  {
    id: "hebrews-10-23-25",
    book: "Hebrews",
    chapter: 10,
    startVerse: 23,
    endVerse: 25,
  },
  {
    id: "hebrews-11-1",
    book: "Hebrews",
    chapter: 11,
    startVerse: 1,
    endVerse: 1,
  },
  {
    id: "hebrews-11-6",
    book: "Hebrews",
    chapter: 11,
    startVerse: 6,
    endVerse: 6,
  },
  {
    id: "hebrews-12-1-2",
    book: "Hebrews",
    chapter: 12,
    startVerse: 1,
    endVerse: 2,
  },
  {
    id: "hebrews-12-4",
    book: "Hebrews",
    chapter: 12,
    startVerse: 4,
    endVerse: 4,
  },
  {
    id: "hebrews-12-11",
    book: "Hebrews",
    chapter: 12,
    startVerse: 11,
    endVerse: 11,
  },
  { id: "james-4-7", book: "James", chapter: 4, startVerse: 7, endVerse: 7 },
  {
    id: "1-peter-1-18-19",
    book: "1 Peter",
    chapter: 1,
    startVerse: 18,
    endVerse: 19,
  },
  {
    id: "1-peter-2-9",
    book: "1 Peter",
    chapter: 2,
    startVerse: 9,
    endVerse: 9,
  },
  {
    id: "1-peter-2-11-12",
    book: "1 Peter",
    chapter: 2,
    startVerse: 11,
    endVerse: 12,
  },
  {
    id: "1-peter-2-21",
    book: "1 Peter",
    chapter: 2,
    startVerse: 21,
    endVerse: 21,
  },
  {
    id: "1-peter-3-15-16",
    book: "1 Peter",
    chapter: 3,
    startVerse: 15,
    endVerse: 16,
  },
  {
    id: "1-peter-4-7-8",
    book: "1 Peter",
    chapter: 4,
    startVerse: 7,
    endVerse: 8,
  },
  {
    id: "1-peter-4-10",
    book: "1 Peter",
    chapter: 4,
    startVerse: 10,
    endVerse: 10,
  },
  {
    id: "1-peter-5-6-7",
    book: "1 Peter",
    chapter: 5,
    startVerse: 6,
    endVerse: 7,
  },
  {
    id: "1-peter-5-8-9",
    book: "1 Peter",
    chapter: 5,
    startVerse: 8,
    endVerse: 9,
  },
  {
    id: "2-peter-3-8-9",
    book: "2 Peter",
    chapter: 3,
    startVerse: 8,
    endVerse: 9,
  },
  { id: "1-john-1-9", book: "1 John", chapter: 1, startVerse: 9, endVerse: 9 },
  {
    id: "1-john-2-15-16",
    book: "1 John",
    chapter: 2,
    startVerse: 15,
    endVerse: 16,
  },
  {
    id: "1-john-3-16",
    book: "1 John",
    chapter: 3,
    startVerse: 16,
    endVerse: 16,
  },
  { id: "1-john-4-4", book: "1 John", chapter: 4, startVerse: 4, endVerse: 4 },
  {
    id: "1-john-4-17-19",
    book: "1 John",
    chapter: 4,
    startVerse: 17,
    endVerse: 19,
  },
  { id: "1-john-5-3", book: "1 John", chapter: 5, startVerse: 3, endVerse: 3 },
  {
    id: "1-john-5-13-15",
    book: "1 John",
    chapter: 5,
    startVerse: 13,
    endVerse: 15,
  },
  {
    id: "revelation-3-20",
    book: "Revelation",
    chapter: 3,
    startVerse: 20,
    endVerse: 20,
  },
];

export const HUNDRED_VERSES_PRESET_ID =
  "100-verses-every-christian-should-know";

const hundredVerses: CollectionPreset = {
  kind: "collection",
  id: HUNDRED_VERSES_PRESET_ID,
  title: "100 Verses Every Christian Should Know",
  description:
    "An ordered set of passages to memorize one span at a time. Start the whole list, or pick the ones you want.",
  passages: HUNDRED_VERSES_PASSAGES,
};

function chapter(
  id: string,
  book: string,
  chapterNumber: number,
  group: ChapterPresetGroup,
  title?: string,
): ChapterPreset {
  const display = book === "Psalms" ? "Psalm" : book;
  return {
    kind: "chapter",
    id,
    title: title ?? `${display} ${chapterNumber}`,
    book,
    startChapter: chapterNumber,
    endChapter: chapterNumber,
    group,
  };
}

const CHAPTER_PRESETS: readonly ChapterPreset[] = [
  chapter("psalm-1", "Psalms", 1, "Psalms"),
  chapter("psalm-8", "Psalms", 8, "Psalms"),
  chapter("psalm-16", "Psalms", 16, "Psalms"),
  chapter("psalm-23", "Psalms", 23, "Psalms"),
  chapter("psalm-32", "Psalms", 32, "Psalms"),
  chapter("psalm-51", "Psalms", 51, "Psalms"),
  chapter("psalm-73", "Psalms", 73, "Psalms"),
  chapter("psalm-139", "Psalms", 139, "Psalms"),
  chapter("isaiah-40", "Isaiah", 40, "Prophets"),
  {
    kind: "chapter",
    id: "matthew-5-7",
    title: "Sermon on the Mount",
    book: "Matthew",
    startChapter: 5,
    endChapter: 7,
    group: "Gospels",
  },
  chapter("matthew-5", "Matthew", 5, "Gospels"),
  chapter("matthew-6", "Matthew", 6, "Gospels"),
  chapter("matthew-7", "Matthew", 7, "Gospels"),
  chapter("john-15", "John", 15, "Gospels"),
  chapter("romans-8", "Romans", 8, "Letters"),
  chapter("romans-12", "Romans", 12, "Letters"),
  chapter("1-corinthians-13", "1 Corinthians", 13, "Letters"),
  chapter("2-corinthians-4", "2 Corinthians", 4, "Letters"),
  chapter("2-timothy-1", "2 Timothy", 1, "Letters"),
  chapter("2-timothy-2", "2 Timothy", 2, "Letters"),
  chapter("2-timothy-3", "2 Timothy", 3, "Letters"),
  chapter("2-timothy-4", "2 Timothy", 4, "Letters"),
  chapter("philippians-2", "Philippians", 2, "Letters"),
  chapter("philippians-3", "Philippians", 3, "Letters"),
  chapter("philippians-4", "Philippians", 4, "Letters"),
  chapter("hebrews-11", "Hebrews", 11, "Letters"),
];

export const MEMORY_PRESETS: readonly MemoryPreset[] = [
  hundredVerses,
  ...CHAPTER_PRESETS,
];

export function collectionPresets(): CollectionPreset[] {
  return MEMORY_PRESETS.filter((preset) => preset.kind === "collection");
}

export function chapterPresets(): ChapterPreset[] {
  return MEMORY_PRESETS.filter((preset) => preset.kind === "chapter");
}

export function getMemoryPreset(id: string): MemoryPreset | undefined {
  return MEMORY_PRESETS.find((preset) => preset.id === id);
}

export function displayPresetBook(book: string): string {
  return book === "Psalms" ? "Psalm" : book;
}

export function formatPresetPassage(passage: PresetPassage): string {
  const book = displayPresetBook(passage.book);
  if (passage.startVerse === passage.endVerse) {
    return `${book} ${passage.chapter}:${passage.startVerse}`;
  }
  return `${book} ${passage.chapter}:${passage.startVerse}-${passage.endVerse}`;
}

export function formatChapterRange(preset: ChapterPreset): string {
  const book = displayPresetBook(preset.book);
  if (preset.startChapter === preset.endChapter) {
    return `${book} ${preset.startChapter}`;
  }
  return `${book} ${preset.startChapter}\u2013${preset.endChapter}`;
}

export function chapterPresetScope(preset: ChapterPreset): FullScope {
  return {
    books: [preset.book],
    chapterRanges: [
      {
        book: preset.book,
        startChapter: preset.startChapter,
        endChapter: preset.endChapter,
      },
    ],
    tags: [],
    tagMatchMode: "any",
  };
}

export function chapterPresetVerseCount(preset: ChapterPreset): number {
  let total = 0;
  for (
    let chapterNumber = preset.startChapter;
    chapterNumber <= preset.endChapter;
    chapterNumber++
  ) {
    total += getChapterVerseCount(preset.book, chapterNumber) ?? 0;
  }
  return total;
}

/**
 * Passages to put in a pack. Omitting ids, or naming every passage, means the
 * whole collection (catalog order). A proper subset stays in catalog order.
 */
export function passagesForCollectionStart(
  preset: CollectionPreset,
  passageIds: readonly string[] | undefined,
): { passages: PresetPassage[]; full: boolean } {
  if (!passageIds || passageIds.length === 0) {
    return { passages: [...preset.passages], full: true };
  }
  const wanted = new Set(passageIds);
  const unknown = passageIds.filter(
    (id) => !preset.passages.some((passage) => passage.id === id),
  );
  if (unknown.length > 0) {
    throw new Error("Unknown passage in this preset");
  }
  const passages = preset.passages.filter((passage) => wanted.has(passage.id));
  return {
    passages,
    full: passages.length === preset.passages.length,
  };
}

export function assertPresetCatalogValid(): void {
  const ids = new Set<string>();
  for (const preset of MEMORY_PRESETS) {
    if (ids.has(preset.id)) {
      throw new Error(`Duplicate preset id ${preset.id}`);
    }
    ids.add(preset.id);
    if (preset.kind === "chapter") {
      if (!packAllowsPassageMode(chapterPresetScope(preset))) {
        throw new Error(`${preset.id} is not eligible for passage mode`);
      }
      if (chapterPresetVerseCount(preset) < 1) {
        throw new Error(`${preset.id} has no verses`);
      }
    } else {
      const passageIds = new Set<string>();
      for (const passage of preset.passages) {
        if (passageIds.has(passage.id)) {
          throw new Error(`Duplicate passage id ${passage.id}`);
        }
        passageIds.add(passage.id);
      }
    }
  }
}
