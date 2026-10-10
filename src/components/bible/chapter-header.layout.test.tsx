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
import { ChapterHeader } from "./chapter-header";

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

function headerMarkup(book: string, chapter: number, width: number): string {
  return renderToStaticMarkup(
    <TooltipProvider>
      <div id="layout-root" style={{ width }}>
        <ChapterHeader
          book={book}
          chapter={chapter}
          showSectionHeaders={false}
          onToggleSectionHeaders={() => undefined}
          onChapterNotesClick={() => undefined}
        />
      </div>
    </TooltipProvider>,
  );
}

let server: ViteDevServer | undefined;
let browser: Browser | undefined;
let origin = "";

beforeAll(async () => {
  if (!chromeExecutablePath) return;

  server = await createServer({
    configFile: false,
    root: process.cwd(),
    logLevel: "error",
    server: { host: "127.0.0.1", port: 0, strictPort: false },
    plugins: [tailwindcss()],
    resolve: {
      alias: {
        "@": path.resolve(process.cwd(), "src"),
      },
    },
  });
  await server.listen();
  const address = server.httpServer?.address();
  if (!address || typeof address === "string") {
    throw new Error("Vite did not bind a TCP port for the layout test");
  }
  origin = `http://127.0.0.1:${address.port}`;

  browser = await chromium.launch({
    executablePath: chromeExecutablePath,
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
}, 60_000);

afterAll(async () => {
  await browser?.close();
  await server?.close();
}, 20_000);

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
    await page.setContent(
      `<!doctype html><html><head><link rel="stylesheet" href="${origin}/src/index.css"></head><body>${headerMarkup(book, chapter, width)}</body></html>`,
      { waitUntil: "load" },
    );
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
