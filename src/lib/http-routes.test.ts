import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  APP_ROUTE_PATTERNS,
  PUBLIC_SITEMAP_PATHS,
  canonicalRedirectHref,
  normalizeRouteTreePath,
  publicPageUrl,
  resolveAppPath,
} from "../../shared/http-routes";

function readJson(file: string): unknown {
  return JSON.parse(fs.readFileSync(file, "utf8")) as unknown;
}

describe("resolveAppPath", () => {
  it("treats the issue examples as unknown, static, or canonical redirects", () => {
    expect(resolveAppPath("/this-page-does-not-exist-123")).toEqual({
      type: "not-found",
    });
    expect(resolveAppPath("/api/health")).toEqual({ type: "not-found" });
    expect(resolveAppPath("/robots.txt")).toEqual({ type: "static-file" });
    expect(resolveAppPath("/sitemap.xml")).toEqual({ type: "static-file" });
    expect(resolveAppPath("/favicon.ico")).toEqual({ type: "static-file" });
    expect(resolveAppPath("/privacy/")).toEqual({
      type: "redirect",
      pathname: "/privacy",
    });
    expect(resolveAppPath("/PRIVACY")).toEqual({
      type: "redirect",
      pathname: "/privacy",
    });
    expect(resolveAppPath("/privacy")).toEqual({ type: "serve" });
  });

  it("serves known routes and redirects case or trailing-slash variants", () => {
    expect(resolveAppPath("/")).toEqual({ type: "serve" });
    expect(resolveAppPath("/terms")).toEqual({ type: "serve" });
    expect(resolveAppPath("/Terms/")).toEqual({
      type: "redirect",
      pathname: "/terms",
    });
    expect(resolveAppPath("/search")).toEqual({ type: "serve" });
    expect(resolveAppPath("/SETTINGS/TAGS")).toEqual({
      type: "redirect",
      pathname: "/settings/tags",
    });
    expect(resolveAppPath("/study/new/")).toEqual({
      type: "redirect",
      pathname: "/study/new",
    });
    expect(resolveAppPath("/STUDY/NEW")).toEqual({
      type: "redirect",
      pathname: "/study/new",
    });
  });

  it("prefers static segments over dynamic ids and preserves id casing", () => {
    expect(resolveAppPath("/memory/learn")).toEqual({ type: "serve" });
    expect(resolveAppPath("/MEMORY/LEARN")).toEqual({
      type: "redirect",
      pathname: "/memory/learn",
    });
    expect(resolveAppPath("/memory/AbC123")).toEqual({ type: "serve" });
    expect(resolveAppPath("/Memory/AbC123/")).toEqual({
      type: "redirect",
      pathname: "/memory/AbC123",
    });
    expect(resolveAppPath("/memory/presets/PresetId")).toEqual({
      type: "serve",
    });
    expect(resolveAppPath("/MEMORY/PRESETS/PresetId")).toEqual({
      type: "redirect",
      pathname: "/memory/presets/PresetId",
    });
    expect(resolveAppPath("/study/session_1/learn")).toEqual({
      type: "not-found",
    });
    expect(resolveAppPath("/passage")).toEqual({ type: "not-found" });
    expect(resolveAppPath("/memory/pack/unknown")).toEqual({
      type: "not-found",
    });
  });

  it("does not treat internal double slashes as a route", () => {
    expect(resolveAppPath("/privacy//extra")).toEqual({ type: "not-found" });
    expect(resolveAppPath("/memory//learn")).toEqual({ type: "not-found" });
  });

  it("strips repeated trailing slashes and file trailing slashes", () => {
    expect(resolveAppPath("/privacy///")).toEqual({
      type: "redirect",
      pathname: "/privacy",
    });
    expect(resolveAppPath("/favicon.ico/")).toEqual({
      type: "redirect",
      pathname: "/favicon.ico",
    });
  });
});

describe("canonicalRedirectHref", () => {
  it("keeps the query string and hash when normalizing", () => {
    expect(canonicalRedirectHref("/PRIVACY", "?from=email", "policy")).toBe(
      "/privacy?from=email#policy",
    );
    expect(canonicalRedirectHref("/privacy/", "", "#top")).toBe("/privacy#top");
  });

  it("returns null when the path is already canonical", () => {
    expect(canonicalRedirectHref("/privacy", "?x=1", "")).toBeNull();
    expect(canonicalRedirectHref("/this-page-does-not-exist-123")).toBeNull();
    expect(canonicalRedirectHref("/robots.txt")).toBeNull();
  });
});

describe("route table parity", () => {
  it("matches the generated TanStack route tree", () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "src/routeTree.gen.ts"),
      "utf8",
    );
    const treePaths = [...source.matchAll(/path: '([^']+)'/g)].map((match) =>
      normalizeRouteTreePath(match[1] ?? ""),
    );

    expect([...new Set(treePaths)].sort()).toEqual(
      [...APP_ROUTE_PATTERNS].sort(),
    );
  });

  it("does not catch all paths in vercel.json", () => {
    const parsed = readJson(path.join(process.cwd(), "vercel.json"));
    expect(parsed).toEqual(expect.objectContaining({}));
    if (typeof parsed !== "object" || parsed === null) {
      throw new Error("vercel.json must be an object");
    }
    expect("rewrites" in parsed).toBe(false);
  });

  it("lists only canonical public pages in sitemap files", () => {
    const sitemap = fs.readFileSync(
      path.join(process.cwd(), "public/sitemap.xml"),
      "utf8",
    );
    const robots = fs.readFileSync(
      path.join(process.cwd(), "public/robots.txt"),
      "utf8",
    );

    for (const page of PUBLIC_SITEMAP_PATHS) {
      expect(resolveAppPath(page)).toEqual({ type: "serve" });
      expect(sitemap).toContain(`<loc>${publicPageUrl(page)}</loc>`);
    }

    expect(sitemap).not.toContain("/theme-test");
    expect(sitemap).not.toContain("/memory");
    expect(robots).toContain(
      "Sitemap: https://berean.nathanconnor.dev/sitemap.xml",
    );
    expect(robots).toContain("Allow: /privacy$");
    expect(robots).toContain("Allow: /terms$");
    expect(robots.startsWith("User-agent:")).toBe(true);
  });
});
