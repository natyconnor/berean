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
  chapterScopedNoteCount = 0,
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
          chapterScopedNoteCount={chapterScopedNoteCount}
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

/** What the Memorize button shows: the icon, or nothing on the tightest column. */
type MemorizeStage = "icon" | "gone";

interface MemorizeLayoutReport {
  width: number;
  stage: MemorizeStage;
  headerScrollWidth: number;
  headerClientWidth: number;
  memorizeText: string;
  noteText: string;
  noteBadge: string | null;
  memorize: Rect;
  memorizeHeight: number;
  noteWidth: number;
  noteHeight: number;
  headers: Rect;
  next: Rect;
  note: Rect;
  headersToMemorizeGap: number;
  memorizeToNoteGap: number;
  bookTruncated: boolean;
  /** The ring or check the icon wears. */
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
 * one Chrome evaluate so the container queries re-run in place.
 */
async function measureMemorizeWidths(
  widths: number[],
  { book, chapter, state }: MemorizeLayoutCase = PSALM_119,
  chapterScopedNoteCount = 0,
): Promise<MemorizeLayoutReport[]> {
  if (!browser) throw new Error("Chrome is not running");
  const [firstWidth = 0] = widths;
  const page: Page = await browser.newPage({
    viewport: { width: 1000, height: 400 },
  });
  try {
    await page.setContent(
      layoutDocument(
        headerMarkup(
          book,
          chapter,
          firstWidth,
          memorizeControl(state),
          chapterScopedNoteCount,
        ),
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
        const mark = memorize.querySelector("[data-memorize-mark]");
        const next = document
          .querySelector(".lucide-chevron-right")
          ?.closest("button");
        if (!next) throw new Error("missing parts");
        const bookLabel = required('[aria-label^="Change book"] span.truncate');
        const headersChip = document.getElementById(
          "passage-section-headers",
        )?.parentElement;
        if (!headersChip) throw new Error("missing headers switch");
        const note = required('[aria-label*="chapter note"]');
        const badge = note.querySelector("span[aria-hidden]");
        const truncated = (element: Element) =>
          element.scrollWidth > element.clientWidth + 1;
        const shown = (element: Element) =>
          getComputedStyle(element).display !== "none";
        const stage = shown(memorize) ? "icon" : "gone";
        const memorizeBox = rect(memorize);
        const headersBox = rect(headersChip);
        const noteBox = rect(note);
        return {
          width: columnWidth,
          stage,
          bookTruncated: truncated(bookLabel),
          markShown: mark ? shown(mark) : false,
          headerScrollWidth: header.scrollWidth,
          headerClientWidth: header.clientWidth,
          memorizeText: memorize.textContent?.trim() ?? "",
          noteText: note.textContent?.trim() ?? "",
          noteBadge: badge?.textContent ?? null,
          memorize: memorizeBox,
          memorizeHeight: memorize.getBoundingClientRect().height,
          noteWidth: noteBox.width,
          noteHeight: note.getBoundingClientRect().height,
          headers: headersBox,
          next: rect(next),
          note: noteBox,
          headersToMemorizeGap: memorizeBox.left - headersBox.right,
          memorizeToNoteGap: noteBox.left - memorizeBox.right,
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
  chapterScopedNoteCount = 0,
): Promise<MemorizeLayoutReport> {
  const [report] = await measureMemorizeWidths(
    [width],
    layoutCase,
    chapterScopedNoteCount,
  );
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

const STAGE_ORDER: MemorizeStage[] = ["icon", "gone"];

function expectStagesInOrder(reports: MemorizeLayoutReport[]) {
  const ranks = reports.map((report) => STAGE_ORDER.indexOf(report.stage));
  expect(
    ranks.every(
      (rank, index) => index === 0 || rank >= (ranks[index - 1] ?? 0),
    ),
    JSON.stringify(reports.map(({ width, stage }) => [width, stage])),
  ).toBe(true);
}

function expectIconSquare(report: MemorizeLayoutReport) {
  const json = JSON.stringify(report);
  expect(report.stage, json).toBe("icon");
  expect(report.memorize.width, json).toBe(32);
  expect(report.memorizeHeight, json).toBe(32);
  expect(report.noteWidth, json).toBe(32);
  expect(report.noteHeight, json).toBe(32);
  expect(report.memorizeText, json).toBe("");
  expect(report.headersToMemorizeGap, json).toBeCloseTo(8, 0);
  expect(report.memorizeToNoteGap, json).toBeCloseTo(8, 0);
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
  it("is a 32px icon on a wide passage column", async (ctx) => {
    if (!chromeExecutablePath) ctx.skip(CHROME_SKIP_NOTE);
    const report = await measureMemorize(860);
    const json = JSON.stringify(report);

    expectIconSquare(report);
    expect(report.markShown, json).toBe(false);
    expect(report.bookTruncated, json).toBe(false);
    expect(report.noteBadge, json).toBeNull();
    expectTidyRow(report);
  }, 30_000);

  it("keeps a long book name whole beside the icon buttons", async (ctx) => {
    if (!chromeExecutablePath) ctx.skip(CHROME_SKIP_NOTE);
    for (const layoutCase of [
      {
        book: "1 Thessalonians",
        chapter: 4,
        state: { kind: "memorize" as const, title: "1 Thessalonians 4" },
      },
      {
        book: "Song of Solomon",
        chapter: 2,
        state: { kind: "memorize" as const, title: "Song of Solomon 2" },
      },
    ]) {
      const report = await measureMemorize(860, layoutCase);
      const json = JSON.stringify({ ...layoutCase, ...report });
      expectIconSquare(report);
      expect(report.bookTruncated, json).toBe(false);
      expectTidyRow(report);
    }
  }, 30_000);

  it("keeps the book name whole beside a passage being memorized", async (ctx) => {
    if (!chromeExecutablePath) ctx.skip(CHROME_SKIP_NOTE);
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

    expectIconSquare(report);
    expect(report.bookTruncated, json).toBe(false);
    expect(report.markShown, json).toBe(true);
    expectTidyRow(report);
  }, 30_000);

  it("stays an icon while the column narrows", async (ctx) => {
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
      expectStagesInOrder(reports);
      for (const report of reports) {
        const json = JSON.stringify({ ...layoutCase, ...report });
        if (report.stage === "icon") {
          expect(report.memorize.width, json).toBe(32);
          expect(report.memorizeHeight, json).toBe(32);
          expect(report.memorizeText, json).toBe("");
        }
        expectTidyRow(report);
      }
    }
  }, 60_000);

  it("always shows a marked icon once memorizing", async (ctx) => {
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

      expectStagesInOrder(reports);
      expect(stages, json).toContain("icon");
      expect(stages, json).not.toContain("gone");
      for (const report of reports) {
        const reportJson = JSON.stringify({ ...layoutCase, ...report });
        if (report.stage === "icon") {
          expect(report.memorize.width, reportJson).toBe(32);
          expect(report.markShown, reportJson).toBe(true);
        }
      }
    }
  }, 60_000);

  it("shows a 3 badge, caps 12 at 9+, and hides the badge when empty", async (ctx) => {
    if (!chromeExecutablePath) ctx.skip(CHROME_SKIP_NOTE);
    const three = await measureMemorize(860, PSALM_119, 3);
    expect(three.noteBadge, JSON.stringify(three)).toBe("3");
    expect(three.note.top, JSON.stringify(three)).toBeGreaterThan(0);
    expectTidyRow(three);

    const capped = await measureMemorize(860, PSALM_119, 12);
    expect(capped.noteBadge, JSON.stringify(capped)).toBe("9+");
    expectTidyRow(capped);

    const empty = await measureMemorize(860, PSALM_119, 0);
    expect(empty.noteBadge, JSON.stringify(empty)).toBeNull();
    expect(empty.noteText, JSON.stringify(empty)).toBe("");
    expectTidyRow(empty);
  }, 30_000);

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
