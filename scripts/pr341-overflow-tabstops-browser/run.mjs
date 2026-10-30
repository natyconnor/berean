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
    alias: [
      {
        find: "@/hooks/use-esv-composite-passage",
        replacement: stub,
      },
      { find: "@tanstack/react-router", replacement: stub },
      { find: "convex/react", replacement: stub },
      { find: "convex-helpers/react/cache", replacement: stub },
      { find: "@", replacement: path.join(repo, "src") },
    ],
  },
  define: {
    __IS_PREVIEW__: "false",
  },
  server: { host: "127.0.0.1", port: 4177, strictPort: true },
});

await server.listen();
const base = "http://127.0.0.1:4177/";

const browser = await chromium.launch({
  headless: true,
  executablePath:
    process.env.PLAYWRIGHT_CHROMIUM_PATH ?? "/usr/bin/google-chrome",
});

const results = [];

async function openPage(search, width, height) {
  const page = await browser.newPage({ viewport: { width, height } });
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(String(error)));
  const response = await page.goto(`${base}?case=${search}`, {
    waitUntil: "domcontentloaded",
  });
  await page.waitForTimeout(800);
  const jsErrors = pageErrors.filter(
    (error) => !error.includes("404") && !error.includes("favicon"),
  );
  if (jsErrors.length > 0) {
    throw new Error(`page errors: ${jsErrors.join(" | ")}`);
  }
  page._status = response?.status() ?? 0;
  return page;
}

async function typeAndCheck(page, text) {
  const answer = page.locator("textarea").first();
  await answer.click();
  await answer.fill(text);
  await page.getByRole("button", { name: /Check answer/ }).click();
  await page.getByRole("button", { name: /Continue/ }).waitFor();
}

async function focusContinue(page) {
  const continueBtn = page.getByRole("button", { name: /Continue/ });
  const already = await page.evaluate(() => {
    const active = document.activeElement;
    return (active?.textContent ?? "").includes("Continue");
  });
  if (!already) {
    await continueBtn.focus();
  }
  return page.evaluate(() => ({
    focused: document.activeElement?.textContent?.trim() ?? "",
    tag: document.activeElement?.tagName ?? "",
  }));
}

async function shiftTab(page) {
  await page.keyboard.down("Shift");
  await page.keyboard.press("Tab");
  await page.keyboard.up("Shift");
  return page.evaluate(() => {
    const active = document.activeElement;
    return {
      text: (active?.textContent ?? "").trim().slice(0, 80),
      scroll: active?.getAttribute("data-result-scroll") ?? null,
      tabindex: active?.getAttribute("tabindex"),
    };
  });
}

async function regionState(page) {
  return page.evaluate(() => {
    const regions = [...document.querySelectorAll("[data-result-scroll]")].map(
      (node) => {
        const overflowing =
          node.scrollHeight > node.clientHeight ||
          node.scrollWidth > node.clientWidth;
        return {
          name: node.getAttribute("data-result-scroll"),
          tabindex: node.getAttribute("tabindex"),
          overflowing,
          scrollHeight: node.scrollHeight,
          clientHeight: node.clientHeight,
        };
      },
    );
    const buttons = [...document.querySelectorAll("button")].map((button) =>
      (button.textContent ?? "").trim(),
    );
    const offer = buttons.find((label) => label.includes("Need a refresher?"));
    const order = [];
    if (offer) order.push("Need a refresher?");
    for (const region of regions) {
      if (region.tabindex === "0") order.push(region.name);
    }
    if (buttons.some((label) => label.includes("Continue"))) {
      order.push("Continue");
    }
    return {
      regions,
      tabOrder: order,
      focused: document.activeElement?.textContent?.trim().slice(0, 80) ?? "",
    };
  });
}

