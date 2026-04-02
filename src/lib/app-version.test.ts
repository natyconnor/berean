import { describe, expect, it } from "vitest";
import {
  hasDetectedNewBuild,
  isStaleClientError,
  isValidAppVersionInfo,
} from "./app-version";

describe("app version helpers", () => {
  it("accepts a valid app version payload", () => {
    expect(
      isValidAppVersionInfo({
        appVersion: "1.4.0",
        buildId: "abc123",
      }),
    ).toBe(true);
  });

  it("rejects incomplete app version payloads", () => {
    expect(
      isValidAppVersionInfo({
        appVersion: "1.4.0",
      }),
    ).toBe(false);
  });

  it("detects when a newer build is available", () => {
    expect(hasDetectedNewBuild("build-a", "build-b")).toBe(true);
    expect(hasDetectedNewBuild("build-a", "build-a")).toBe(false);
  });

  it("flags lazy chunk failures as stale-client errors", () => {
    expect(
      isStaleClientError(
        new Error("Failed to fetch dynamically imported module"),
      ),
    ).toBe(true);

    expect(
      isStaleClientError({
        message: "Unhandled runtime error",
        cause: new Error("ChunkLoadError: Loading chunk 7 failed."),
      }),
    ).toBe(true);

    expect(isStaleClientError(new Error("Network unavailable"))).toBe(false);
  });
});
