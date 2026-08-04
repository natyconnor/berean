import { afterEach, describe, expect, it } from "vitest";
import { resolveEsvSource, setEsvSource } from "./esv-source";

const STORAGE_KEY = "berean:esvSource";

describe("resolveEsvSource", () => {
  afterEach(() => {
    localStorage.removeItem(STORAGE_KEY);
    window.history.replaceState({}, "", "/");
  });

  it("defaults to text when nothing is set", () => {
    expect(resolveEsvSource()).toBe("text");
  });

  it("reads a valid value from localStorage", () => {
    localStorage.setItem(STORAGE_KEY, "html");
    expect(resolveEsvSource()).toBe("html");
  });

  it("ignores invalid localStorage values", () => {
    localStorage.setItem(STORAGE_KEY, "markdown");
    expect(resolveEsvSource()).toBe("text");
  });

  it("persists ?esvSource=html into localStorage and returns html", () => {
    window.history.replaceState({}, "", "/?esvSource=html");
    expect(resolveEsvSource()).toBe("html");
    expect(localStorage.getItem(STORAGE_KEY)).toBe("html");
  });

  it("persists ?esvSource=text into localStorage and returns text", () => {
    localStorage.setItem(STORAGE_KEY, "html");
    window.history.replaceState({}, "", "/?esvSource=text");
    expect(resolveEsvSource()).toBe("text");
    expect(localStorage.getItem(STORAGE_KEY)).toBe("text");
  });

  it("ignores invalid query values and falls back to storage", () => {
    localStorage.setItem(STORAGE_KEY, "html");
    window.history.replaceState({}, "", "/?esvSource=markdown");
    expect(resolveEsvSource()).toBe("html");
  });
});

describe("setEsvSource", () => {
  afterEach(() => {
    localStorage.removeItem(STORAGE_KEY);
  });

  it("writes the preference to localStorage", () => {
    setEsvSource("html");
    expect(localStorage.getItem(STORAGE_KEY)).toBe("html");
    expect(resolveEsvSource()).toBe("html");
  });
});
