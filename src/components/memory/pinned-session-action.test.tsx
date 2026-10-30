import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MOBILE_MEDIA_QUERY } from "@/hooks/use-media-query";

import { PinnedSessionAction } from "./pinned-session-action";

type Listener = () => void;

function stubMatchMedia(matches: boolean) {
  const listeners = new Set<Listener>();
  const matchMedia = vi.fn((query: string) => {
    return {
      get matches() {
        return query === MOBILE_MEDIA_QUERY ? matches : false;
      },
      media: query,
      addEventListener: (_type: string, listener: Listener) =>
        listeners.add(listener),
      removeEventListener: (_type: string, listener: Listener) =>
        listeners.delete(listener),
    } as unknown as MediaQueryList;
  });
  vi.stubGlobal("matchMedia", matchMedia);
}

function stubObservers() {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      callback: IntersectionObserverCallback;
      constructor(callback: IntersectionObserverCallback) {
        this.callback = callback;
      }
      observe(target: Element) {
        this.callback(
          [
            {
              isIntersecting: false,
              target,
            } as IntersectionObserverEntry,
          ],
          this as unknown as IntersectionObserver,
        );
      }
      disconnect() {}
    },
  );
}

function renderPinnedCheck() {
  return render(
    <>
      <nav aria-label="Mode">Memory</nav>
      <PinnedSessionAction>
        <button type="button">Check answer</button>
      </PinnedSessionAction>
    </>,
  );
}

describe("PinnedSessionAction", () => {
  beforeEach(() => {
    stubObservers();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("does not pin Check answer at desktop width", async () => {
    stubMatchMedia(false);
    renderPinnedCheck();

    await waitFor(() => {
      expect(
        screen.getAllByRole("button", { name: "Check answer" }),
      ).toHaveLength(1);
    });
  });

  it("pins Check answer on a phone when the in-flow button is off screen", async () => {
    stubMatchMedia(true);
    renderPinnedCheck();

    await waitFor(() => {
      expect(
        screen.getAllByRole("button", { name: "Check answer" }),
      ).toHaveLength(2);
    });
  });
});
