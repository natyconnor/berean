export interface LabChapterNote {
  id: string;
  content: string;
  tags: string[];
}

export interface LabVerseNote {
  verse: number;
  content: string;
}

export const LAB_BOOK = "John";
export const LAB_CHAPTER = 3;

export const LAB_VERSES: { number: number; text: string }[] = [
  {
    number: 1,
    text: "Now there was a man of the Pharisees named Nicodemus, a ruler of the Jews.",
  },
  {
    number: 2,
    text: "This man came to Jesus by night and said to him, “Rabbi, we know that you are a teacher come from God, for no one can do these signs that you do unless God is with him.”",
  },
  {
    number: 3,
    text: "Jesus answered him, “Truly, truly, I say to you, unless one is born again he cannot see the kingdom of God.”",
  },
  {
    number: 4,
    text: "Nicodemus said to him, “How can a man be born when he is old? Can he enter a second time into his mother’s womb and be born?”",
  },
  {
    number: 5,
    text: "Jesus answered, “Truly, truly, I say to you, unless one is born of water and the Spirit, he cannot enter the kingdom of God.”",
  },
  {
    number: 6,
    text: "That which is born of the flesh is flesh, and that which is born of the Spirit is spirit.",
  },
  {
    number: 7,
    text: "Do not marvel that I said to you, ‘You must be born again.’",
  },
  {
    number: 8,
    text: "The wind blows where it wishes, and you hear its sound, but you do not know where it comes from or where it goes. So it is with everyone who is born of the Spirit.”",
  },
  {
    number: 9,
    text: "Nicodemus said to him, “How can these things be?”",
  },
  {
    number: 10,
    text: "Jesus answered him, “Are you the teacher of Israel and yet you do not understand these things?",
  },
  {
    number: 11,
    text: "Truly, truly, I say to you, we speak of what we know, and bear witness to what we have seen, but you do not receive our testimony.",
  },
  {
    number: 12,
    text: "If I have told you earthly things and you do not believe, how can you believe if I tell you heavenly things?”",
  },
];

export const LAB_VERSE_NOTE: LabVerseNote = {
  verse: 3,
  content:
    "Born again — not moral reform, but a new beginning from above. Nicodemus hears it as biology; Jesus means Spirit.",
};

export const SEED_CHAPTER_NOTE: LabChapterNote = {
  id: "seed-chapter",
  content:
    "Whole-chapter read: night visit, new birth, and the Spirit. Keep the arc of Nicodemus in view — curiosity under cover of darkness.",
  tags: ["overview"],
};

export function createLabNoteId(): string {
  return `chapter-note-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}
