import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DESKTOP_AUTH_REDIRECT_PATH } from "./desktop-platform";
import {
  shouldHandleSignInCode,
  startDesktopSignInAttempt,
} from "./desktop-sign-in-attempt";

function attemptFrom(redirectTo: string): string {
  const url = new URL(redirectTo, "http://localhost");
  const attempt = url.searchParams.get("signInAttempt");
  if (attempt === null) throw new Error("no attempt in redirectTo");
  return attempt;
}

/** What the shell loads after the browser hands a code back. */
function landWith(search: string, path = "/passage/John-1") {
  window.history.replaceState(null, "", `${path}${search}#v3`);
}

function currentUrl(): string {
  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  delete window.bereanDesktop;
  window.localStorage.clear();
  window.history.replaceState(null, "", "/");
});

describe("startDesktopSignInAttempt", () => {
  it("returns the hand-back page with a fresh attempt id each time", () => {
    const first = startDesktopSignInAttempt();
    const second = startDesktopSignInAttempt();

    expect(new URL(first, "http://localhost").pathname).toBe(
      DESKTOP_AUTH_REDIRECT_PATH,
    );
    expect(attemptFrom(first)).toMatch(/^[A-Za-z0-9_-]{16,64}$/);
    expect(attemptFrom(second)).not.toBe(attemptFrom(first));
  });

  it("is a redirectTo Convex Auth accepts (starts with a single /)", () => {
    const redirectTo = startDesktopSignInAttempt();
    expect(redirectTo.startsWith("/")).toBe(true);
    expect(redirectTo.startsWith("//")).toBe(false);
  });
});

describe("shouldHandleSignInCode on the web", () => {
  it("keeps Convex Auth's default, even with an attempt id", () => {
    landWith("?code=abc&signInAttempt=0f8fad5b-d9cb-469f-a165-70867728950e");
    expect(shouldHandleSignInCode()).toBe(true);
    expect(currentUrl()).toBe(
      "/passage/John-1?code=abc&signInAttempt=0f8fad5b-d9cb-469f-a165-70867728950e#v3",
    );
  });
});

describe("shouldHandleSignInCode in the desktop app", () => {
  beforeEach(() => {
    window.bereanDesktop = { isDesktop: true, platform: "darwin" };
  });

  it("redeems the latest attempt's code once and strips the attempt id", () => {
    const attempt = attemptFrom(startDesktopSignInAttempt());
    landWith(`?x=1&code=abc&signInAttempt=${attempt}`);

    expect(shouldHandleSignInCode()).toBe(true);
    // Convex Auth removes `code` itself after this returns true.
    expect(currentUrl()).toBe("/passage/John-1?x=1&code=abc#v3");

    // The same link again (the hand-back page opened Berean twice).
    landWith(`?x=1&code=abc&signInAttempt=${attempt}`);
    expect(shouldHandleSignInCode()).toBe(false);
    expect(currentUrl()).toBe("/passage/John-1?x=1#v3");
  });

  it("after Open browser again, ignores the older tab and redeems the newer one", () => {
    const older = attemptFrom(startDesktopSignInAttempt());
    const newer = attemptFrom(startDesktopSignInAttempt());

    landWith(`?code=from-older-tab&signInAttempt=${older}`);
    expect(shouldHandleSignInCode()).toBe(false);
    expect(currentUrl()).toBe("/passage/John-1#v3");

    landWith(`?code=from-newer-tab&signInAttempt=${newer}`);
    expect(shouldHandleSignInCode()).toBe(true);
  });

  it("ignores the older tab after the newer one already signed in", () => {
    const older = attemptFrom(startDesktopSignInAttempt());
    const newer = attemptFrom(startDesktopSignInAttempt());

    landWith(`?code=from-newer-tab&signInAttempt=${newer}`);
    expect(shouldHandleSignInCode()).toBe(true);

    landWith(`?code=from-older-tab&signInAttempt=${older}`);
    expect(shouldHandleSignInCode()).toBe(false);
  });

  it("ignores a code whose attempt was never started here", () => {
    landWith("?code=abc&signInAttempt=0f8fad5b-d9cb-469f-a165-70867728950e");
    expect(shouldHandleSignInCode()).toBe(false);
    expect(currentUrl()).toBe("/passage/John-1#v3");
  });

  it("redeems a code that carries no attempt id (older hand-back page)", () => {
    startDesktopSignInAttempt();
    landWith("?code=abc");
    expect(shouldHandleSignInCode()).toBe(true);
    expect(currentUrl()).toBe("/passage/John-1?code=abc#v3");
  });
});
