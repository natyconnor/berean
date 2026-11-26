import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DESKTOP_AUTH_REDIRECT_PATH,
  isBereanDesktop,
  isMacBrowser,
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

const MAC_SAFARI_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15";
const WINDOWS_CHROME_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const IPHONE_SAFARI_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";

describe("isMacBrowser", () => {
  it("is true for a Mac browser", () => {
    vi.stubGlobal("navigator", { userAgent: MAC_SAFARI_UA });
    expect(isMacBrowser()).toBe(true);
  });

  it("is false on Windows and on an iPhone", () => {
    vi.stubGlobal("navigator", { userAgent: WINDOWS_CHROME_UA });
    expect(isMacBrowser()).toBe(false);
    vi.stubGlobal("navigator", { userAgent: IPHONE_SAFARI_UA });
    expect(isMacBrowser()).toBe(false);
  });

  it("is false when the platform can't be read", () => {
    vi.stubGlobal("navigator", undefined);
    expect(isMacBrowser()).toBe(false);
    vi.stubGlobal("navigator", {});
    expect(isMacBrowser()).toBe(false);
  });

  it("is false inside the Mac app", () => {
    vi.stubGlobal("navigator", { userAgent: MAC_SAFARI_UA });
    window.bereanDesktop = { isDesktop: true, platform: "darwin" };
    expect(isMacBrowser()).toBe(false);
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
