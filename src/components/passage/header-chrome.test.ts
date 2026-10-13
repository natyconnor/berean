import { describe, expect, it } from "vitest";

import { chapterMemorizeStageClasses } from "./header-chrome";

describe("chapterMemorizeStageClasses", () => {
  it("shows a line only from a slot that holds it whole", () => {
    expect(
      chapterMemorizeStageClasses("Memorized ✓", {
        ellipsize: false,
        word: false,
      }).line,
    ).toBe("@max-[9rem]/chapter-memorize:hidden");
    expect(
      chapterMemorizeStageClasses("Memorize Psalm 119", {
        ellipsize: false,
        word: true,
      }).line,
    ).toBe("@max-[11rem]/chapter-memorize:hidden");
    expect(
      chapterMemorizeStageClasses("Memorize Song of Solomon 8", {
        ellipsize: false,
        word: true,
      }).line,
    ).toBe("@max-[15rem]/chapter-memorize:hidden");
  });

  it("lets a passage title ellipsize from 10rem", () => {
    expect(
      chapterMemorizeStageClasses(
        "Part of The Sermon on the Mount and the Lord's Prayer",
        { ellipsize: true, word: false },
      ).line,
    ).toBe("@max-[10rem]/chapter-memorize:hidden");
  });

  it("keeps the start word down to 9rem, then narrows to the icon", () => {
    const classes = chapterMemorizeStageClasses("Memorize Psalm 119", {
      ellipsize: false,
      word: true,
    });
    expect(classes.word).toBe(
      "hidden @max-[11rem]/chapter-memorize:inline @max-[9rem]/chapter-memorize:hidden",
    );
    expect(classes.button).toBe(
      "@max-[9rem]/chapter-memorize:w-8 @max-[9rem]/chapter-memorize:justify-center @max-[9rem]/chapter-memorize:px-0",
    );
    expect(classes.mark).toBe("hidden @max-[9rem]/chapter-memorize:block");
  });

  it("goes from the line straight to the marked icon without a word", () => {
    const classes = chapterMemorizeStageClasses("Memorizing · 12 of 176", {
      ellipsize: false,
      word: false,
    });
    expect(classes.line).toBe("@max-[13rem]/chapter-memorize:hidden");
    expect(classes.word).toBeNull();
    expect(classes.button).toBe(
      "@max-[13rem]/chapter-memorize:w-8 @max-[13rem]/chapter-memorize:justify-center @max-[13rem]/chapter-memorize:px-0",
    );
    expect(classes.mark).toBe("hidden @max-[13rem]/chapter-memorize:block");
  });

  it("narrows a passage title to the icon where its line leaves", () => {
    const classes = chapterMemorizeStageClasses("Part of Sermon on the Mount", {
      ellipsize: true,
      word: false,
    });
    expect(classes.word).toBeNull();
    expect(classes.mark).toBe("hidden @max-[10rem]/chapter-memorize:block");
  });
});
