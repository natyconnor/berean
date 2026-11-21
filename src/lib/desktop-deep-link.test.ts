import { describe, expect, it } from "vitest";
import {
  parseBereanOpenUrl,
  toAppUrl,
  withAuthCode,
} from "../../shared/desktop-deep-link";
import { CANONICAL_ORIGIN } from "../../shared/http-routes";

function route(pathname: string, search = "", hash = "") {
  return { kind: "route", pathname, search, hash };
}

describe("parseBereanOpenUrl: route links", () => {
  it("parses a passage link", () => {
    expect(parseBereanOpenUrl("berean://passage/John-1")).toEqual(
      route("/passage/John-1"),
    );
  });

  it("accepts the triple-slash form some OSes produce", () => {
    expect(parseBereanOpenUrl("berean:///passage/John-1")).toEqual(
      route("/passage/John-1"),
    );
  });

  it("keeps the query string and hash", () => {
    expect(
      parseBereanOpenUrl("berean://passage/John-1?startVerse=3#note"),
    ).toEqual(route("/passage/John-1", "?startVerse=3", "#note"));
    expect(parseBereanOpenUrl("berean://search?q=grace")).toEqual(
      route("/search", "?q=grace"),
    );
    expect(parseBereanOpenUrl("berean://settings#shortcuts")).toEqual(
      route("/settings", "", "#shortcuts"),
    );
  });

  it("opens the home route for a bare scheme", () => {
    expect(parseBereanOpenUrl("berean://")).toEqual(route("/"));
    expect(parseBereanOpenUrl("berean:///")).toEqual(route("/"));
  });

  it("parses nested and dynamic routes", () => {
    expect(parseBereanOpenUrl("berean://memory/today")).toEqual(
      route("/memory/today"),
    );
    expect(parseBereanOpenUrl("berean://study/AbC123")).toEqual(
      route("/study/AbC123"),
    );
  });

  it("uses the canonical path for case and trailing-slash variants", () => {
    expect(parseBereanOpenUrl("berean://Passage/john-1/")).toEqual(
      route("/passage/John-1"),
    );
    expect(parseBereanOpenUrl("berean://SETTINGS/")).toEqual(
      route("/settings"),
    );
  });

  it("accepts the scheme in any case", () => {
    expect(parseBereanOpenUrl("BEREAN://settings")).toEqual(route("/settings"));
  });
});

describe("parseBereanOpenUrl: auth callback", () => {
  const attempt = "0f8fad5b-d9cb-469f-a165-70867728950e";
  const withAttempt = `&signInAttempt=${attempt}`;

  it("parses the sign-in code and its attempt id", () => {
    expect(
      parseBereanOpenUrl(`berean://auth?code=abc123${withAttempt}`),
    ).toEqual({ kind: "auth", code: "abc123", attempt });
    expect(
      parseBereanOpenUrl(`berean:///auth?code=abc123${withAttempt}`),
    ).toEqual({ kind: "auth", code: "abc123", attempt });
  });

  it("decodes an encoded code", () => {
    expect(
      parseBereanOpenUrl(`berean://auth?code=a%2Fb%3Dc${withAttempt}`),
    ).toEqual({ kind: "auth", code: "a/b=c", attempt });
  });

  it("accepts a code of exactly 512 characters", () => {
    const code = "a".repeat(512);
    expect(
      parseBereanOpenUrl(`berean://auth?code=${code}${withAttempt}`),
    ).toEqual({ kind: "auth", code, attempt });
  });

  it("rejects a missing, empty or oversized code", () => {
    expect(parseBereanOpenUrl("berean://auth")).toBeNull();
    expect(parseBereanOpenUrl(`berean://auth?code=${withAttempt}`)).toBeNull();
    expect(
      parseBereanOpenUrl(`berean://auth?other=1${withAttempt}`),
    ).toBeNull();
    expect(
      parseBereanOpenUrl(`berean://auth?code=${"a".repeat(513)}${withAttempt}`),
    ).toBeNull();
  });

  it("rejects paths below the auth callback", () => {
    expect(
      parseBereanOpenUrl(`berean://auth/extra?code=abc${withAttempt}`),
    ).toBeNull();
  });

  it("rejects a code without an attempt id", () => {
    expect(parseBereanOpenUrl("berean://auth?code=abc123")).toBeNull();
  });

  it.each([
    ["empty", ""],
    ["too short", "abc"],
    ["too long", "a".repeat(65)],
    ["not URL-safe", "0f8fad5b%2Fd9cb%2F469f%2Fa165"],
  ])("rejects an attempt id that is %s", (_label, attempt) => {
    expect(
      parseBereanOpenUrl(`berean://auth?code=abc&signInAttempt=${attempt}`),
    ).toBeNull();
  });
});

