import { describe, expect, it } from "vitest";
import {
  parseEsvResponse,
  parsePassageIntoVerses,
  sliceEsvChapterToVerseRange,
} from "../../shared/esv-api";

describe("sliceEsvChapterToVerseRange", () => {
  const chapter = {
    canonical: "John 3",
    copyright: "(c)",
    verses: [
      { number: 15, text: "v15" },
      { number: 16, text: "v16", heading: "For God So Loved the World" },
      { number: 17, text: "v17" },
      { number: 18, text: "v18" },
      { number: 19, text: "v19" },
    ],
  };

  it("returns verses inclusive of start and end", () => {
    const sliced = sliceEsvChapterToVerseRange(chapter, 16, 18);
    expect(sliced.verses.map((v) => v.number)).toEqual([16, 17, 18]);
    expect(sliced.verses[0]?.heading).toBe("For God So Loved the World");
    expect(sliced.canonical).toBe(chapter.canonical);
    expect(sliced.copyright).toBe(chapter.copyright);
  });

  it("handles reversed start/end", () => {
    const sliced = sliceEsvChapterToVerseRange(chapter, 18, 16);
    expect(sliced.verses.map((v) => v.number)).toEqual([16, 17, 18]);
  });
});

/** The rule of underscores the ESV API prints above every section heading. */
const RULE = "_".repeat(55);

