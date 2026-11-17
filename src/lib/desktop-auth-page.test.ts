import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { parseBereanOpenUrl } from "../../shared/desktop-deep-link";
import { resolveAppPath } from "../../shared/http-routes";
import { DESKTOP_AUTH_REDIRECT_PATH } from "./desktop-platform";

/**
 * `public/desktop-auth.html` is a hand-written static page with an inline
 * script. These tests run that script against the page's own markup.
 */

const PAGE_PATH = path.join(process.cwd(), "public/desktop-auth.html");
const pageSource = fs.readFileSync(PAGE_PATH, "utf8");
const page = new DOMParser().parseFromString(pageSource, "text/html");

function loadPage(search: string) {
  window.history.replaceState(
    null,
    "",
    `${DESKTOP_AUTH_REDIRECT_PATH}${search}`,
  );
  document.body.innerHTML = page.body.innerHTML;

  // Scripts set through innerHTML do not run; a fresh element does. The page
  // also navigates to the link by itself, which jsdom cannot do (it prints
  // "Not implemented: navigation"), so only the link is asserted here.
  const script = document.createElement("script");
  script.textContent = page.querySelector("script")?.textContent ?? "";
  document.body.appendChild(script);

  const button = document.getElementById("open-berean");
  if (!(button instanceof HTMLAnchorElement)) {
    throw new Error("Open Berean link not found");
  }
  return {
    message: document.getElementById("message")?.textContent?.trim() ?? "",
    button,
  };
}

afterEach(() => {
  document.body.innerHTML = "";
  window.history.replaceState(null, "", "/");
});

describe("desktop-auth.html", () => {
  it("lives where the desktop sign-in redirect points", () => {
    expect(DESKTOP_AUTH_REDIRECT_PATH).toBe("/desktop-auth.html");
    expect(fs.existsSync(PAGE_PATH)).toBe(true);
    expect(resolveAppPath(DESKTOP_AUTH_REDIRECT_PATH, "?code=abc")).toEqual({
      type: "static-file",
    });
  });

  it("is static: no app bundle, no external resources, not indexed", () => {
    const scripts = Array.from(page.querySelectorAll("script"));
    expect(scripts).toHaveLength(1);
    expect(scripts[0]?.hasAttribute("src")).toBe(false);
    expect(page.querySelector("link")).toBeNull();
    expect(page.getElementById("root")).toBeNull();
    expect(pageSource).not.toMatch(/src\/main\.tsx|\/assets\//);
    expect(
      page.querySelector('meta[name="robots"]')?.getAttribute("content"),
    ).toBe("noindex");
  });

  it("hands a code back to the app through berean://auth", () => {
    const { message, button } = loadPage("?code=abc123");

    expect(button.getAttribute("href")).toBe("berean://auth?code=abc123");
    expect(button.hidden).toBe(false);
    expect(button.textContent).toBe("Open Berean");
    expect(message).toBe("Return to Berean to finish signing in.");
  });

  it("removes the code from the address bar and history", () => {
    loadPage("?code=abc123");

    expect(window.location.pathname).toBe(DESKTOP_AUTH_REDIRECT_PATH);
    expect(window.location.search).toBe("");
  });

  it("leaves the URL alone when there is no code to hand back", () => {
    loadPage("?error=access_denied");

    expect(window.location.search).toBe("?error=access_denied");
  });

  it("builds a link the app's parser accepts, whatever the code contains", () => {
    const code = "a/b+c=d&e f#g";
    const { button } = loadPage(`?code=${encodeURIComponent(code)}`);

    expect(parseBereanOpenUrl(button.getAttribute("href") ?? "")).toEqual({
      kind: "auth",
      code,
    });
  });

  it.each([
    ["no query", ""],
    ["an empty code", "?code="],
    ["an unrelated param", "?error=access_denied"],
    ["an oversized code", `?code=${"a".repeat(513)}`],
  ])("shows the failure message for %s", (_label, search) => {
    const { message, button } = loadPage(search);

    expect(message).toBe(
      "Sign-in didn’t finish. Go back to Berean and try again.",
    );
    expect(button.hidden).toBe(true);
    expect(button.hasAttribute("href")).toBe(false);
  });
});
