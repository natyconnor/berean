/**
 * @vitest-environment node
 */
import { existsSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import tailwindcss from "@tailwindcss/vite";
import { chromium, type Browser, type Page } from "playwright-core";
import { createServer, type ViteDevServer } from "vite";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { ChapterMemorizeState } from "@/lib/chapter-memorize";
import { ChapterHeader, type ChapterMemorizeControl } from "./chapter-header";

vi.mock("@/lib/use-tabs", () => ({
  useTabs: () => ({
    navigateActiveTab: () => undefined,
  }),
}));

/**
 * jsdom does not apply container queries or flex-shrink, so a class-name
 * assertion cannot see a long book name paint over the chapter number.
 * This loads the real Tailwind CSS in headless Chrome and measures boxes.
 */

interface Rect {
  left: number;
  right: number;
  top: number;
  bottom: number;
  width: number;
}

interface LayoutReport {
  headerWidth: number;
  book: Rect;
  bookLabel: Rect;
  chapter: Rect;
  next: Rect;
  note: Rect;
  headersWidth: number;
  headersDisplay: string;
  truncated: boolean;
  scrollWidth: number;
  clientWidth: number;
  title: string | null;
  flexShrink: string;
  textOverflow: string;
  labelText: string;
}

function overlaps(a: Rect, b: Rect): boolean {
  return (
    a.right > b.left + 1 &&
    a.left < b.right - 1 &&
    a.bottom > b.top + 1 &&
    a.top < b.bottom - 1
  );
}

const CHROME_SKIP_NOTE =
  "Chrome not found. Set CHROME_PATH to run the chapter-header layout test.";

function findChromeExecutable(): string | undefined {
  const candidates = [
    process.env.CHROME_PATH,
    "/usr/bin/google-chrome-stable",
    "/usr/bin/google-chrome",
    "/usr/local/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ].filter((candidate): candidate is string => Boolean(candidate));

  return candidates.find((candidate) => existsSync(candidate));
}

const chromeExecutablePath = findChromeExecutable();

function memorizeControl(state: ChapterMemorizeState): ChapterMemorizeControl {
  return { state, onMemorize: () => undefined, onOpenPack: () => undefined };
}

function headerMarkup(
  book: string,
  chapter: number,
  width: number,
  memorize: ChapterMemorizeControl | null = null,
): string {
  return renderToStaticMarkup(
    <TooltipProvider>
      <div id="layout-root" style={{ width }}>
        <ChapterHeader
          book={book}
          chapter={chapter}
          showSectionHeaders={false}
          onToggleSectionHeaders={() => undefined}
          onChapterNotesClick={() => undefined}
          memorize={memorize}
        />
      </div>
    </TooltipProvider>,
  );
}

let browser: Browser | undefined;
let layoutCss = "";

beforeAll(async () => {
  if (!chromeExecutablePath) return;

  const server: ViteDevServer = await createServer({
    configFile: false,
    root: process.cwd(),
    logLevel: "error",
    server: { host: "127.0.0.1", port: 0, strictPort: false },
    plugins: [tailwindcss()],
    optimizeDeps: { noDiscovery: true },
    resolve: {
      alias: {
        "@": path.resolve(process.cwd(), "src"),
      },
    },
  });
  await server.listen();
  try {
    const address = server.httpServer?.address();
    if (!address || typeof address === "string") {
      throw new Error("Vite did not bind a TCP port for the layout test");
    }
    const cssRes = await fetch(
      `http://127.0.0.1:${address.port}/src/index.css`,
      {
        headers: { Accept: "text/css" },
      },
    );
    if (!cssRes.ok) {
      throw new Error(`CSS compile failed: ${cssRes.status}`);
    }
    layoutCss = await cssRes.text();
  } finally {
    await server.close();
  }

  browser = await chromium.launch({
    executablePath: chromeExecutablePath,
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
}, 60_000);

afterAll(async () => {
  await browser?.close();
}, 20_000);

function layoutDocument(body: string): string {
  return `<!doctype html><html><head><style>${layoutCss}</style></head><body>${body}</body></html>`;
}

async function measureColumn(
  book: string,
  chapter: number,
  width: number,
): Promise<LayoutReport> {
  if (!browser) throw new Error("Chrome is not running");
  const page: Page = await browser.newPage({
    viewport: { width: 900, height: 400 },
  });
  try {
    await page.setContent(layoutDocument(headerMarkup(book, chapter, width)), {
      waitUntil: "load",
    });
    await page.waitForFunction(() => {
      const well = document.querySelector("h1");
      return !!well && getComputedStyle(well).display === "flex";
    });
    await page.evaluate(() => document.fonts.ready);

    return await page.evaluate(() => {
      function required(selector: string): Element {
        const element = document.querySelector(selector);
        if (!element) throw new Error(`missing ${selector}`);
        return element;
      }

      function rect(element: Element): {
        left: number;
        right: number;
        top: number;
        bottom: number;
        width: number;
      } {
        const box = element.getBoundingClientRect();
        return {
          left: box.left,
          right: box.right,
          top: box.top,
          bottom: box.bottom,
          width: box.width,
        };
      }

      const bookButton = required('[aria-label^="Change book"]');
      const bookLabel = bookButton.querySelector("span.truncate");
      if (
        !(bookButton instanceof HTMLElement) ||
        !(bookLabel instanceof HTMLElement)
      ) {
        throw new Error("missing book label");
      }
      const chapterButton = required('[aria-label^="Change chapter"]');
      const nextIcon = document.querySelector(".lucide-chevron-right");
      const nextButton = nextIcon?.closest("button");
      if (!nextButton) throw new Error("missing next chapter button");
      const noteButton = required('[aria-label^="Add a chapter note"]');
      const headers = document.getElementById("passage-section-headers");
      const headersChip = headers?.parentElement;
      if (!headersChip) throw new Error("missing headers switch");
      const header = document.querySelector("#layout-root > div");
      if (!header) throw new Error("missing chapter header");

      const labelStyle = getComputedStyle(bookLabel);
      return {
        headerWidth: header.getBoundingClientRect().width,
        book: rect(bookButton),
        bookLabel: rect(bookLabel),
        chapter: rect(chapterButton),
        next: rect(nextButton),
        note: rect(noteButton),
        headersWidth: headersChip.getBoundingClientRect().width,
        headersDisplay: getComputedStyle(headersChip).display,
        truncated: bookLabel.scrollWidth > bookLabel.clientWidth + 1,
        scrollWidth: bookLabel.scrollWidth,
        clientWidth: bookLabel.clientWidth,
        title: bookLabel.getAttribute("title"),
        flexShrink: getComputedStyle(bookButton).flexShrink,
        textOverflow: labelStyle.textOverflow,
        labelText: bookLabel.textContent ?? "",
      };
    });
  } finally {
    await page.close();
  }
}

/** What the Memorize button shows: its line, one word, the icon, or nothing. */
type MemorizeStage = "line" | "word" | "icon" | "gone";

interface MemorizeLayoutReport {
  width: number;
  stage: MemorizeStage;
  headerScrollWidth: number;
  headerClientWidth: number;
  fullText: string;
  memorize: Rect;
  memorizeHeight: number;
  headers: Rect;
  next: Rect;
  note: Rect;
  bookTruncated: boolean;
  fullTruncated: boolean;
  shortTruncated: boolean;
  /** The ring or check the bare icon wears. */
  markShown: boolean;
}

interface MemorizeLayoutCase {
  book: string;
  chapter: number;
  state: ChapterMemorizeState;
}

const PSALM_119: MemorizeLayoutCase = {
  book: "Psalms",
  chapter: 119,
  state: { kind: "memorize", title: "Psalm 119" },
};

/**
 * Loads the header once and resizes the passage column through `widths` in
 * one Chrome evaluate. A Vite CSS request or Playwright round-trip per width
 * leaked enough heap in this worker to OOM a 4GB CI job.
 */
async function measureMemorizeWidths(
  widths: number[],
  { book, chapter, state }: MemorizeLayoutCase = PSALM_119,
): Promise<MemorizeLayoutReport[]> {
  if (!browser) throw new Error("Chrome is not running");
  const [firstWidth = 0] = widths;
  const page: Page = await browser.newPage({
    viewport: { width: 1000, height: 400 },
  });
  try {
    await page.setContent(
      layoutDocument(
        headerMarkup(book, chapter, firstWidth, memorizeControl(state)),
      ),
      { waitUntil: "load" },
    );
    await page.waitForFunction(() => {
      const well = document.querySelector("h1");
      return !!well && getComputedStyle(well).display === "flex";
    });
    await page.evaluate(() => document.fonts.ready);

    const reports = await page.evaluate((columnWidths) => {
      function required(selector: string): HTMLElement {
        const element = document.querySelector(selector);
        if (!(element instanceof HTMLElement)) {
          throw new Error(`missing ${selector}`);
        }
        return element;
      }
      function rect(element: Element) {
        const box = element.getBoundingClientRect();
        return {
          left: box.left,
          right: box.right,
          top: box.top,
          bottom: box.bottom,
          width: box.width,
        };
      }

      return columnWidths.map((columnWidth) => {
        required("#layout-root").style.width = `${columnWidth}px`;
        const header = required("#layout-root > div");
        const memorize = required('[data-tour-id="chapter-memorize"]');
        const [full, short] = Array.from(
          memorize.querySelectorAll(":scope > span"),
        );
        const mark = memorize.querySelector("[data-memorize-mark]");
        const next = document
          .querySelector(".lucide-chevron-right")
          ?.closest("button");
        if (!full || !next) throw new Error("missing parts");
        const bookLabel = required('[aria-label^="Change book"] span.truncate');
        const headersChip = document.getElementById(
          "passage-section-headers",
        )?.parentElement;
        if (!headersChip) throw new Error("missing headers switch");
        const truncated = (element: Element) =>
          element.scrollWidth > element.clientWidth + 1;
        const shown = (element: Element) =>
          getComputedStyle(element).display !== "none";
        const stage = !shown(memorize)
          ? "gone"
          : shown(full)
            ? "line"
            : short && shown(short)
              ? "word"
              : "icon";
        return {
          width: columnWidth,
          stage,
          bookTruncated: truncated(bookLabel),
          fullTruncated: truncated(full),
          shortTruncated: short ? truncated(short) : false,
          markShown: mark ? shown(mark) : false,
          headerScrollWidth: header.scrollWidth,
          headerClientWidth: header.clientWidth,
          fullText: full.textContent ?? "",
          memorize: rect(memorize),
          memorizeHeight: memorize.getBoundingClientRect().height,
          headers: rect(headersChip),
          next: rect(next),
          note: rect(required('[aria-label^="Add a chapter note"]')),
        } satisfies MemorizeLayoutReport;
      });
    }, widths);
    return reports;
  } finally {
    await page.close();
  }
}

async function measureMemorize(
  width: number,
  layoutCase?: MemorizeLayoutCase,
): Promise<MemorizeLayoutReport> {
  const [report] = await measureMemorizeWidths([width], layoutCase);
  if (!report) throw new Error("no layout report");
  return report;
}

function expectTidyRow(report: MemorizeLayoutReport) {
  const json = JSON.stringify(report);
  expect(overlaps(report.memorize, report.note), json).toBe(false);
  expect(overlaps(report.memorize, report.next), json).toBe(false);
  expect(overlaps(report.memorize, report.headers), json).toBe(false);
  expect(report.headerScrollWidth, json).toBeLessThanOrEqual(
    report.headerClientWidth + 1,
  );
}

/** Every 8px from `from` down to `to`. */
function widthsDown(from: number, to: number): number[] {
  const widths: number[] = [];
  for (let width = from; width >= to; width -= 8) widths.push(width);
  return widths;
}

const STAGE_ORDER: MemorizeStage[] = ["line", "word", "icon", "gone"];

function expectStagesInOrder(reports: MemorizeLayoutReport[]) {
  const ranks = reports.map((report) => STAGE_ORDER.indexOf(report.stage));
  expect(
    ranks.every(
      (rank, index) => index === 0 || rank >= (ranks[index - 1] ?? 0),
    ),
    JSON.stringify(reports.map(({ width, stage }) => [width, stage])),
  ).toBe(true);
}

const MEMORIZING_PSALM_1: MemorizeLayoutCase = {
  book: "Psalms",
  chapter: 1,
  state: {
    kind: "memorizing",
    title: "Psalm 1",
    packId: "pack_1",
    learnedVerses: 2,
    totalVerses: 6,
  },
};

const MEMORIZED_PSALM_1: MemorizeLayoutCase = {
  book: "Psalms",
  chapter: 1,
  state: { kind: "memorized", title: "Psalm 1", packId: "pack_1" },
};

const PART_OF_SERMON: MemorizeLayoutCase = {
  book: "Matthew",
  chapter: 6,
  state: {
    kind: "partOf",
    title: "The Sermon on the Mount",
    packId: "pack_sm",
    memorized: false,
    learnedVerses: 4,
    totalVerses: 111,
  },
};

describe("ChapterHeader Memorize button layout", () => {
  it("shows one short line on a wide passage column", async (ctx) => {
    if (!chromeExecutablePath) ctx.skip(CHROME_SKIP_NOTE);
    const report = await measureMemorize(860);
    const json = JSON.stringify(report);

    expect(report.stage, json).toBe("line");
    expect(report.fullText, json).toBe("Memorize Psalm 119");
    expect(report.fullTruncated, json).toBe(false);
    expect(report.memorizeHeight, json).toBeLessThanOrEqual(32);
    expect(report.bookTruncated, json).toBe(false);
    expectTidyRow(report);
  }, 30_000);

  it("keeps the book name whole beside a passage being memorized", async (ctx) => {
    if (!chromeExecutablePath) ctx.skip(CHROME_SKIP_NOTE);
    // The compose passage column at a wide window, where "Psa… 1" used to
    // give way to a two-line "Memorizing {pack title}" button.
    const report = await measureMemorize(870, {
      book: "Psalms",
      chapter: 1,
      state: {
        kind: "memorizing",
        title: "Sample · Psalm 1 (start passage)",
        packId: "pack_1",
        learnedVerses: 2,
        totalVerses: 6,
      },
    });
    const json = JSON.stringify(report);

    expect(report.bookTruncated, json).toBe(false);
    expect(report.fullText, json).toBe("Memorizing · 2 of 6");
    expect(report.fullTruncated, json).toBe(false);
    expect(report.memorizeHeight, json).toBeLessThanOrEqual(32);
    expectTidyRow(report);
  }, 30_000);

  it("truncates a long passage title inside a capped button", async (ctx) => {
    if (!chromeExecutablePath) ctx.skip(CHROME_SKIP_NOTE);
    const report = await measureMemorize(870, {
      book: "Matthew",
      chapter: 6,
      state: {
        kind: "partOf",
        title: "The Sermon on the Mount and the Lord's Prayer",
        packId: "pack_sm",
        memorized: false,
        learnedVerses: 4,
        totalVerses: 111,
      },
    });
    const json = JSON.stringify(report);

    expect(report.stage, json).toBe("line");
    expect(report.fullTruncated, json).toBe(true);
    expect(report.memorize.width, json).toBeLessThanOrEqual(240);
    expect(report.bookTruncated, json).toBe(false);
    expectTidyRow(report);
  }, 30_000);

  it("gives up its words before the book name shortens", async (ctx) => {
    if (!chromeExecutablePath) ctx.skip(CHROME_SKIP_NOTE);
    const cases: MemorizeLayoutCase[] = [
      PSALM_119,
      {
        book: "Psalms",
        chapter: 1,
        state: { kind: "memorize", title: "Psalm 1" },
      },
      {
        book: "1 Thessalonians",
        chapter: 5,
        state: { kind: "memorize", title: "1 Thessalonians 5" },
      },
      MEMORIZING_PSALM_1,
      MEMORIZED_PSALM_1,
      PART_OF_SERMON,
    ];
    for (const layoutCase of cases) {
      const reports = await measureMemorizeWidths(
        widthsDown(880, 336),
        layoutCase,
      );
      for (const report of reports) {
        const json = JSON.stringify({ ...layoutCase, ...report });
        if (report.bookTruncated) {
          expect(["icon", "gone"], json).toContain(report.stage);
        }
        // A passage title may ellipsize; every other line shows whole.
        if (report.stage === "line" && layoutCase !== PART_OF_SERMON) {
          expect(report.fullTruncated, json).toBe(false);
        }
        if (report.stage === "word") {
          expect(report.shortTruncated, json).toBe(false);
        }
        expectTidyRow(report);
      }
    }
  }, 60_000);

  it("collapses to one word, then the icon alone", async (ctx) => {
    if (!chromeExecutablePath) ctx.skip(CHROME_SKIP_NOTE);
    // Below 528px the Headers switch has left, so the slot only narrows.
    const reports = await measureMemorizeWidths(widthsDown(520, 336), {
      book: "Psalms",
      chapter: 1,
      state: { kind: "memorize", title: "Psalm 1" },
    });
    const stages = reports.map((report) => report.stage);
    const json = JSON.stringify(
      reports.map(({ width, stage }) => [width, stage]),
    );

    expectStagesInOrder(reports);
    expect(stages, json).toContain("line");
    expect(stages, json).toContain("word");
    expect(stages, json).toContain("icon");
    for (const report of reports) {
      if (report.stage === "icon") {
        expect(report.memorize.width, JSON.stringify(report)).toBe(32);
        expect(report.markShown, JSON.stringify(report)).toBe(false);
      }
    }
  }, 30_000);

  it("goes straight from its line to a marked icon once memorizing", async (ctx) => {
    if (!chromeExecutablePath) ctx.skip(CHROME_SKIP_NOTE);
    for (const layoutCase of [
      MEMORIZING_PSALM_1,
      MEMORIZED_PSALM_1,
      PART_OF_SERMON,
    ]) {
      const reports = await measureMemorizeWidths(
        widthsDown(880, 336),
        layoutCase,
      );
      const stages = reports.map((report) => report.stage);
      const json = JSON.stringify({
        state: layoutCase.state,
        stages: reports.map(({ width, stage }) => [width, stage]),
      });

      // Below 528px the Headers switch has left, so the slot only narrows.
      expectStagesInOrder(reports.filter((report) => report.width <= 520));
      expect(stages, json).toContain("line");
      expect(stages, json).not.toContain("word");
      expect(stages, json).toContain("icon");
      for (const report of reports) {
        const reportJson = JSON.stringify({ ...layoutCase, ...report });
        if (report.stage === "icon") {
          expect(report.memorize.width, reportJson).toBe(32);
          expect(report.markShown, reportJson).toBe(true);
        }
        if (report.stage === "line") {
          expect(report.markShown, reportJson).toBe(false);
        }
      }
    }
  }, 60_000);

  it("leaves the row with the Headers switch on the tightest column", async (ctx) => {
    if (!chromeExecutablePath) ctx.skip(CHROME_SKIP_NOTE);
    const report = await measureMemorize(300);
    expect(report.stage, JSON.stringify(report)).toBe("gone");
  }, 30_000);
});

describe("ChapterHeader narrow column layout", () => {
  it("truncates a long book name instead of covering the chapter", async (ctx) => {
    if (!chromeExecutablePath) ctx.skip(CHROME_SKIP_NOTE);
    // 340px keeps the Headers switch on the row, which is where a
    // non-shrinking book name used to paint over the chapter.
    const report = await measureColumn("1 Thessalonians", 1, 340);

    expect(report.headersDisplay, JSON.stringify(report)).toBe("flex");

    expect(report.flexShrink, JSON.stringify(report)).toBe("1");
    expect(report.textOverflow).toBe("ellipsis");
    expect(report.truncated, JSON.stringify(report)).toBe(true);
    expect(report.title).toBe("1 Thessalonians");
    expect(report.labelText).toContain("1 Thessalonians");
    expect(
      overlaps(report.bookLabel, report.chapter),
      JSON.stringify(report),
    ).toBe(false);
    expect(overlaps(report.book, report.chapter), JSON.stringify(report)).toBe(
      false,
    );
    expect(overlaps(report.book, report.next), JSON.stringify(report)).toBe(
      false,
    );
    expect(overlaps(report.chapter, report.next), JSON.stringify(report)).toBe(
      false,
    );
    expect(overlaps(report.next, report.note), JSON.stringify(report)).toBe(
      false,
    );
  }, 30_000);

  it("keeps John 1 from overlapping in a 224px passage column", async (ctx) => {
    if (!chromeExecutablePath) ctx.skip(CHROME_SKIP_NOTE);

    const report = await measureColumn("John", 1, 224);

    expect(report.truncated, JSON.stringify(report)).toBe(false);
    expect(report.headersDisplay, JSON.stringify(report)).toBe("none");
    expect(report.headersWidth, JSON.stringify(report)).toBe(0);
    expect(report.note.width, JSON.stringify(report)).toBeGreaterThan(0);
    expect(
      overlaps(report.bookLabel, report.chapter),
      JSON.stringify(report),
    ).toBe(false);
    expect(overlaps(report.book, report.next), JSON.stringify(report)).toBe(
      false,
    );
    expect(overlaps(report.chapter, report.next), JSON.stringify(report)).toBe(
      false,
    );
    expect(overlaps(report.next, report.note), JSON.stringify(report)).toBe(
      false,
    );
    expect(overlaps(report.book, report.note), JSON.stringify(report)).toBe(
      false,
    );
  }, 30_000);
});
