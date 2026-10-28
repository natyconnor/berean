import { afterEach, describe, expect, it } from "vitest";

import { scrollClearOfModeDock } from "./scroll-result-banner";

describe("scrollClearOfModeDock", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("scrolls a field whose lower half sits under the Mode dock", () => {
    const scroller = document.createElement("div");
    scroller.className = "overflow-auto";
    Object.defineProperty(scroller, "scrollTop", {
      writable: true,
      value: 0,
    });

    const field = document.createElement("textarea");
    field.scrollIntoView = () => undefined;
    scroller.append(field);

    const dock = document.createElement("nav");
    dock.setAttribute("aria-label", "Mode");

    document.body.append(scroller, dock);

    field.getBoundingClientRect = () =>
      ({ top: 626, bottom: 806, height: 180 }) as DOMRect;
    dock.getBoundingClientRect = () =>
      ({ top: 728, bottom: 784, height: 56 }) as DOMRect;

    scrollClearOfModeDock(field);

    expect(scroller.scrollTop).toBe(86);
  });

  it("leaves a field that already clears the dock", () => {
    const scroller = document.createElement("div");
    scroller.className = "overflow-auto";
    Object.defineProperty(scroller, "scrollTop", {
      writable: true,
      value: 12,
    });

    const field = document.createElement("textarea");
    field.scrollIntoView = () => undefined;
    scroller.append(field);

    const dock = document.createElement("nav");
    dock.setAttribute("aria-label", "Mode");

    document.body.append(scroller, dock);

    field.getBoundingClientRect = () =>
      ({ top: 400, bottom: 580, height: 180 }) as DOMRect;
    dock.getBoundingClientRect = () =>
      ({ top: 728, bottom: 784, height: 56 }) as DOMRect;

    scrollClearOfModeDock(field);

    expect(scroller.scrollTop).toBe(12);
  });
});
