import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  parseEsvHtmlResponse,
  parsePassageHtmlIntoVerses,
} from "../../shared/esv-html";

const fixturesDir = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../shared/fixtures/esv-html",
);

function loadFixture(slug: string): unknown {
  const raw = readFileSync(join(fixturesDir, `${slug}.json`), "utf8");
  return JSON.parse(raw) as unknown;
}

describe("parseEsvHtmlResponse / Song of Solomon 1", () => {
  const data = parseEsvHtmlResponse(loadFixture("song-of-solomon-1"));

  it("parses canonical and copyright from the HTML envelope", () => {
    expect(data.canonical).toBe("Song of Solomon 1");
    expect(data.copyright.toLowerCase()).toContain("esv");
    expect(data.copyright).toContain("Crossway");
  });

  it("attaches editorial headings to the following verse", () => {
    expect(data.verses.find((v) => v.number === 2)).toMatchObject({
      heading: "The Bride Confesses Her Love",
      subheading: "She",
    });
    expect(data.verses.find((v) => v.number === 8)).toMatchObject({
      heading: "Solomon and His Bride Delight in Each Other",
      subheading: "He",
    });
    expect(data.verses.find((v) => v.number === 1)?.heading).toBeUndefined();
  });

  it("keeps She / He / Others as subheading or mid sub from HTML marks", () => {
    expect(data.verses.find((v) => v.number === 2)?.subheading).toBe("She");
    expect(data.verses.find((v) => v.number === 5)?.subheading).toBe("She");
    expect(data.verses.find((v) => v.number === 8)?.subheading).toBe("He");

    const v4 = data.verses.find((v) => v.number === 4);
    expect(v4).toBeDefined();
    if (!v4) return;
    expect(v4.text).toContain("Draw me after you");
    expect(v4.text).toContain("We will exult and rejoice");
    expect(v4.text).not.toContain("Others");
    expect(v4.text).not.toContain("She");
    expect(v4.midHeadings).toHaveLength(1);
    const mid = v4.midHeadings?.[0];
    expect(mid).toMatchObject({ text: "Others", variant: "sub" });
    expect(mid?.offset).toBeGreaterThan(0);
    expect(v4.subheading).toBeUndefined();
  });

  it("decodes HTML entities and scales poetry indent to text-API steps", () => {
    for (const verse of data.verses) {
      expect(verse.text).not.toMatch(/&nbsp;|&amp;|&lt;|&gt;|&#\d+;/);
    }
    const v2 = data.verses.find((v) => v.number === 2);
    expect(v2?.text).toMatch(/^Let him kiss me/);
    // HTML `&nbsp;` steps (2/4) are doubled to match the text API (4/8).
    expect(v2?.text).toMatch(/\n {4}For your love is better than wine/);

    const v3 = data.verses.find((v) => v.number === 3);
    expect(v3?.text).toMatch(/^your anointing oils are fragrant/);
    expect(v3?.text).toMatch(/\n {4}your name is oil poured out/);
    expect(v3?.text).toMatch(/\n {8}therefore virgins love you/);
  });
});

describe("parseEsvHtmlResponse / Psalm 119 acrostics", () => {
  const data = parseEsvHtmlResponse(loadFixture("psalm-119-1-16"));

  it("promotes acrostic letters to subheading", () => {
    expect(data.canonical).toBe("Psalm 119:1–16");
    expect(data.verses.find((v) => v.number === 1)).toMatchObject({
      heading: "Your Word Is a Lamp to My Feet",
      subheading: "Aleph",
    });
    expect(data.verses.find((v) => v.number === 1)?.text).not.toContain(
      "Aleph",
    );
    expect(data.verses.find((v) => v.number === 9)).toMatchObject({
      number: 9,
      subheading: "Beth",
    });
    expect(data.verses.find((v) => v.number === 8)?.text).not.toContain("Beth");
  });
});

describe("parseEsvHtmlResponse / 2 Samuel 12:15 mid-verse heading", () => {
  const data = parseEsvHtmlResponse(loadFixture("2-samuel-12-15-16"));

  it("records a mid section heading with a paragraph break retained in text", () => {
    const v15 = data.verses.find((v) => v.number === 15);
    expect(v15).toBeDefined();
    if (!v15) return;
    expect(v15.heading).toBeUndefined();
    expect(v15.midHeadings).toHaveLength(1);
    const mid = v15.midHeadings?.[0];
    expect(mid).toMatchObject({
      text: "David’s Child Dies",
      variant: "section",
    });

    const offset = mid?.offset ?? -1;
    expect(offset).toBeGreaterThan(0);
    const before = v15.text.slice(0, offset);
    const after = v15.text.slice(offset);
    expect(before).toContain("Then Nathan went to his house.");
    expect(before.endsWith("\n\n")).toBe(true);
    expect(after).toContain(
      "And the LORD afflicted the child that Uriah’s wife bore to David, and he became sick.",
    );
    expect(v15.text).not.toContain("David’s Child Dies");

    expect(data.verses.find((v) => v.number === 16)?.text).toContain(
      "David therefore sought God on behalf of the child.",
    );
  });
});

describe("parsePassageHtmlIntoVerses", () => {
  it("returns an empty list for empty HTML", () => {
    expect(parsePassageHtmlIntoVerses("")).toEqual([]);
  });
});
