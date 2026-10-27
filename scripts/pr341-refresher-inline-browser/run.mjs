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
      { find: "@/hooks/use-esv-composite-passage", replacement: stub },
      { find: "@/hooks/use-esv-reference", replacement: stub },
      { find: "@/hooks/use-live-now", replacement: stub },
      {
        find: /use-verse-practice-attempt$/,
        replacement: stub,
      },
      { find: /use-milestone-hint$/, replacement: stub },
      { find: /convex\/_generated\/api$/, replacement: stub },
      { find: "@tanstack/react-router", replacement: stub },
      { find: "convex/react", replacement: stub },
      { find: "convex-helpers/react/cache", replacement: stub },
      { find: "@", replacement: path.join(repo, "src") },
    ],
  },
  define: {
    __IS_PREVIEW__: "false",
  },
  server: { host: "127.0.0.1", port: 4176, strictPort: true },
});

await server.listen();
const base = "http://127.0.0.1:4176/";

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
  page.on("console", (msg) => {
    if (msg.type() === "error") pageErrors.push(msg.text());
  });
  const response = await page.goto(`${base}?${search}`, {
    waitUntil: "networkidle",
  });
  await page.waitForTimeout(400);
  page._pageErrors = pageErrors;
  page._status = response?.status() ?? 0;
  return page;
}

function fail(message) {
  throw new Error(message);
}

async function typeAndCheck(page, text) {
  const answer = page.locator("textarea").first();
  await answer.click();
  await answer.fill(text);
  await page.getByRole("button", { name: /Check answer/ }).click();
}

async function measureResult(page) {
  return page.evaluate(() => {
    const header = document.querySelector("header");
    const banner = document.querySelector("[data-result-banner]");
    const status = document.querySelector('[role="status"]');
    const pct = Array.from(document.querySelectorAll("p")).find((node) =>
      /%\s*recalled/.test(node.textContent ?? ""),
    );
    const offers = Array.from(document.querySelectorAll("button")).filter(
      (button) => (button.textContent ?? "").includes("Need a refresher?"),
    );
    const footer = document.querySelector('[data-slot="card-footer"]');
    const continueBtn = Array.from(
      footer?.querySelectorAll("button") ?? [],
    ).find((button) => (button.textContent ?? "").includes("Continue"));
    const headerBox = header?.getBoundingClientRect();
    const bannerBox = banner?.getBoundingClientRect();
    const pctBox = pct?.getBoundingClientRect();
    const link = offers[0];
    const linkBox = link?.getBoundingClientRect();
    const continueBox = continueBtn?.getBoundingClientRect();
    const footerText = footer?.textContent ?? "";
    const style = link ? getComputedStyle(link) : null;
    return {
      offerCount: offers.length,
      footerHasOffer: footerText.includes("Need a refresher?"),
      statusHasOffer: (status?.textContent ?? "").includes("Need a refresher?"),
      headerBottom: headerBox?.bottom ?? 0,
      bannerTop: bannerBox?.top ?? null,
      bannerHeight: bannerBox?.height ?? null,
      pctTop: pctBox?.top ?? null,
      pctText: pct?.textContent ?? "",
      linkTop: linkBox?.top ?? null,
      linkBottom: linkBox?.bottom ?? null,
      linkHeight: linkBox?.height ?? null,
      linkVisible: style ? style.visibility !== "hidden" : false,
      continueWidth: continueBox?.width ?? null,
      continueTop: continueBox?.top ?? null,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      scrollWidth: document.documentElement.scrollWidth,
      firstLetters: document.body.innerText.includes("First letters"),
    };
  });
}

async function assertBannerLayout(label, page, width, expectVisible) {
  const metrics = await measureResult(page);
  const sameRow =
    metrics.linkTop != null && metrics.pctTop != null
      ? Math.abs(metrics.linkTop - metrics.pctTop)
      : null;
  const inViewport =
    metrics.linkTop != null &&
    metrics.linkBottom != null &&
    metrics.linkTop >= metrics.headerBottom - 0.5 &&
    metrics.linkBottom <= metrics.viewportHeight + 0.5 &&
    metrics.linkTop >= 0;
  const checks = {
    oneOffer: metrics.offerCount === 1,
    footerContinueOnly: metrics.footerHasOffer === false,
    statusExcludesOffer: metrics.statusHasOffer === false,
    belowHeader: inViewport,
    nearPct: sameRow != null && sameRow <= 40,
    sameRow: sameRow != null && sameRow <= 8,
    visible: metrics.linkVisible === expectVisible,
    noHScroll: metrics.scrollWidth <= metrics.viewportWidth + 1,
    tapTarget: width !== 390 || (metrics.linkHeight ?? 0) >= 44,
    continueFullWidth:
      width !== 390 ||
      (metrics.continueWidth ?? 0) >= metrics.viewportWidth - 80,
  };
  const failed = Object.entries(checks)
    .filter(([, ok]) => !ok)
    .map(([name]) => name);
  return { label, width, ...metrics, sameRow, checks, failed };
}

