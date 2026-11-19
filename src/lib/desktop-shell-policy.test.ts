import { describe, expect, it } from "vitest";
import {
  isAllowedFrameUrl,
  isConvexSignInUrl,
  isSameOrigin,
  isSignInPending,
  SIGN_IN_WINDOW_MS,
  signInCodeTarget,
} from "../../electron/shell-policy";

const APP = "https://berean.nathanconnor.dev";

describe("isConvexSignInUrl", () => {
  it("matches Convex Auth's sign-in start on any deployment", () => {
    expect(
      isConvexSignInUrl(
        "https://happy-otter-123.convex.site/api/auth/signin/google?code=x",
      ),
    ).toBe(true);
  });

  it.each([
    ["another path", "https://happy-otter-123.convex.site/api/auth/callback"],
    [
      "the cloud host",
      "https://happy-otter-123.convex.cloud/api/auth/signin/g",
    ],
    ["a lookalike host", "https://evil-convex.site/api/auth/signin/google"],
    ["a suffix trick", "https://a.convex.site.evil.com/api/auth/signin/google"],
    ["plain http", "http://happy-otter-123.convex.site/api/auth/signin/google"],
    ["the app", `${APP}/api/auth/signin/google`],
    ["Google itself", "https://accounts.google.com/o/oauth2/v2/auth"],
    ["not a URL", "not a url"],
  ])("rejects %s", (_label, url) => {
    expect(isConvexSignInUrl(url)).toBe(false);
  });
});

describe("isSignInPending", () => {
  const pending = { contents: {}, startedAt: 1_000 };

  it("is false when nothing is pending", () => {
    expect(isSignInPending(null, 1_000)).toBe(false);
  });

  it("lasts ten minutes", () => {
    expect(SIGN_IN_WINDOW_MS).toBe(10 * 60 * 1000);
    expect(isSignInPending(pending, 1_000)).toBe(true);
    expect(isSignInPending(pending, 1_000 + SIGN_IN_WINDOW_MS)).toBe(true);
    expect(isSignInPending(pending, 1_001 + SIGN_IN_WINDOW_MS)).toBe(false);
  });
});

describe("signInCodeTarget", () => {
  const win = { id: "sign-in window" };
  const pending = { contents: win, startedAt: 1_000 };

  it("ignores a code when no sign-in was started", () => {
    expect(signInCodeTarget(null, 1_000)).toBeNull();
  });

  it("sends a code to the window that started sign-in", () => {
    expect(signInCodeTarget(pending, 2_000)).toBe(win);
  });

  it("is not used up by a code: a later code in the window still goes through", () => {
    // "Open browser again", then the older tab finishes first: its code
    // fails, and the newer tab's code must still reach the window.
    expect(signInCodeTarget(pending, 2_000)).toBe(win);
    expect(signInCodeTarget(pending, 60_000)).toBe(win);
    expect(signInCodeTarget(pending, 1_000 + SIGN_IN_WINDOW_MS)).toBe(win);
    expect(pending).toEqual({ contents: win, startedAt: 1_000 });
  });

  it("ignores every code once ten minutes have passed", () => {
    expect(signInCodeTarget(pending, 1_001 + SIGN_IN_WINDOW_MS)).toBeNull();
  });
});

describe("isSameOrigin", () => {
  it("compares origins exactly", () => {
    expect(isSameOrigin(`${APP}/passage/John-1`, APP)).toBe(true);
    expect(isSameOrigin("http://berean.nathanconnor.dev/", APP)).toBe(false);
    expect(isSameOrigin(`${APP}.evil.com/`, APP)).toBe(false);
    expect(isSameOrigin(`https://evil.com@berean.nathanconnor.dev/`, APP)).toBe(
      true,
    );
    expect(isSameOrigin("garbage", APP)).toBe(false);
  });
});

describe("isAllowedFrameUrl", () => {
  it.each([`${APP}/x`, "about:blank", "about:srcdoc"])("allows %s", (url) => {
    expect(isAllowedFrameUrl(url, APP)).toBe(true);
  });

  it.each([
    "https://example.com/",
    "data:text/html,hi",
    "javascript:alert(1)",
    "about:blank#x",
    "file:///etc/passwd",
  ])("blocks %s", (url) => {
    expect(isAllowedFrameUrl(url, APP)).toBe(false);
  });

  it("decides redirect targets the same way (main.ts will-redirect)", () => {
    expect(isAllowedFrameUrl(`${APP}/after-redirect`, APP)).toBe(true);
    expect(isAllowedFrameUrl("https://example.com/after-redirect", APP)).toBe(
      false,
    );
    expect(isAllowedFrameUrl("http://berean.nathanconnor.dev/x", APP)).toBe(
      false,
    );
  });
});
