import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DESKTOP_AUTH_REDIRECT_PATH,
  isBereanDesktop,
  isPwaStandalone,
} from "./desktop-platform";
import { resolveAppPath } from "../../shared/http-routes";

function stubMatchMedia(matchingQuery: string | null) {
  const matchMedia = vi.fn((query: string) => ({
    matches: query === matchingQuery,
    media: query,
  }));
  vi.stubGlobal("matchMedia", matchMedia);
  return matchMedia;
}

function stubNavigatorStandalone(value: boolean | undefined) {
  Object.defineProperty(window.navigator, "standalone", {
    configurable: true,
    value,
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  delete window.bereanDesktop;
  Reflect.deleteProperty(window.navigator, "standalone");
});

describe("isBereanDesktop", () => {
  it("is false in a normal browser", () => {
    expect(isBereanDesktop()).toBe(false);
  });

  it("is true when the preload bridge is present", () => {
    window.bereanDesktop = { isDesktop: true, platform: "darwin" };
    expect(isBereanDesktop()).toBe(true);
  });

  it("is false for a bridge-shaped object that does not claim desktop", () => {
    Object.defineProperty(window, "bereanDesktop", {
      configurable: true,
      writable: true,
      value: { platform: "darwin" },
    });
    expect(isBereanDesktop()).toBe(false);
  });
});

describe("isPwaStandalone", () => {
  it("is false in a browser tab", () => {
    stubMatchMedia(null);
    expect(isPwaStandalone()).toBe(false);
  });

  it("is false when matchMedia is unavailable", () => {
    vi.stubGlobal("matchMedia", undefined);
    expect(isPwaStandalone()).toBe(false);
  });

  it("is true when the display mode is standalone", () => {
    const matchMedia = stubMatchMedia("(display-mode: standalone)");
    expect(isPwaStandalone()).toBe(true);
    expect(matchMedia).toHaveBeenCalledWith("(display-mode: standalone)");
  });

  it("is true for an iOS home-screen app via navigator.standalone", () => {
    stubMatchMedia(null);
    stubNavigatorStandalone(true);
    expect(isPwaStandalone()).toBe(true);
  });

  it("is false when navigator.standalone is false", () => {
    stubMatchMedia(null);
    stubNavigatorStandalone(false);
    expect(isPwaStandalone()).toBe(false);
  });
});

describe("DESKTOP_AUTH_REDIRECT_PATH", () => {
  it("is a root-relative path, which Convex Auth resolves against SITE_URL", () => {
    expect(DESKTOP_AUTH_REDIRECT_PATH.startsWith("/")).toBe(true);
    expect(DESKTOP_AUTH_REDIRECT_PATH.startsWith("//")).toBe(false);
  });

  it("is served as a static file, never as the SPA", () => {
    expect(resolveAppPath(DESKTOP_AUTH_REDIRECT_PATH)).toEqual({
      type: "static-file",
    });
  });
});
