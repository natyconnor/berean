/**
 * @vitest-environment node
 */
import { existsSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import tailwindcss from "@tailwindcss/vite";
import { chromium, type Browser } from "playwright-core";
import { createServer, type ViteDevServer } from "vite";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { StagedOnboardingContext } from "@/components/tutorial/staged-onboarding-context";
import { PassageViewHeader } from "./passage-view-header";
import {
  COMPOSE_PASSAGE_COLUMNS_CLASS,
  READ_PASSAGE_COLUMNS_CLASS,
} from "./passage-columns";

vi.mock("@/lib/use-tabs", () => ({
  useTabs: () => ({
    navigateActiveTab: () => undefined,
  }),
}));

/**
 * jsdom does not resolve grid tracks or container queries. This loads the
 * real Tailwind CSS in headless Chrome and measures the passage / notes split.
 */

const CHROME_SKIP_NOTE =
  "Chrome not found. Set CHROME_PATH to run the passage column layout test.";

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

const VIEWPORTS = [1600, 1440, 1280, 1100, 1024, 960, 900, 861, 768] as const;

const LONG_VERSE =
  "In the beginning was the Word, and the Word was with God, and the Word was God. He was in the beginning with God. All things were made through him, and without him was not any thing made that was made.";

function revealedOnboarding(children: ReactNode) {
  return (
    <StagedOnboardingContext.Provider
      value={{
        milestones: {
          notesCount: 12,
          taggedNotesCount: 0,
          distinctTagCount: 0,
          heartsCount: 0,
          hasInlineVerseLink: false,
          hasExplicitVerseLink: false,
          starterTagCount: 0,
          customTagCount: 0,
        },
        isHintCompleted: () => true,
        isHintDismissed: () => false,
        isHintShown: () => true,
        isHintPending: () => false,
        isHintDisplayActive: () => false,
        requestHintDisplay: () => undefined,
        releaseHintDisplay: () => undefined,
        markShown: () => undefined,
        complete: () => undefined,
        dismiss: () => undefined,
        isLoading: false,
      }}
    >
      {children}
    </StagedOnboardingContext.Provider>
  );
}

function gridFrame(
  mode: "read" | "compose",
  width: number,
  copy: "short" | "long",
): ReactNode {
  const isRead = mode === "read";
  const gutter = isRead
    ? "max-w-[1400px] mx-auto pl-16 pr-6"
    : "max-w-[1320px] mx-auto pl-16 pr-5";
  const columns = isRead
    ? READ_PASSAGE_COLUMNS_CLASS
    : COMPOSE_PASSAGE_COLUMNS_CLASS;
  const verse = copy === "short" ? "Jesus wept." : LONG_VERSE;
  return (
    <div
      data-frame
      data-kind="grid"
      data-mode={mode}
      data-width={width}
      data-copy={copy}
      style={{ width }}
    >
      <div className={gutter}>
        <div className={`grid ${columns}`}>
          <div className="min-w-0" data-text>
            <p className="m-0">{verse}</p>
          </div>
          <div className="min-w-0" data-notes>
            <p className="m-0">
              A note that should wrap inside the notes column as it narrows.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function headerFrame(
  mode: "read" | "compose" | "focus",
  width: number,
): ReactNode {
  const isRead = mode === "read";
  const gutter = isRead
    ? "max-w-[1400px] mx-auto pl-16 pr-6"
    : "max-w-[1320px] mx-auto pl-16 pr-5";
  const columns = isRead
    ? READ_PASSAGE_COLUMNS_CLASS
    : COMPOSE_PASSAGE_COLUMNS_CLASS;
  return (
    <div
      data-frame
      data-kind="header"
      data-mode={mode}
      data-width={width}
      style={{ width }}
    >
      <PassageViewHeader
        book="1 Thessalonians"
        chapter={1}
        isScrolled={false}
        passageGridClass={columns}
        headerInnerClass={gutter}
        effectiveViewMode={isRead ? "read" : "compose"}
        isReadMode={isRead}
        isFocusMode={mode === "focus"}
        showSectionHeaders={false}
        hasAnyNotes
        noteVisibility="all"
        chapterNotesCount={4}
        maxNotesPerVerse={2}
        setViewModeWithNotesReset={() => undefined}
        setNoteVisibility={() => undefined}
        onToggleFocusMode={() => undefined}
        onToggleSectionHeaders={() => undefined}
        onChapterNotesClick={() => undefined}
      />
    </div>
  );
}

function layoutMarkup(): string {
  return renderToStaticMarkup(
    <TooltipProvider>
      {revealedOnboarding(
        <div>
          {VIEWPORTS.flatMap((width) =>
            (["read", "compose"] as const).flatMap((mode) =>
              (["short", "long"] as const).map((copy) => (
                <div key={`grid-${mode}-${width}-${copy}`}>
                  {gridFrame(mode, width, copy)}
                </div>
              )),
            ),
          )}
          {VIEWPORTS.flatMap((width) =>
            (["read", "compose", "focus"] as const).map((mode) => (
              <div key={`header-${mode}-${width}`}>
                {headerFrame(mode, width)}
              </div>
            )),
          )}
        </div>,
      )}
    </TooltipProvider>,
  );
}

interface ColumnMeasure {
  text: number;
  notes: number;
  overflow: number;
}

interface ControlBox {
  name: string;
  column: "text" | "notes";
  left: number;
  right: number;
  top: number;
  bottom: number;
}

interface HeaderMeasure {
  text: number;
  notes: number;
  overflow: number;
  frameRight: number;
  controls: ControlBox[];
}

let server: ViteDevServer | undefined;
let browser: Browser | undefined;
let origin = "";
let grids: Array<
  ColumnMeasure & { mode: string; width: number; copy: string }
> = [];
let headers: Array<HeaderMeasure & { mode: string; width: number }> = [];

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

  const page = await browser.newPage({
    viewport: { width: 1700, height: 800 },
  });
  await page.setContent(
    `<!doctype html><html><head><link rel="stylesheet" href="${origin}/src/index.css"></head><body style="margin:0">${layoutMarkup()}</body></html>`,
    { waitUntil: "load" },
  );
  await page.waitForFunction(() => {
    const grid = document.querySelector("[data-kind='grid'] .grid");
    return !!grid && getComputedStyle(grid).display === "grid";
  });
  const measured = await page.evaluate(() => {
    const gridRows = [...document.querySelectorAll("[data-kind='grid']")].map(
      (frame) => {
        const text = frame.querySelector("[data-text]");
        const notes = frame.querySelector("[data-notes]");
        if (!(frame instanceof HTMLElement) || !text || !notes) {
          throw new Error("missing grid");
        }
        return {
          mode: frame.dataset.mode ?? "",
          width: Number(frame.dataset.width),
          copy: frame.dataset.copy ?? "",
          text: Math.round(text.getBoundingClientRect().width),
          notes: Math.round(notes.getBoundingClientRect().width),
          overflow: Math.round(frame.scrollWidth - frame.clientWidth),
        };
      },
    );
    const headerRows = [
      ...document.querySelectorAll("[data-kind='header']"),
    ].map((frame) => {
      if (!(frame instanceof HTMLElement)) throw new Error("missing header");
      const grid = frame.querySelector(".grid");
      const columns = grid ? [...grid.children] : [];
      const text = columns[0];
      const notes = columns[1];
      if (!text || !notes) throw new Error("missing header columns");
      const notesBox = notes.getBoundingClientRect();
      const controls = [...frame.querySelectorAll("button, [role='switch']")]
        .filter((element) => element.getClientRects().length > 0)
        .map((element) => {
          const box = element.getBoundingClientRect();
          const name =
            element.getAttribute("aria-label") ??
            element.textContent?.replace(/\s+/g, " ").trim() ??
            "";
          const center = box.left + box.width / 2;
          return {
            name,
            column: center >= notesBox.left - 1 ? "notes" : "text",
            left: box.left,
            right: box.right,
            top: box.top,
            bottom: box.bottom,
          };
        });
      return {
        mode: frame.dataset.mode ?? "",
        width: Number(frame.dataset.width),
        text: Math.round(text.getBoundingClientRect().width),
        notes: Math.round(notes.getBoundingClientRect().width),
        overflow: Math.round(frame.scrollWidth - frame.clientWidth),
        frameRight: frame.getBoundingClientRect().right,
        controls,
      };
    });
    return { gridRows, headerRows };
  });
  grids = measured.gridRows;
  headers = measured.headerRows.map((row) => ({
    ...row,
    controls: row.controls.map((control) => ({
      ...control,
      column:
        control.column === "notes" ? ("notes" as const) : ("text" as const),
    })),
  }));
  await page.close();
}, 60_000);

afterAll(async () => {
  await browser?.close();
  await server?.close();
}, 20_000);

function overlaps(a: ControlBox, b: ControlBox): boolean {
  return (
    a.right > b.left + 1 &&
    a.left < b.right - 1 &&
    a.bottom > b.top + 1 &&
    a.top < b.bottom - 1
  );
}

describe("passage column layout", () => {
  it("gives read-mode notes width back before the scripture column collapses", (ctx) => {
    if (!chromeExecutablePath) ctx.skip(CHROME_SKIP_NOTE);

    const rows: Array<ColumnMeasure & { width: number; copy: string }> = [];
    for (const width of VIEWPORTS) {
      const long = grids.find(
        (row) =>
          row.mode === "read" && row.width === width && row.copy === "long",
      );
      const short = grids.find(
        (row) =>
          row.mode === "read" && row.width === width && row.copy === "short",
      );
      if (!long || !short) throw new Error(`missing read row ${width}`);
      expect(
        Math.abs(long.text - short.text),
        `${width} text`,
      ).toBeLessThanOrEqual(1);
      expect(
        Math.abs(long.notes - short.notes),
        `${width} notes`,
      ).toBeLessThanOrEqual(1);
      rows.push(long);
    }

    for (const row of rows) {
      expect(row.overflow, JSON.stringify(row)).toBeLessThanOrEqual(1);
      expect(row.text, JSON.stringify(row)).toBeGreaterThanOrEqual(360);
      expect(row.notes, JSON.stringify(row)).toBeGreaterThanOrEqual(270);
    }

    const wide = rows.find((row) => row.width === 1600)!;
    const mid = rows.find((row) => row.width === 1280)!;
    const tight = rows.find((row) => row.width === 861)!;
    const narrow = rows.find((row) => row.width === 768)!;

    // Wide reading still gives the notes column the extra room.
    expect(wide.notes, JSON.stringify(wide)).toBeGreaterThan(wide.text);
    expect(wide.text, JSON.stringify(wide)).toBeGreaterThanOrEqual(530);
    expect(wide.text, JSON.stringify(wide)).toBeLessThanOrEqual(560);

    // Notes has already given width back while the passage track is still held.
    expect(mid.text, JSON.stringify(mid)).toBeGreaterThanOrEqual(530);
    expect(mid.notes, JSON.stringify(mid)).toBeLessThan(wide.notes - 80);
    expect(mid.notes, JSON.stringify(mid)).toBeGreaterThan(mid.text);

    // The reported ~861px view: scripture stays readable, notes is the narrow side.
    expect(tight.text, JSON.stringify(tight)).toBeGreaterThanOrEqual(450);
    expect(tight.notes, JSON.stringify(tight)).toBeLessThanOrEqual(300);
    expect(tight.text, JSON.stringify(tight)).toBeGreaterThan(tight.notes);

    expect(narrow.text, JSON.stringify(narrow)).toBeGreaterThanOrEqual(360);
    expect(narrow.notes, JSON.stringify(narrow)).toBeLessThanOrEqual(300);
  });

  it("shrinks compose and focus notes before the passage track gets tight", (ctx) => {
    if (!chromeExecutablePath) ctx.skip(CHROME_SKIP_NOTE);

    for (const width of VIEWPORTS) {
      const long = grids.find(
        (row) =>
          row.mode === "compose" && row.width === width && row.copy === "long",
      );
      const short = grids.find(
        (row) =>
          row.mode === "compose" && row.width === width && row.copy === "short",
      );
      if (!long || !short) throw new Error(`missing compose row ${width}`);
      expect(
        long.overflow,
        JSON.stringify({ width, long }),
      ).toBeLessThanOrEqual(1);
      expect(Math.abs(long.text - short.text), `${width}`).toBeLessThanOrEqual(
        1,
      );
      expect(long.text, JSON.stringify({ width, long })).toBeGreaterThanOrEqual(
        360,
      );
      expect(
        long.notes,
        JSON.stringify({ width, long }),
      ).toBeGreaterThanOrEqual(270);
      expect(long.notes, JSON.stringify({ width, long })).toBeLessThanOrEqual(
        400,
      );
      expect(long.text, JSON.stringify({ width, long })).toBeGreaterThan(
        long.notes,
      );
    }

    // Notes is already at its 280px floor by 1024, while scripture stays
    // above ~30rem through 900 (measured 640/280, 576/280, 516/280).
    const at = (width: number) => {
      const row = grids.find(
        (candidate) =>
          candidate.mode === "compose" &&
          candidate.width === width &&
          candidate.copy === "long",
      );
      if (!row) throw new Error(`missing compose row ${width}`);
      return row;
    };

    expect(at(1600).text, JSON.stringify(at(1600))).toBeGreaterThanOrEqual(820);
    expect(at(1280).notes, JSON.stringify(at(1280))).toBeLessThan(380);
    expect(at(1100).text, JSON.stringify(at(1100))).toBeGreaterThanOrEqual(680);
    expect(at(1100).notes, JSON.stringify(at(1100))).toBeLessThan(320);

    for (const width of [1024, 960, 900, 861] as const) {
      const row = at(width);
      expect(row.notes, JSON.stringify(row)).toBeLessThanOrEqual(300);
      expect(row.text, JSON.stringify(row)).toBeGreaterThan(row.notes);
    }
    expect(at(1024).text, JSON.stringify(at(1024))).toBeGreaterThanOrEqual(620);
    expect(at(960).text, JSON.stringify(at(960))).toBeGreaterThanOrEqual(560);
    expect(at(900).text, JSON.stringify(at(900))).toBeGreaterThanOrEqual(500);
    expect(at(861).text, JSON.stringify(at(861))).toBeGreaterThanOrEqual(460);
    expect(at(768).text, JSON.stringify(at(768))).toBeGreaterThanOrEqual(370);
    expect(at(768).notes, JSON.stringify(at(768))).toBeLessThanOrEqual(300);
  });

  it("keeps header controls inside the frame in read, compose, and focus", (ctx) => {
    if (!chromeExecutablePath) ctx.skip(CHROME_SKIP_NOTE);

    for (const mode of ["read", "compose", "focus"] as const) {
      for (const width of VIEWPORTS) {
        const header = headers.find(
          (row) => row.mode === mode && row.width === width,
        );
        if (!header) throw new Error(`missing header ${mode} ${width}`);
        expect(
          header.overflow,
          JSON.stringify({ mode, width, header }),
        ).toBeLessThanOrEqual(1);
        expect(
          header.text,
          JSON.stringify({ mode, width, header }),
        ).toBeGreaterThan(200);
        expect(
          header.notes,
          JSON.stringify({ mode, width, header }),
        ).toBeGreaterThan(200);

        for (const control of header.controls) {
          expect(
            control.right,
            JSON.stringify({
              mode,
              width,
              control,
              frameRight: header.frameRight,
            }),
          ).toBeLessThanOrEqual(header.frameRight + 1);
          expect(
            control.left,
            JSON.stringify({ mode, width, control }),
          ).toBeGreaterThanOrEqual(-1);
        }

        const passageControls = header.controls.filter(
          (control) => control.column === "text",
        );
        const notesControls = header.controls.filter(
          (control) => control.column === "notes",
        );
        for (const passage of passageControls) {
          for (const notes of notesControls) {
            expect(
              overlaps(passage, notes),
              JSON.stringify({ mode, width, passage, notes }),
            ).toBe(false);
          }
        }
      }
    }
  });
});
