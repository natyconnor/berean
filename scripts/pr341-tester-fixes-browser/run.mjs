import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { chromium } from "playwright-core";
import { createServer } from "vite";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)));
const repo = path.resolve(root, "../..");
const stub = path.join(root, "stubs.ts");
const artifacts = "/opt/cursor/artifacts";
fs.mkdirSync(artifacts, { recursive: true });

const server = await createServer({
  configFile: false,
  root,
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.join(repo, "src"),
      "@tanstack/react-router": stub,
      "convex/react": stub,
      [path.join(repo, "src/hooks/use-esv-composite-passage")]: stub,
    },
  },
  server: { host: "127.0.0.1", port: 4175, strictPort: true },
});

await server.listen();
const base = "http://127.0.0.1:4175/";

const browser = await chromium.launch({
  headless: true,
  executablePath:
    process.env.PLAYWRIGHT_CHROMIUM_PATH ?? "/usr/bin/google-chrome",
});

const results = [];

async function openPage(search, width, height) {
  const page = await browser.newPage({ viewport: { width, height } });
  await page.goto(`${base}?case=${search}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(300);
  return page;
}

async function measureRefresh(width, height) {
  const page = await openPage("refresh", width, height);
  const metrics = await page.evaluate(() => {
    const viewport = document.querySelector(
      '[data-slot="scroll-area-viewport"]',
    );
    const textarea = document.querySelector("textarea");
    const check = Array.from(document.querySelectorAll("button")).find(
      (button) => (button.textContent ?? "").includes("Check"),
    );
    const dock = document.querySelector('[data-testid="notes-dock"]');
    const text = document.querySelector('[data-slot="scroll-area"]');
    if (!(viewport instanceof HTMLElement)) {
      return { hasScrollArea: false };
    }
    const textBox = textarea?.getBoundingClientRect();
    const checkBox = check?.getBoundingClientRect();
    const dockBox = dock?.getBoundingClientRect();
    return {
      hasScrollArea: true,
      viewportClientHeight: viewport.clientHeight,
      viewportScrollHeight: viewport.scrollHeight,
      canScroll: viewport.scrollHeight > viewport.clientHeight + 8,
      textareaBottom: textBox?.bottom ?? null,
      checkBottom: checkBox?.bottom ?? null,
      dockTop: dockBox?.top ?? null,
      windowHeight: window.innerHeight,
      documentScrollHeight: document.documentElement.scrollHeight,
      hasText: Boolean(text),
    };
  });
  if (metrics.canScroll) {
    await page.evaluate(() => {
      const viewport = document.querySelector(
        '[data-slot="scroll-area-viewport"]',
      );
      if (viewport instanceof HTMLElement) {
        viewport.scrollTop = viewport.scrollHeight;
      }
    });
    await page.waitForTimeout(200);
  }
  const shot = path.join(
    artifacts,
    `i1-${width}-refresh${metrics.canScroll ? "-scrolled" : ""}.png`,
  );
  await page.screenshot({ path: shot, fullPage: false });
  await page.close();
  return { width, height, shot, ...metrics };
}

async function measurePack(width, height) {
  const page = await openPage("pack", width, height);
  const copy = await page.evaluate(() => ({
    main:
      document.querySelector('[data-testid="main-action"]')?.textContent ?? "",
    today:
      document.querySelector('[data-testid="today-line"]')?.textContent ?? "",
    body: document.body.innerText,
  }));
  const shot = path.join(artifacts, `i2-${width}-pack-after-startover.png`);
  await page.screenshot({ path: shot, fullPage: true });
  await page.close();
  return { width, height, shot, ...copy };
}

async function measureToday(width, height) {
  const page = await openPage("today", width, height);
  const copy = await page.evaluate(() => ({
    body: document.body.innerText,
  }));
  const shot = path.join(artifacts, `i3-${width}-today-after-startover.png`);
  await page.screenshot({ path: shot, fullPage: true });
  await page.close();
  return { width, height, shot, ...copy };
}

try {
  const viewports = [
    { width: 1280, height: 800 },
    { width: 390, height: 844 },
  ];
  for (const viewport of viewports) {
    const refresh = await measureRefresh(viewport.width, viewport.height);
    results.push({ case: "refresh", ...refresh });
    if (!refresh.hasScrollArea) {
      throw new Error(`item 1 @${viewport.width}: missing ScrollArea`);
    }
    if (!refresh.canScroll) {
      throw new Error(
        `item 1 @${viewport.width}: sitting does not scroll (${refresh.viewportScrollHeight} <= ${refresh.viewportClientHeight})`,
      );
    }
    const pack = await measurePack(viewport.width, viewport.height);
    results.push({ case: "pack", ...pack });
    if (!pack.main.includes("Start") || !pack.main.includes("7")) {
      throw new Error(
        `item 2 @${viewport.width}: main action was "${pack.main}"`,
      );
    }
    if (
      pack.body.includes("Learning today") ||
      pack.today.includes("read verses")
    ) {
      throw new Error(`item 2 @${viewport.width}: still looks started`);
    }
    const today = await measureToday(viewport.width, viewport.height);
    results.push({ case: "today", ...today });
    if (today.body.includes("Done today")) {
      throw new Error(`item 3 @${viewport.width}: still shows Done today`);
    }
    if (!/Start · 7 min|Learn/.test(today.body)) {
      throw new Error(`item 3 @${viewport.width}: missing Learn/Start`);
    }
    if (!today.body.includes("read verses 1–2")) {
      throw new Error(`item 3 @${viewport.width}: missing first step`);
    }
  }
  const logPath = path.join(artifacts, "pr341-tester-fixes-browser.json");
  fs.writeFileSync(logPath, JSON.stringify({ ok: true, results }, null, 2));
  console.log(JSON.stringify({ ok: true, logPath, results }, null, 2));
} catch (error) {
  const logPath = path.join(artifacts, "pr341-tester-fixes-browser.json");
  fs.writeFileSync(
    logPath,
    JSON.stringify({ ok: false, results, error: String(error) }, null, 2),
  );
  console.error(
    JSON.stringify({ ok: false, results, error: String(error) }, null, 2),
  );
  process.exitCode = 1;
} finally {
  await browser.close();
  await server.close();
}
