import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { resolveAppPath } from "../../shared/http-routes";

const ROOT = process.cwd();
const indexHtml = new DOMParser().parseFromString(
  fs.readFileSync(path.join(ROOT, "index.html"), "utf8"),
  "text/html",
);

type ManifestIcon = {
  src: string;
  sizes: string;
  type: string;
  purpose: string;
};
type Manifest = {
  name: string;
  short_name: string;
  start_url: string;
  display: string;
  icons: ManifestIcon[];
};

function publicFile(href: string): string {
  return path.join(ROOT, "public", href);
}

/** Width and height from a PNG's IHDR chunk. */
function pngSize(file: string): string {
  const bytes = fs.readFileSync(file);
  expect(bytes.subarray(1, 4).toString("ascii")).toBe("PNG");
  return `${bytes.readUInt32BE(16)}x${bytes.readUInt32BE(20)}`;
}

describe("PWA manifest", () => {
  const manifestHref = indexHtml
    .querySelector('link[rel="manifest"]')
    ?.getAttribute("href");

  it("is linked from index.html and served as a file", () => {
    expect(manifestHref).toBe("/manifest.webmanifest");
    expect(resolveAppPath("/manifest.webmanifest")).toEqual({
      type: "static-file",
    });
  });

  const manifest = JSON.parse(
    fs.readFileSync(publicFile("manifest.webmanifest"), "utf8"),
  ) as Manifest;

  it("installs as a standalone Berean app starting at /", () => {
    expect(manifest.name).toBe("Berean");
    expect(manifest.short_name).toBe("Berean");
    expect(manifest.start_url).toBe("/");
    expect(manifest.display).toBe("standalone");
  });

  it("has 192 and 512 icons, plus a maskable one, that exist at those sizes", () => {
    const sizes = manifest.icons.map((icon) => icon.sizes);
    expect(sizes).toEqual(expect.arrayContaining(["192x192", "512x512"]));
    expect(manifest.icons.some((icon) => icon.purpose === "maskable")).toBe(
      true,
    );
    for (const icon of manifest.icons) {
      expect(icon.src.startsWith("/icons/")).toBe(true);
      expect(icon.type).toBe("image/png");
      expect(pngSize(publicFile(icon.src))).toBe(icon.sizes);
    }
  });

  it("links an iOS home-screen icon that exists", () => {
    const href = indexHtml
      .querySelector('link[rel="apple-touch-icon"]')
      ?.getAttribute("href");
    expect(href).toBe("/icons/apple-touch-icon.png");
    expect(pngSize(publicFile(href ?? ""))).toBe("180x180");
    expect(
      indexHtml
        .querySelector('meta[name="apple-mobile-web-app-capable"]')
        ?.getAttribute("content"),
    ).toBe("yes");
  });

  it("registers no service worker", () => {
    const sources = fs
      .readdirSync(path.join(ROOT, "src"), { recursive: true })
      .map(String)
      .filter((file) => /\.(ts|tsx)$/.test(file) && !file.includes(".test."));
    for (const file of sources) {
      const text = fs.readFileSync(path.join(ROOT, "src", file), "utf8");
      expect(text, file).not.toMatch(/serviceWorker\.register/);
    }
  });
});