describe("parseBereanOpenUrl: rejection", () => {
  it("rejects every other scheme", () => {
    for (const raw of [
      "https://berean.nathanconnor.dev/passage/John-1",
      "http://localhost:5173/passage/John-1",
      "javascript:alert(1)",
      "file:///etc/passwd",
      "data:text/html,<script>alert(1)</script>",
      "bereans://passage/John-1",
      "xberean://passage/John-1",
      " berean://passage/John-1",
      "/passage/John-1",
      "",
    ]) {
      expect(parseBereanOpenUrl(raw), raw).toBeNull();
    }
  });

  it("rejects paths that are not app routes", () => {
    for (const raw of [
      "berean://nope",
      "berean://passage",
      "berean://passage/NotABook-1",
      "berean://passage/John-999",
      "berean://api/health",
      "berean://memory//today",
      "berean://passage/John-1/extra",
    ]) {
      expect(parseBereanOpenUrl(raw), raw).toBeNull();
    }
  });

  it("rejects static files, including the sign-in hand-back page", () => {
    expect(parseBereanOpenUrl("berean://robots.txt")).toBeNull();
    expect(parseBereanOpenUrl("berean://robots.txt/")).toBeNull();
    expect(parseBereanOpenUrl("berean://desktop-auth.html?code=x")).toBeNull();
  });

  it("rejects a passage verse query past the end of the chapter", () => {
    expect(
      parseBereanOpenUrl("berean://passage/John-1?startVerse=999"),
    ).toBeNull();
  });

  it("never treats part of the link as a host", () => {
    for (const raw of [
      "berean://evil.example/passage/John-1",
      "berean://\\evil.example/passage/John-1",
      "berean://\\\\evil.example/settings",
      "berean://user:pass@evil.example/settings",
      "berean:https://evil.example/settings",
      "berean://javascript:alert(1)",
    ]) {
      expect(parseBereanOpenUrl(raw), raw).toBeNull();
    }
  });

  it("resolves dot segments before checking the route", () => {
    expect(parseBereanOpenUrl("berean://settings/../nope")).toBeNull();
    expect(parseBereanOpenUrl("berean://nope/../settings")).toEqual(
      route("/settings"),
    );
  });

  it("rejects absurdly long links", () => {
    expect(
      parseBereanOpenUrl(`berean://search?q=${"a".repeat(5000)}`),
    ).toBeNull();
  });
});

describe("toAppUrl", () => {
  it("joins the origin with the target", () => {
    expect(
      toAppUrl(CANONICAL_ORIGIN, {
        pathname: "/passage/John-1",
        search: "?startVerse=3",
        hash: "#note",
      }),
    ).toBe("https://berean.nathanconnor.dev/passage/John-1?startVerse=3#note");
  });

  it("works with a local override origin, with or without a trailing slash", () => {
    const target = { pathname: "/", search: "", hash: "" };
    expect(toAppUrl("http://localhost:5173", target)).toBe(
      "http://localhost:5173/",
    );
    expect(toAppUrl("http://localhost:5173/", target)).toBe(
      "http://localhost:5173/",
    );
  });

  it("round-trips a parsed link", () => {
    const target = parseBereanOpenUrl("berean://passage/John-1?startVerse=3");
    if (target?.kind !== "route") throw new Error("expected a route target");
    expect(toAppUrl(CANONICAL_ORIGIN, target)).toBe(
      "https://berean.nathanconnor.dev/passage/John-1?startVerse=3",
    );
  });
});

describe("withAuthCode", () => {
  const attempt = "0f8fad5b-d9cb-469f-a165-70867728950e";

  it("adds the code and attempt id to a URL with no query", () => {
    expect(
      withAuthCode("https://berean.nathanconnor.dev/", "abc", attempt),
    ).toBe(
      `https://berean.nathanconnor.dev/?code=abc&signInAttempt=${attempt}`,
    );
  });

  it("keeps the path, other params and hash", () => {
    expect(
      withAuthCode(
        "http://localhost:5173/passage/John-1?startVerse=3#note",
        "abc",
        attempt,
      ),
    ).toBe(
      `http://localhost:5173/passage/John-1?startVerse=3&code=abc&signInAttempt=${attempt}#note`,
    );
  });

  it("replaces an existing code and attempt id", () => {
    expect(
      withAuthCode(
        "https://berean.nathanconnor.dev/?code=old&signInAttempt=stale-attempt-id-0000&x=1",
        "new",
        attempt,
      ),
    ).toBe(
      `https://berean.nathanconnor.dev/?code=new&signInAttempt=${attempt}&x=1`,
    );
  });

  it("encodes the code", () => {
    const url = withAuthCode(
      "https://berean.nathanconnor.dev/",
      "a/b=c&d",
      attempt,
    );
    expect(new URL(url).searchParams.get("code")).toBe("a/b=c&d");
  });
});
