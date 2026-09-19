import { afterEach, describe, expect, it } from "vitest";

import {
  clearDevLog,
  DEV_LOG_OVERLAY_OPEN_KEY,
  getDevLogEntries,
  getMirrorToConsole,
  setMirrorToConsole,
} from "./dev-log";
import { appendSpokenText } from "./web-speech";
import {
  classifySpokenStitch,
  sanitizeSttLogDetails,
  STT_DEBUG_STORAGE_KEY,
  STT_LOG_CHANNEL,
  sttDebugEnabled,
  sttLog,
} from "./stt-log";

describe("sttLog", () => {
  afterEach(() => {
    window.localStorage.removeItem(STT_DEBUG_STORAGE_KEY);
    window.history.replaceState({}, "", "/");
    setMirrorToConsole(false);
    sessionStorage.removeItem(DEV_LOG_OVERLAY_OPEN_KEY);
    clearDevLog();
  });

  it("stays off by default", () => {
    expect(sttDebugEnabled()).toBe(false);
    sttLog.info("listen-start", { session: 1 });
    expect(getDevLogEntries()).toHaveLength(0);
  });

  it("turns on from ?debugStt=1 and persists", () => {
    window.history.replaceState({}, "", "/memory/learn?debugStt=1");
    expect(sttDebugEnabled()).toBe(true);
    expect(window.localStorage.getItem(STT_DEBUG_STORAGE_KEY)).toBe("1");
    expect(getMirrorToConsole()).toBe(true);
    expect(sessionStorage.getItem(DEV_LOG_OVERLAY_OPEN_KEY)).toBe("1");
  });

  it("turns on from #debugStt=1 when search params were stripped", () => {
    window.history.replaceState({}, "", "/memory/learn#debugStt=1");
    expect(sttDebugEnabled()).toBe(true);
  });

  it("turns off from ?debugStt=0", () => {
    window.localStorage.setItem(STT_DEBUG_STORAGE_KEY, "1");
    window.history.replaceState({}, "", "/?debugStt=0");
    expect(sttDebugEnabled()).toBe(false);
    expect(window.localStorage.getItem(STT_DEBUG_STORAGE_KEY)).toBeNull();
  });

  it("emits to the existing devLog channel when enabled", () => {
    window.localStorage.setItem(STT_DEBUG_STORAGE_KEY, "1");
    sttLog.info("clip-skip", {
      reason: "silence",
      bytes: 2048,
      mime: "audio/webm",
      durationMs: 1200,
    });
    const entries = getDevLogEntries();
    expect(entries).toHaveLength(1);
    expect(entries[0]?.channel).toBe(STT_LOG_CHANNEL);
    expect(entries[0]?.level).toBe("info");
    expect(entries[0]?.body).toContain("clip-skip");
    expect(entries[0]?.body).toContain("silence");
    expect(entries[0]?.body).toContain("2048");
  });

  it("never logs API keys or raw audio", () => {
    window.localStorage.setItem(STT_DEBUG_STORAGE_KEY, "1");
    sttLog.info("transcribe-start", {
      GROQ_API_KEY: "gsk_live_secret",
      apiKey: "gsk_live_secret",
      authorization: "Bearer gsk_live_secret",
      audioBase64: "AAAA",
      note: "GROQ_API_KEY=gsk_live_secret should vanish",
    });
    const body = getDevLogEntries()[0]?.body ?? "";
    expect(body).not.toContain("gsk_live_secret");
    expect(body).not.toContain("AAAA");
    expect(body).toContain("<redacted>");
    expect(body).toContain("<redacted-secret>");
  });

  it("labels append and overlap stitch decisions for later STT agents", () => {
    const appended = appendSpokenText("The Lord", "I shall not want");
    expect(appended).toBe("The Lord I shall not want");
    expect(
      classifySpokenStitch("The Lord", "I shall not want", appended),
    ).toEqual({
      decision: "append",
      overlapWords: 0,
    });
    expect(classifySpokenStitch("", "The Lord", "The Lord")).toEqual({
      decision: "first",
      overlapWords: 0,
    });
    expect(
      classifySpokenStitch(
        "The Lord",
        "Lord is my shepherd",
        "The Lord is my shepherd",
      ),
    ).toEqual({
      decision: "overlap",
      overlapWords: 1,
    });
  });
});

describe("sanitizeSttLogDetails", () => {
  it("omits undefined fields and sorts keys", () => {
    const out = sanitizeSttLogDetails({
      mime: "audio/webm",
      requestId: undefined,
      bytes: 12,
    });
    expect(out).toEqual({ bytes: 12, mime: "audio/webm" });
    expect(Object.keys(out ?? {})).toEqual(["bytes", "mime"]);
  });
});