try {
  const width = 1280;
  const height = 800;

  const shortPage = await openPage("short", width, height);
  await typeAndCheck(shortPage, "nope");
  const shortFocus = await focusContinue(shortPage);
  const shortAfterShift = await shiftTab(shortPage);
  const shortState = await regionState(shortPage);
  const shortShot = path.join(artifacts, "qa-tab-1280-short-shift.png");
  await shortPage.screenshot({ path: shortShot, fullPage: false });
  const shortOk =
    shortFocus.focused.includes("Continue") &&
    shortAfterShift.text.includes("Need a refresher?") &&
    shortState.regions.every((region) => region.tabindex === null);
  results.push({
    item: 1,
    shortFocus,
    shortAfterShift,
    shortState,
    shortShot,
    ok: shortOk,
  });
  await shortPage.close();
  if (!shortOk) {
    throw new Error(
      `item 1: focus=${shortFocus.focused} shiftTab=${shortAfterShift.text} tabindex=${JSON.stringify(shortState.regions)}`,
    );
  }

  const passagePage = await openPage("passage", width, height);
  await typeAndCheck(passagePage, "nope");
  await focusContinue(passagePage);
  const passageState = await regionState(passagePage);
  const overflowing = passageState.regions.filter(
    (region) => region.overflowing,
  );
  const notOverflowing = passageState.regions.filter(
    (region) => !region.overflowing,
  );
  const passageOrderOk =
    passageState.tabOrder[0] === "Need a refresher?" &&
    passageState.tabOrder.at(-1) === "Continue" &&
    overflowing.every((region) => region.tabindex === "0") &&
    notOverflowing.every((region) => region.tabindex === null);
  if (overflowing.length === 0) {
    throw new Error(
      `item 2: expected Full text or How you did to overflow at 1280x800: ${JSON.stringify(passageState.regions)}`,
    );
  }
  await focusContinue(passagePage);
  const passageShift = await shiftTab(passagePage);
  const lastOverflow = overflowing.at(-1)?.name;
  const passageShiftOk = passageShift.scroll === lastOverflow;
  const passageShot = path.join(artifacts, "qa-tab-1280-passage-order.png");
  await passagePage.screenshot({ path: passageShot, fullPage: false });
  results.push({
    item: 2,
    passageState,
    passageShift,
    lastOverflow,
    passageShot,
    ok: passageOrderOk && passageShiftOk,
  });
  await passagePage.close();
  if (!passageOrderOk || !passageShiftOk) {
    throw new Error(
      `item 2: order=${passageState.tabOrder.join(",")} shift=${JSON.stringify(passageShift)}`,
    );
  }

  const recallPage = await openPage("recall", width, height);
  await typeAndCheck(recallPage, "nope");
  const recallState = await regionState(recallPage);
  const recallOverflow = recallState.regions.filter(
    (region) => region.overflowing,
  );
  const recallStill = recallState.regions.filter(
    (region) => !region.overflowing,
  );
  const recallOk =
    recallState.tabOrder[0] === "Need a refresher?" &&
    recallState.tabOrder.at(-1) === "Continue" &&
    recallOverflow.every((region) => region.tabindex === "0") &&
    recallStill.every((region) => region.tabindex === null);
  const recallShot = path.join(artifacts, "qa-tab-1280-recall-order.png");
  await recallPage.screenshot({ path: recallShot, fullPage: false });
  results.push({ item: "2-recall", recallState, recallShot, ok: recallOk });
  await recallPage.close();
  if (!recallOk) {
    throw new Error(
      `item 2 recall: order=${recallState.tabOrder.join(",")} regions=${JSON.stringify(recallState.regions)}`,
    );
  }

  const resizePage = await openPage("resize", width, height);
  await resizePage.getByRole("button", { name: /Continue/ }).waitFor();
  const tall = await regionState(resizePage);
  await resizePage.setViewportSize({ width, height: 360 });
  await resizePage.waitForTimeout(300);
  const shortView = await regionState(resizePage);
  const continueFocusedBefore = await focusContinue(resizePage);
  await resizePage.setViewportSize({ width, height: 800 });
  await resizePage.waitForTimeout(300);
  const restored = await regionState(resizePage);
  const continueFocusedAfter = await resizePage.evaluate(
    () => document.activeElement?.textContent?.trim() ?? "",
  );
  const gained = shortView.regions.filter(
    (region) =>
      region.overflowing &&
      tall.regions.find((item) => item.name === region.name)?.overflowing ===
        false,
  );
  const resizeOk =
    tall.regions.every((region) =>
      region.overflowing ? region.tabindex === "0" : region.tabindex === null,
    ) &&
    shortView.regions.every((region) =>
      region.overflowing ? region.tabindex === "0" : region.tabindex === null,
    ) &&
    restored.regions.every((region) =>
      region.overflowing ? region.tabindex === "0" : region.tabindex === null,
    ) &&
    continueFocusedBefore.focused.includes("Continue") &&
    continueFocusedAfter.includes("Continue") &&
    (gained.length > 0 ||
      shortView.regions.some((region) => region.overflowing) !==
        tall.regions.some((region) => region.overflowing));
  const resizeShot = path.join(artifacts, "qa-tab-1280-resize.png");
  await resizePage.screenshot({ path: resizeShot, fullPage: false });
  results.push({
    item: 3,
    tall,
    shortView,
    restored,
    continueFocusedBefore,
    continueFocusedAfter,
    gained,
    resizeShot,
    ok: resizeOk,
  });
  await resizePage.close();
  if (!resizeOk) {
    throw new Error(
      `item 3: tall=${JSON.stringify(tall.regions)} short=${JSON.stringify(shortView.regions)} focus=${continueFocusedAfter}`,
    );
  }

  const logPath = path.join(artifacts, "pr341-overflow-tabstops-browser.json");
  fs.writeFileSync(logPath, JSON.stringify({ ok: true, results }, null, 2));
  console.log(JSON.stringify({ ok: true, logPath }, null, 2));
} catch (error) {
  const logPath = path.join(artifacts, "pr341-overflow-tabstops-browser.json");
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
