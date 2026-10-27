import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { VerseAttemptResult } from "./verse-attempt-result";

const VERSE = "Your word is a lamp to my feet and a light to my path.";

let observers: ResizeObserverCallback[] = [];

function stubResizeObserver() {
  observers = [];
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(callback: ResizeObserverCallback) {
        observers.push(callback);
      }
      disconnect() {}
      observe() {}
      unobserve() {}
    },
  );
}

function fireResize() {
  act(() => {
    for (const callback of observers) {
      callback([], {} as ResizeObserver);
    }
  });
}

function setBox(
  element: HTMLElement,
  clientHeight: number,
  scrollHeight: number,
) {
  Object.defineProperties(element, {
    clientHeight: { configurable: true, value: clientHeight },
    scrollHeight: { configurable: true, value: scrollHeight },
    clientWidth: { configurable: true, value: 320 },
    scrollWidth: { configurable: true, value: 320 },
  });
}

function tabStops(root: ParentNode) {
  return [...root.querySelectorAll<HTMLElement>("*")].filter((element) => {
    if (element.hasAttribute("disabled")) return false;
    if (element.getAttribute("tabindex") === "-1") return false;
    if (element.hasAttribute("tabindex")) return true;
    const tag = element.tagName;
    return (
      tag === "BUTTON" ||
      tag === "A" ||
      tag === "TEXTAREA" ||
      tag === "INPUT" ||
      tag === "SELECT"
    );
  });
}

function renderResult() {
  return render(
    <div>
      <VerseAttemptResult
        typedAnswer="nope"
        versePlainText={VERSE}
        refresherOffer={<button type="button">Need a refresher?</button>}
      />
      <button type="button">Continue</button>
    </div>,
  );
}

describe("VerseAttemptResult tab order", () => {
  beforeEach(() => {
    stubResizeObserver();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("keeps How you did out of the tab order when it does not overflow", () => {
    const { container } = renderResult();
    const region = screen
      .getByText("How you did")
      .closest("[data-result-scroll]");
    if (!(region instanceof HTMLElement)) {
      throw new Error("Expected How you did to be a result scroll region");
    }
    setBox(region, 200, 200);
    fireResize();

    expect(region).not.toHaveAttribute("tabindex");
    const stops = tabStops(container);
    expect(stops.map((node) => node.textContent?.trim())).toEqual([
      "Need a refresher?",
      "Continue",
    ]);
  });

  it("puts How you did between the banner link and Continue when it overflows", () => {
    const { container } = renderResult();
    const region = screen
      .getByText("How you did")
      .closest("[data-result-scroll]");
    if (!(region instanceof HTMLElement)) {
      throw new Error("Expected How you did to be a result scroll region");
    }
    setBox(region, 80, 320);
    fireResize();

    expect(region).toHaveAttribute("tabindex", "0");
    const stops = tabStops(container);
    expect(stops.map((node) => node.textContent?.trim())).toEqual([
      "Need a refresher?",
      expect.stringContaining("How you did"),
      "Continue",
    ]);
    expect(stops[1]).toBe(region);
  });

  it("places the banner, then Need a refresher, then How you did, then Continue", () => {
    const { container } = renderResult();
    const banner = container.querySelector("[data-result-banner]");
    const offer = screen.getByRole("button", { name: "Need a refresher?" });
    const howYouDid = screen.getByText("How you did");
    const continueButton = screen.getByRole("button", { name: "Continue" });
    if (!(banner instanceof HTMLElement)) {
      throw new Error("Expected a result banner");
    }

    expect(banner.compareDocumentPosition(offer)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING | Node.DOCUMENT_POSITION_CONTAINED_BY,
    );
    expect(offer.compareDocumentPosition(howYouDid)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(howYouDid.compareDocumentPosition(continueButton)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });
});