async function runViewport(width, height) {
  const shots = [];

  const delayPage = await openPage(`case=verse&delay=700`, width, height);
  await typeAndCheck(delayPage, "nope");
  await delayPage.waitForTimeout(80);
  const saving = await assertBannerLayout(
    `${width}-verse-saving`,
    delayPage,
    width,
    false,
  );
  const savingHeight = saving.bannerHeight;
  const savingShot = path.join(artifacts, `qa6-${width}-verse-saving.png`);
  await delayPage.screenshot({ path: savingShot, fullPage: false });
  shots.push(savingShot);
  await delayPage.waitForTimeout(800);
  const saved = await assertBannerLayout(
    `${width}-verse-0pct`,
    delayPage,
    width,
    true,
  );
  if (
    savingHeight != null &&
    saved.bannerHeight != null &&
    Math.abs(savingHeight - saved.bannerHeight) > 1
  ) {
    saved.failed = [
      ...saved.failed,
      `bannerShift ${savingHeight}->${saved.bannerHeight}`,
    ];
  }
  const savedShot = path.join(artifacts, `qa6-${width}-verse-0pct.png`);
  await delayPage.screenshot({ path: savedShot, fullPage: false });
  shots.push(savedShot);

  await delayPage.getByRole("button", { name: /Continue/ }).focus();
  await delayPage.keyboard.down("Shift");
  await delayPage.keyboard.press("Tab");
  await delayPage.keyboard.up("Shift");
  const shiftTab = await delayPage.evaluate(
    () => document.activeElement?.textContent ?? "",
  );
  if (!shiftTab.includes("Need a refresher?")) {
    saved.failed = [...saved.failed, `shiftTab=${shiftTab}`];
  }

  await delayPage.keyboard.press("Enter");
  await delayPage.waitForTimeout(300);
  const afterOffer = await delayPage.evaluate(() => ({
    firstLetters: document.body.innerText.includes("First letters"),
    focused: document.activeElement?.getAttribute("aria-label") ?? "",
  }));
  if (
    !afterOffer.firstLetters ||
    !/recalled|recited/i.test(afterOffer.focused)
  ) {
    saved.failed = [...saved.failed, `activate=${JSON.stringify(afterOffer)}`];
  }
  const afterOfferShot = path.join(
    artifacts,
    `qa6-${width}-verse-after-offer.png`,
  );
  await delayPage.screenshot({ path: afterOfferShot, fullPage: false });
  shots.push(afterOfferShot);
  await delayPage.close();

  const enterPage = await openPage("case=verse", width, height);
  await typeAndCheck(enterPage, "nope");
  await enterPage.getByRole("button", { name: /Continue/ }).waitFor();
  await enterPage.getByRole("button", { name: /Continue/ }).focus();
  await enterPage.keyboard.press("Enter");
  await enterPage.waitForTimeout(400);
  const afterEnter = await enterPage.evaluate(
    () => document.body.innerText.includes("Need a refresher?") === false,
  );
  if (!afterEnter) {
    saved.failed = [...saved.failed, "enterDidNotContinue"];
  }
  const enterShot = path.join(artifacts, `qa6-${width}-verse-enter.png`);
  await enterPage.screenshot({ path: enterShot, fullPage: false });
  shots.push(enterShot);
  await enterPage.close();

  async function scoreCase(answer, expectOffer, tag) {
    const page = await openPage("case=verse", width, height);
    await typeAndCheck(page, answer);
    await page.waitForTimeout(400);
    const offerVisible = await page.evaluate(() =>
      Array.from(document.querySelectorAll("button")).some((button) => {
        if (!(button.textContent ?? "").includes("Need a refresher?")) {
          return false;
        }
        return getComputedStyle(button).visibility !== "hidden";
      }),
    );
    const pct = await page.evaluate(() => {
      const node = Array.from(document.querySelectorAll("p")).find((item) =>
        /%\s*recalled/.test(item.textContent ?? ""),
      );
      return node?.textContent ?? "";
    });
    const shot = path.join(artifacts, `qa6-${width}-verse-${tag}.png`);
    await page.screenshot({ path: shot, fullPage: false });
    shots.push(shot);
    await page.close();
    return {
      tag,
      pct,
      offerVisible,
      failed:
        offerVisible === expectOffer
          ? []
          : [`offerVisible=${offerVisible} expected ${expectOffer}`],
    };
  }

  const mid = await scoreCase("Your word is a lamp", true, "34pct");
  const hold = await scoreCase(
    "Your word is a lamp to my feet and a",
    false,
    "60pct",
  );
  const strong = await scoreCase(
    "Your word is a lamp to my feet and a light to my",
    false,
    "85pct",
  );

  const passage = await openPage("case=passage", width, height);
  await typeAndCheck(passage, "nope");
  await passage.getByRole("button", { name: "Need a refresher?" }).waitFor();
  const passageLayout = await assertBannerLayout(
    `${width}-passage-0pct`,
    passage,
    width,
    true,
  );
  const passageShot = path.join(artifacts, `qa6-${width}-passage-0pct.png`);
  await passage.screenshot({ path: passageShot, fullPage: false });
  shots.push(passageShot);

  await passage.getByRole("button", { name: /Continue/ }).focus();
  await passage.keyboard.down("Shift");
  await passage.keyboard.press("Tab");
  await passage.keyboard.up("Shift");
  const passageShift = await passage.evaluate(
    () => document.activeElement?.textContent ?? "",
  );
  if (!passageShift.includes("Need a refresher?")) {
    passageLayout.failed = [
      ...passageLayout.failed,
      `shiftTab=${passageShift}`,
    ];
  }
  await passage.getByRole("button", { name: "Need a refresher?" }).click();
  await passage.waitForTimeout(250);
  const passageAfter = await passage.evaluate(() => ({
    firstLetters: document.body.innerText.includes("First letters"),
    focused: document.activeElement?.getAttribute("aria-label") ?? "",
    body: document.body.innerText.slice(0, 400),
  }));
  if (
    !passageAfter.firstLetters ||
    !/recited passage/i.test(passageAfter.focused)
  ) {
    passageLayout.failed = [
      ...passageLayout.failed,
      `activate=${JSON.stringify(passageAfter)}`,
    ];
  }
  const passageOfferShot = path.join(
    artifacts,
    `qa6-${width}-passage-after-offer.png`,
  );
  await passage.screenshot({ path: passageOfferShot, fullPage: false });
  shots.push(passageOfferShot);

  await typeAndCheck(passage, "nope");
  await passage.waitForTimeout(300);
  const afterRefresher = await passage.evaluate(() =>
    Array.from(document.querySelectorAll("button")).some((button) => {
      if (!(button.textContent ?? "").includes("Need a refresher?")) {
        return false;
      }
      return getComputedStyle(button).visibility !== "hidden";
    }),
  );
  if (afterRefresher) {
    passageLayout.failed = [...passageLayout.failed, "offerAfterRefresher"];
  }
  const afterRefresherShot = path.join(
    artifacts,
    `qa6-${width}-passage-after-refresher-miss.png`,
  );
  await passage.screenshot({ path: afterRefresherShot, fullPage: false });
  shots.push(afterRefresherShot);
  await passage.close();

  return {
    width,
    height,
    saving,
    saved,
    mid,
    hold,
    strong,
    passageLayout,
    shots,
    failed: [
      ...saving.failed.filter((name) => name !== "visible"),
      ...saved.failed,
      ...mid.failed,
      ...hold.failed,
      ...strong.failed,
      ...passageLayout.failed,
    ],
  };
}

try {
  const viewports = [
    { width: 1280, height: 800 },
    { width: 390, height: 844 },
  ];
  for (const viewport of viewports) {
    const result = await runViewport(viewport.width, viewport.height);
    results.push(result);
    if (result.failed.length > 0) {
      fail(`@${viewport.width}: ${result.failed.join(", ")}`);
    }
  }
  const logPath = path.join(artifacts, "pr341-refresher-inline-browser.json");
  fs.writeFileSync(logPath, JSON.stringify({ ok: true, results }, null, 2));
  console.log(JSON.stringify({ ok: true, logPath }, null, 2));
} catch (error) {
  const logPath = path.join(artifacts, "pr341-refresher-inline-browser.json");
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
