import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ADD_TO_HOME_SCREEN_DISMISSED_KEY } from "@/lib/pwa-install-hint";
import { AddToHomeScreenHint } from "./add-to-home-screen-hint";

vi.mock("@/lib/dev-log", () => ({
  logInteraction: vi.fn(),
}));

const IPAD_SAFARI =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15";
const TITLE = "Add Berean to your Home Screen";

function pretendToBe(userAgent: string, maxTouchPoints: number) {
  vi.spyOn(window.navigator, "userAgent", "get").mockReturnValue(userAgent);
  // jsdom has no maxTouchPoints at all.
  Object.defineProperty(window.navigator, "maxTouchPoints", {
    configurable: true,
    value: maxTouchPoints,
  });
}

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
  Reflect.deleteProperty(window.navigator, "maxTouchPoints");
  delete window.bereanDesktop;
  window.localStorage.clear();
});

describe("AddToHomeScreenHint", () => {
  it("shows on iPad Safari and stays dismissed", async () => {
    pretendToBe(IPAD_SAFARI, 5);
    const user = userEvent.setup();
    const { unmount } = render(<AddToHomeScreenHint />);

    expect(screen.getByText(TITLE)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Dismiss" }));

    expect(screen.queryByText(TITLE)).not.toBeInTheDocument();
    expect(
      window.localStorage.getItem(ADD_TO_HOME_SCREEN_DISMISSED_KEY),
    ).not.toBeNull();

    unmount();
    render(<AddToHomeScreenHint />);
    expect(screen.queryByText(TITLE)).not.toBeInTheDocument();
  });

  it("never shows in the desktop app", () => {
    pretendToBe(IPAD_SAFARI, 5);
    window.bereanDesktop = { isDesktop: true, platform: "darwin" };
    render(<AddToHomeScreenHint />);

    expect(screen.queryByText(TITLE)).not.toBeInTheDocument();
  });

  it("does not show on a Mac", () => {
    pretendToBe(IPAD_SAFARI, 0);
    render(<AddToHomeScreenHint />);

    expect(screen.queryByText(TITLE)).not.toBeInTheDocument();
  });
});
