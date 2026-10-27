import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useOverflowTabIndex } from "./use-overflow-tab-index";

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
  {
    clientHeight,
    scrollHeight,
    clientWidth = 320,
    scrollWidth = 320,
  }: {
    clientHeight: number;
    scrollHeight: number;
    clientWidth?: number;
    scrollWidth?: number;
  },
) {
  Object.defineProperties(element, {
    clientHeight: { configurable: true, value: clientHeight },
    scrollHeight: { configurable: true, value: scrollHeight },
    clientWidth: { configurable: true, value: clientWidth },
    scrollWidth: { configurable: true, value: scrollWidth },
  });
}

function Region() {
  const { ref, tabIndex } = useOverflowTabIndex();
  return (
    <div ref={ref} tabIndex={tabIndex} data-testid="region">
      <p>Full text</p>
    </div>
  );
}

describe("useOverflowTabIndex", () => {
  beforeEach(() => {
    stubResizeObserver();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("leaves tabindex off when the region does not overflow", () => {
    render(<Region />);
    const region = screen.getByTestId("region");
    setBox(region, { clientHeight: 200, scrollHeight: 200 });
    fireResize();
    expect(region).not.toHaveAttribute("tabindex");
  });

  it("sets tabindex to 0 only while the region overflows", () => {
    render(<Region />);
    const region = screen.getByTestId("region");
    setBox(region, { clientHeight: 120, scrollHeight: 400 });
    fireResize();
    expect(region).toHaveAttribute("tabindex", "0");

    setBox(region, { clientHeight: 400, scrollHeight: 400 });
    fireResize();
    expect(region).not.toHaveAttribute("tabindex");
  });

  it("attaches after the region mounts later", () => {
    function Late() {
      const { ref, tabIndex } = useOverflowTabIndex();
      return (
        <div>
          <div ref={ref} tabIndex={tabIndex} data-testid="region">
            <p>Full text</p>
          </div>
        </div>
      );
    }
    render(<Late />);
    const region = screen.getByTestId("region");
    setBox(region, { clientHeight: 80, scrollHeight: 240 });
    fireResize();
    expect(region).toHaveAttribute("tabindex", "0");
  });

  it("keeps focus on the region when overflow (and tabindex) go away", () => {
    render(<Region />);
    const region = screen.getByTestId("region");
    setBox(region, { clientHeight: 80, scrollHeight: 240 });
    fireResize();
    region.focus();
    expect(document.activeElement).toBe(region);

    setBox(region, { clientHeight: 240, scrollHeight: 240 });
    fireResize();
    expect(region).not.toHaveAttribute("tabindex");
    expect(document.activeElement).toBe(region);
  });
});
