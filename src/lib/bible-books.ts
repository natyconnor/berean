export interface BookInfo {
  name: string;
  abbreviation: string;
  chapters: number;
  testament: "OT" | "NT";
}

export const BIBLE_BOOKS: BookInfo[] = [
  // Old Testament
  { name: "Genesis", abbreviation: "Gen", chapters: 50, testament: "OT" },
  { name: "Exodus", abbreviation: "Exod", chapters: 40, testament: "OT" },
  { name: "Leviticus", abbreviation: "Lev", chapters: 27, testament: "OT" },
  { name: "Numbers", abbreviation: "Num", chapters: 36, testament: "OT" },
  { name: "Deuteronomy", abbreviation: "Deut", chapters: 34, testament: "OT" },
  { name: "Joshua", abbreviation: "Josh", chapters: 24, testament: "OT" },
  { name: "Judges", abbreviation: "Judg", chapters: 21, testament: "OT" },
  { name: "Ruth", abbreviation: "Ruth", chapters: 4, testament: "OT" },
  { name: "1 Samuel", abbreviation: "1Sam", chapters: 31, testament: "OT" },
  { name: "2 Samuel", abbreviation: "2Sam", chapters: 24, testament: "OT" },
  { name: "1 Kings", abbreviation: "1Kgs", chapters: 22, testament: "OT" },
  { name: "2 Kings", abbreviation: "2Kgs", chapters: 25, testament: "OT" },
  { name: "1 Chronicles", abbreviation: "1Chr", chapters: 29, testament: "OT" },
  { name: "2 Chronicles", abbreviation: "2Chr", chapters: 36, testament: "OT" },
  { name: "Ezra", abbreviation: "Ezra", chapters: 10, testament: "OT" },
  { name: "Nehemiah", abbreviation: "Neh", chapters: 13, testament: "OT" },
  { name: "Esther", abbreviation: "Esth", chapters: 10, testament: "OT" },
  { name: "Job", abbreviation: "Job", chapters: 42, testament: "OT" },
  { name: "Psalms", abbreviation: "Ps", chapters: 150, testament: "OT" },
  { name: "Proverbs", abbreviation: "Prov", chapters: 31, testament: "OT" },
  { name: "Ecclesiastes", abbreviation: "Eccl", chapters: 12, testament: "OT" },
  {
    name: "Song of Solomon",
    abbreviation: "Song",
    chapters: 8,
    testament: "OT",
  },
  { name: "Isaiah", abbreviation: "Isa", chapters: 66, testament: "OT" },
  { name: "Jeremiah", abbreviation: "Jer", chapters: 52, testament: "OT" },
  { name: "Lamentations", abbreviation: "Lam", chapters: 5, testament: "OT" },
  { name: "Ezekiel", abbreviation: "Ezek", chapters: 48, testament: "OT" },
  { name: "Daniel", abbreviation: "Dan", chapters: 12, testament: "OT" },
  { name: "Hosea", abbreviation: "Hos", chapters: 14, testament: "OT" },
  { name: "Joel", abbreviation: "Joel", chapters: 3, testament: "OT" },
  { name: "Amos", abbreviation: "Amos", chapters: 9, testament: "OT" },
  { name: "Obadiah", abbreviation: "Obad", chapters: 1, testament: "OT" },
  { name: "Jonah", abbreviation: "Jonah", chapters: 4, testament: "OT" },
  { name: "Micah", abbreviation: "Mic", chapters: 7, testament: "OT" },
  { name: "Nahum", abbreviation: "Nah", chapters: 3, testament: "OT" },
  { name: "Habakkuk", abbreviation: "Hab", chapters: 3, testament: "OT" },
  { name: "Zephaniah", abbreviation: "Zeph", chapters: 3, testament: "OT" },
  { name: "Haggai", abbreviation: "Hag", chapters: 2, testament: "OT" },
  { name: "Zechariah", abbreviation: "Zech", chapters: 14, testament: "OT" },
  { name: "Malachi", abbreviation: "Mal", chapters: 4, testament: "OT" },

  // New Testament
  { name: "Matthew", abbreviation: "Matt", chapters: 28, testament: "NT" },
  { name: "Mark", abbreviation: "Mark", chapters: 16, testament: "NT" },
  { name: "Luke", abbreviation: "Luke", chapters: 24, testament: "NT" },
  { name: "John", abbreviation: "John", chapters: 21, testament: "NT" },
  { name: "Acts", abbreviation: "Acts", chapters: 28, testament: "NT" },
  { name: "Romans", abbreviation: "Rom", chapters: 16, testament: "NT" },
  {
    name: "1 Corinthians",
    abbreviation: "1Cor",
    chapters: 16,
    testament: "NT",
  },
  {
    name: "2 Corinthians",
    abbreviation: "2Cor",
    chapters: 13,
    testament: "NT",
  },
  { name: "Galatians", abbreviation: "Gal", chapters: 6, testament: "NT" },
  { name: "Ephesians", abbreviation: "Eph", chapters: 6, testament: "NT" },
  { name: "Philippians", abbreviation: "Phil", chapters: 4, testament: "NT" },
  { name: "Colossians", abbreviation: "Col", chapters: 4, testament: "NT" },
  {
    name: "1 Thessalonians",
    abbreviation: "1Thess",
    chapters: 5,
    testament: "NT",
  },
  {
    name: "2 Thessalonians",
    abbreviation: "2Thess",
    chapters: 3,
    testament: "NT",
  },
  { name: "1 Timothy", abbreviation: "1Tim", chapters: 6, testament: "NT" },
  { name: "2 Timothy", abbreviation: "2Tim", chapters: 4, testament: "NT" },
  { name: "Titus", abbreviation: "Titus", chapters: 3, testament: "NT" },
  { name: "Philemon", abbreviation: "Phlm", chapters: 1, testament: "NT" },
  { name: "Hebrews", abbreviation: "Heb", chapters: 13, testament: "NT" },
  { name: "James", abbreviation: "Jas", chapters: 5, testament: "NT" },
  { name: "1 Peter", abbreviation: "1Pet", chapters: 5, testament: "NT" },
  { name: "2 Peter", abbreviation: "2Pet", chapters: 3, testament: "NT" },
  { name: "1 John", abbreviation: "1John", chapters: 5, testament: "NT" },
  { name: "2 John", abbreviation: "2John", chapters: 1, testament: "NT" },
  { name: "3 John", abbreviation: "3John", chapters: 1, testament: "NT" },
  { name: "Jude", abbreviation: "Jude", chapters: 1, testament: "NT" },
  { name: "Revelation", abbreviation: "Rev", chapters: 22, testament: "NT" },
];

export const BOOK_BY_NAME = new Map(BIBLE_BOOKS.map((b) => [b.name, b]));

export function getBookInfo(name: string): BookInfo | undefined {
  return BOOK_BY_NAME.get(name);
}