describe("parsePassageIntoVerses", () => {
  it("attaches section headings to the following verse", () => {
    const text = `${RULE}
The Sermon on the Mount

  [1] Seeing the crowds, he went up on the mountain.

${RULE}
The Beatitudes

  [2] And he opened his mouth and taught them, saying:

  [3] “Blessed are the poor in spirit.

${RULE}
Salt and Light

  [13] “You are the salt of the earth.
`;

    const verses = parsePassageIntoVerses(text);
    expect(verses).toEqual([
      {
        number: 1,
        text: "Seeing the crowds, he went up on the mountain.",
        heading: "The Sermon on the Mount",
      },
      {
        number: 2,
        text: "And he opened his mouth and taught them, saying:",
        heading: "The Beatitudes",
      },
      {
        number: 3,
        text: "“Blessed are the poor in spirit.",
      },
      {
        number: 13,
        text: "“You are the salt of the earth.",
        heading: "Salt and Light",
      },
    ]);
  });

  it("records where a heading interrupts a verse (2 Samuel 12:15)", () => {
    const text = `  [14] the child who is born to you shall die.” [15] Then Nathan went to his house.

${RULE}
David’s Child Dies

  And the LORD afflicted the child that Uriah’s wife bore to David, and he became sick. [16] David therefore sought God on behalf of the child.
`;

    const verses = parsePassageIntoVerses(text);
    const opening = "Then Nathan went to his house.\n\n";
    expect(verses).toEqual([
      {
        number: 14,
        text: "the child who is born to you shall die.”",
      },
      {
        number: 15,
        text: `${opening}  And the LORD afflicted the child that Uriah’s wife bore to David, and he became sick.`,
        midHeadings: [
          {
            text: "David’s Child Dies",
            offset: opening.length,
            variant: "section",
          },
        ],
      },
      {
        number: 16,
        text: "David therefore sought God on behalf of the child.",
      },
    ]);
    // The heading sits between the sentences, not before the verse, and the
    // paragraph break it stands in survives in the verse text.
    const verse15 = verses[1];
    expect(verse15.heading).toBeUndefined();
    expect(verse15.text.slice(0, verse15.midHeadings![0].offset)).toBe(opening);
  });

  it("keeps poetry indentation after a heading interrupts a verse", () => {
    const text = `  [21] And Miriam sang to them:

${RULE}
A New Song

    “Sing to the LORD, for he has triumphed gloriously;
    the horse and his rider he has thrown into the sea.”

  [22] Then Moses made Israel set out from the Red Sea.
`;

    const verses = parsePassageIntoVerses(text);
    const opening = "And Miriam sang to them:\n\n";
    expect(verses[0]).toEqual({
      number: 21,
      text: `${opening}    “Sing to the LORD, for he has triumphed gloriously;\n    the horse and his rider he has thrown into the sea.”`,
      midHeadings: [
        { text: "A New Song", offset: opening.length, variant: "section" },
      ],
    });
  });

  it("keeps a verse whole when a paragraph break interrupts it", () => {
    const text = `${RULE}
The Fall

  [1] Now the serpent was more crafty than any other beast of the field.

  He said to the woman, “Did God actually say, ‘You shall not eat’?”

  [2] And the woman said to the serpent, “We may eat of the fruit,
`;

    const verses = parsePassageIntoVerses(text);
    expect(verses[0]).toEqual({
      number: 1,
      text: "Now the serpent was more crafty than any other beast of the field.\n\n  He said to the woman, “Did God actually say, ‘You shall not eat’?”",
      heading: "The Fall",
    });
    expect(verses[1]?.heading).toBeUndefined();
  });

  it("finds an indented heading following a poetry block (Exodus 15:21)", () => {
    // After poetry the rule is indented and separated by whitespace-only lines
    // rather than an empty one.
    const text = `  [21] And Miriam sang to them:

    “Sing to the LORD, for he has triumphed gloriously;
    the horse and his rider he has thrown into the sea.”
    
    
    ${RULE}
Bitter Water Made Sweet

  [22] Then Moses made Israel set out from the Red Sea.
`;

    const verses = parsePassageIntoVerses(text);
    expect(verses[0]?.text).toBe(
      "And Miriam sang to them:\n\n    “Sing to the LORD, for he has triumphed gloriously;\n    the horse and his rider he has thrown into the sea.”",
    );
    expect(verses[0]?.heading).toBeUndefined();
    expect(verses[1]).toEqual({
      number: 22,
      text: "Then Moses made Israel set out from the Red Sea.",
      heading: "Bitter Water Made Sweet",
    });
  });

  it("promotes known acrostic letters to subheadings on the following verse", () => {
    const text = `    [1] Blessed is the man
        who walks not in the counsel of the wicked,

    Beth

    [2] but his delight is in the law of the LORD.
`;
    const verses = parsePassageIntoVerses(text);
    expect(verses[0]?.heading).toBeUndefined();
    expect(verses[0]?.subheading).toBeUndefined();
    expect(verses[0]?.text).toContain("who walks not");
    expect(verses[0]?.text).not.toContain("Beth");
    expect(verses[1]).toEqual({
      number: 2,
      text: "but his delight is in the law of the LORD.",
      subheading: "Beth",
    });
  });

  it("leaves unmarked non-subheading blocks inside a verse as text", () => {
    const text = `    [1] Blessed is the man
        who walks not in the counsel of the wicked,

    Not A Real Letter

    [2] but his delight is in the law of the LORD.
`;
    const verses = parsePassageIntoVerses(text);
    expect(verses[0]?.text).toContain("Not A Real Letter");
    expect(verses[1]?.subheading).toBeUndefined();
  });

  it("attributes a heading past a disputed passage bracket (Mark 16:9)", () => {
    const text = `  [8] And they went out and fled from the tomb, for they were afraid.

[Some of the earliest manuscripts do not include 16:9–20.]

${RULE}
Jesus Appears to Mary Magdalene

  [[[9] Now when he rose early on the first day of the week, he appeared first to Mary Magdalene.
`;

    const verses = parsePassageIntoVerses(text);
    expect(verses[0]).toEqual({
      number: 8,
      text: "And they went out and fled from the tomb, for they were afraid.\n\n[Some of the earliest manuscripts do not include 16:9–20.]",
    });
    expect(verses[1]).toEqual({
      number: 9,
      text: "Now when he rose early on the first day of the week, he appeared first to Mary Magdalene.",
      heading: "Jesus Appears to Mary Magdalene",
    });
  });

  it("keeps unmarked psalm titles as subheadings (Psalm 3)", () => {
    const text = `${RULE}
Save Me, O My God

A Psalm of David, when he fled from Absalom his son.

    [1] O LORD, how many are my foes!
        Many are rising against me;
`;
    const verses = parsePassageIntoVerses(text);
    expect(verses[0]?.heading).toBe("Save Me, O My God");
    expect(verses[0]?.subheading).toBe(
      "A Psalm of David, when he fled from Absalom his son.",
    );
  });

  it("separates Psalm 119 section headings from acrostic subheadings", () => {
    // After poetry the API often emits whitespace-only spacer lines rather than
    // a truly empty line before the next acrostic letter.
    const text = `${RULE}
Your Word Is a Lamp to My Feet

Aleph

    [1] Blessed are those whose way is blameless,
        who walk in the law of the LORD!

    [8] I will keep your statutes;
        do not utterly forsake me!
    
    
Beth

    [9] How can a young man keep his way pure?

    [16] I will delight in your statutes;
        I will not forget your word.
    
    
Gimel

    [17] Deal bountifully with your servant.

    Sin and Shin

    [161] Princes persecute me without cause.
`;
    const verses = parsePassageIntoVerses(text);
    expect(verses[0]).toMatchObject({
      number: 1,
      heading: "Your Word Is a Lamp to My Feet",
      subheading: "Aleph",
    });
    expect(verses[0]?.text).not.toContain("Aleph");
    expect(verses.find((v) => v.number === 8)?.text).not.toContain("Beth");
    expect(verses.find((v) => v.number === 9)).toEqual({
      number: 9,
      text: "How can a young man keep his way pure?",
      subheading: "Beth",
    });
    expect(verses.find((v) => v.number === 16)?.text).not.toContain("Gimel");
    expect(verses.find((v) => v.number === 17)).toMatchObject({
      number: 17,
      subheading: "Gimel",
    });
    expect(verses.find((v) => v.number === 161)).toEqual({
      number: 161,
      text: "Princes persecute me without cause.",
      subheading: "Sin and Shin",
    });
  });

  it("peels Song of Solomon speaker labels, including mid-verse", () => {
    const text = `${RULE}
The Bride Confesses Her Love

She

  [2] Let him kiss me with the kisses of his mouth!

  [4] Draw me after you; let us run.
The king has brought me into his chambers.

Others

We will exult and rejoice in you;
we will extol your love more than wine;
rightly do they love you.

She

  [5] I am very dark, but lovely,

He

  [8] If you do not know, O most beautiful among women,
`;
    const verses = parsePassageIntoVerses(text);
    expect(verses[0]).toMatchObject({
      number: 2,
      heading: "The Bride Confesses Her Love",
      subheading: "She",
      text: "Let him kiss me with the kisses of his mouth!",
    });
    const v4 = verses.find((v) => v.number === 4)!;
    expect(v4.text).toContain("Draw me after you");
    expect(v4.text).toContain("We will exult and rejoice");
    expect(v4.text).not.toContain("Others");
    expect(v4.text).not.toContain("She");
    expect(v4.midHeadings).toHaveLength(1);
    expect(v4.midHeadings?.[0]).toMatchObject({
      text: "Others",
      variant: "sub",
    });
    expect(v4.midHeadings?.[0]?.offset).toBeGreaterThan(0);
    expect(v4.subheading).toBeUndefined();
    expect(verses.find((v) => v.number === 5)).toMatchObject({
      number: 5,
      subheading: "She",
      text: "I am very dark, but lovely,",
    });
    expect(verses.find((v) => v.number === 8)).toEqual({
      number: 8,
      text: "If you do not know, O most beautiful among women,",
      subheading: "He",
    });
  });

  it("keeps stacked marked headings (Psalm 1)", () => {
    const text = `${RULE}
Book One

${RULE}
The Way of the Righteous and the Wicked

    [1] Blessed is the man
`;
    const verses = parsePassageIntoVerses(text);
    expect(verses[0]?.heading).toBe(
      "Book One\nThe Way of the Righteous and the Wicked",
    );
    expect(verses[0]?.subheading).toBeUndefined();
  });
});

describe("parseEsvResponse", () => {
  it("parses headings from a full ESV-shaped payload", () => {
    const result = parseEsvResponse({
      canonical: "Matthew 5",
      passages: [
        `${RULE}
The Sermon on the Mount

  [1] Seeing the crowds.

${RULE}
The Beatitudes

  [2] And he opened his mouth.

Scripture quotations are from the ESV® Bible.`,
      ],
    });

    expect(result.canonical).toBe("Matthew 5");
    expect(result.verses[0]).toEqual({
      number: 1,
      text: "Seeing the crowds.",
      heading: "The Sermon on the Mount",
    });
    expect(result.verses[1]).toEqual({
      number: 2,
      text: "And he opened his mouth.",
      heading: "The Beatitudes",
    });
    expect(result.copyright).toContain("Scripture quotations");
  });
});
