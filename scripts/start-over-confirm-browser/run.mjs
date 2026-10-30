import path from "node:path";
import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { chromium } from "playwright-core";
import { createServer } from "vite";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)));
const repo = path.resolve(root, "../..");
const stub = path.join(root, "stubs.ts");

const server = await createServer({
  configFile: false,
  root,
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.join(repo, "src"),
      "@tanstack/react-router": stub,
      "convex/react": stub,
    },
  },
  server: { host: "127.0.0.1", port: 4174, strictPort: true },
});

await server.listen();
const base = "http://127.0.0.1:4174/";

const browser = await chromium.launch({
  headless: true,
  executablePath:
    process.env.PLAYWRIGHT_CHROMIUM_PATH ?? "/usr/bin/google-chrome",
});

const results = [];

async function runCase(name, width, interact) {
  const page = await browser.newPage({ viewport: { width, height: 800 } });
  const focusLog = [];
  await page.exposeFunction("reportFocus", (info) => {
    focusLog.push(info);
  });
  await page.addInitScript(() => {
    document.addEventListener(
      "focusin",
      (event) => {
        const el = event.target;
        if (!(el instanceof HTMLElement)) return;
        void window.reportFocus({
          t: Date.now(),
          text: (el.innerText ?? "").slice(0, 80),
          role: el.getAttribute("role") ?? el.tagName,
          label: el.getAttribute("aria-label") ?? "",
        });
      },
      true,
    );
  });
  await page.goto(base, { waitUntil: "networkidle" });
  try {
    await interact(page);
    const heading = page.getByRole("heading", {
      name: "Start Psalm 46:10 over?",
    });
    await heading.waitFor({ state: "visible", timeout: 5000 });
    await page.waitForTimeout(250);
    const stillOpen = await heading.isVisible();
    const menuOpen = await page.locator("[role='menu']").count();
    const shot = `/opt/cursor/artifacts/start-over-${name}-${width}.png`;
    await page.screenshot({ path: shot, fullPage: true });
    results.push({
      name,
      width,
      stillOpen,
      menuOpen,
      screenshot: shot,
      focus: focusLog.slice(-8),
    });
    if (!stillOpen) {
      throw new Error(`${name} @${width} closed after 250ms`);
    }
  } catch (error) {
    results.push({
      name,
      width,
      stillOpen: false,
      menuOpen: await page.locator("[role='menu']").count(),
      focus: focusLog.slice(-8),
      error: String(error),
      body: (await page.locator("body").innerText()).slice(0, 400),
    });
    throw error;
  }
  await page.close();
}

try {
  for (const width of [1280, 390]) {
    await runCase(`mouse-open`, width, async (page) => {
      await page.getByRole("button", { name: "More actions" }).click();
      await page.getByRole("menuitem", { name: /Start over/ }).click();
    });

    await runCase(`keyboard-open`, width, async (page) => {
      const more = page.getByRole("button", { name: "More actions" });
      await more.focus();
      await page.keyboard.press("Enter");
      const item = page.getByRole("menuitem", { name: /Start over/ });
      await item.waitFor({ state: "visible" });
      await item.focus();
      await page.keyboard.press("Enter");
    });

    await runCase(`cancel-reopen`, width, async (page) => {
      await page.getByRole("button", { name: "More actions" }).click();
      await page.getByRole("menuitem", { name: /Start over/ }).click();
      await page
        .getByRole("heading", { name: "Start Psalm 46:10 over?" })
        .waitFor();
      await page.getByRole("button", { name: "Cancel" }).click();
      await page
        .getByRole("heading", { name: "Start Psalm 46:10 over?" })
        .waitFor({ state: "hidden" });
      await page.getByRole("button", { name: "More actions" }).click();
      await page.getByRole("menuitem", { name: /Start over/ }).click();
    });
  }
  console.log(JSON.stringify({ ok: true, results }, null, 2));
} catch (error) {
  console.error(
    JSON.stringify({ ok: false, results, error: String(error) }, null, 2),
  );
  process.exitCode = 1;
} finally {
  await browser.close();
  await server.close();
}
