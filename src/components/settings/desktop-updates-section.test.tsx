import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  BereanDesktopBridge,
  DesktopUpdateCheckResult,
  DesktopUpdateState,
} from "@/lib/desktop-platform";
import { DesktopUpdatesSection } from "./desktop-updates-section";

const IDLE: DesktopUpdateState = {
  canSelfUpdate: true,
  state: "idle",
  downloadingVersion: null,
  readyVersion: null,
};

function installShell(initial: DesktopUpdateState = IDLE) {
  const listeners = new Set<(state: DesktopUpdateState) => void>();
  let resolveCheck: (result: DesktopUpdateCheckResult) => void = () => {};
  const bridge = {
    isDesktop: true,
    platform: "darwin",
    shellVersion: "1.0.1",
    subscribeToUpdates: (listener: (state: DesktopUpdateState) => void) => {
      listeners.add(listener);
      listener(initial);
      return () => {
        listeners.delete(listener);
      };
    },
    checkForUpdates: vi.fn(
      () =>
        new Promise<DesktopUpdateCheckResult>((resolve) => {
          resolveCheck = resolve;
        }),
    ),
  } satisfies BereanDesktopBridge;
  window.bereanDesktop = bridge;
  return {
    bridge,
    push(state: DesktopUpdateState) {
      act(() => {
        for (const listener of listeners) listener(state);
      });
    },
    async finishCheck(result: DesktopUpdateCheckResult) {
      await act(() => {
        resolveCheck(result);
        return Promise.resolve();
      });
    },
  };
}

function statusLine() {
  return screen.getByRole("status");
}

function checkButton() {
  return screen.getByRole("button", {
    name: /^(Check for updates|Checking…|Downloading…)$/,
  });
}

afterEach(() => {
  delete window.bereanDesktop;
});

describe("DesktopUpdatesSection", () => {
  it("is absent on the website", () => {
    const { container } = render(<DesktopUpdatesSection />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the shell version with an empty status line until a click", () => {
    installShell();
    render(<DesktopUpdatesSection />);
    expect(screen.getByText("Version 1.0.1")).toBeInTheDocument();
    expect(checkButton()).toHaveTextContent("Check for updates");
    expect(statusLine()).toBeEmptyDOMElement();
    expect(statusLine()).toHaveAttribute("aria-live", "polite");
  });

  it("checks, then says it is up to date", async () => {
    const user = userEvent.setup();
    const shell = installShell();
    render(<DesktopUpdatesSection />);

    await user.click(checkButton());
    expect(shell.bridge.checkForUpdates).toHaveBeenCalledOnce();
    expect(checkButton()).toHaveTextContent("Checking…");
    expect(checkButton()).toBeDisabled();
    expect(statusLine()).toBeEmptyDOMElement();

    await shell.finishCheck({ kind: "up-to-date" });
    expect(statusLine()).toHaveTextContent("You have the latest version.");
    expect(checkButton()).toBeEnabled();
  });

  it("follows a download it found until it is ready", async () => {
    const user = userEvent.setup();
    const shell = installShell();
    render(<DesktopUpdatesSection />);

    await user.click(checkButton());
    shell.push({ ...IDLE, state: "downloading", downloadingVersion: "1.0.2" });
    await shell.finishCheck({ kind: "downloading", version: "1.0.2" });
    expect(statusLine()).toHaveTextContent("Downloading Berean 1.0.2.");
    expect(checkButton()).toHaveTextContent("Downloading…");
    expect(checkButton()).toBeDisabled();

    shell.push({ ...IDLE, state: "downloaded", readyVersion: "1.0.2" });
    expect(statusLine()).toHaveTextContent("Berean 1.0.2 is ready.");
    expect(checkButton()).toHaveTextContent("Check for updates");
  });

  it("starts in Downloading when a download was already running", () => {
    installShell({
      ...IDLE,
      state: "downloading",
      downloadingVersion: "1.0.2",
    });
    render(<DesktopUpdatesSection />);
    expect(statusLine()).toHaveTextContent("Downloading Berean 1.0.2.");
    expect(checkButton()).toBeDisabled();
  });

  it("says when the update is already ready", async () => {
    const user = userEvent.setup();
    const shell = installShell({
      ...IDLE,
      state: "downloaded",
      readyVersion: "1.0.2",
    });
    render(<DesktopUpdatesSection />);
    expect(statusLine()).toBeEmptyDOMElement();

    await user.click(checkButton());
    await shell.finishCheck({ kind: "ready", version: "1.0.2" });
    expect(statusLine()).toHaveTextContent("Berean 1.0.2 is ready.");
    // Only the one restart entry point: the arrow.
    expect(
      screen.queryByRole("button", { name: "Restart to update" }),
    ).toBeNull();
  });

  it("shows a failed check in the destructive colour", async () => {
    const user = userEvent.setup();
    const shell = installShell();
    render(<DesktopUpdatesSection />);

    await user.click(checkButton());
    await shell.finishCheck({ kind: "error" });
    expect(statusLine()).toHaveTextContent(
      "Couldn’t check for updates. Check your internet connection and try again.",
    );
    expect(statusLine()).toHaveClass("text-destructive");
  });

  it("points an unpackaged copy at the released app", async () => {
    const user = userEvent.setup();
    const shell = installShell({ ...IDLE, canSelfUpdate: false });
    render(<DesktopUpdatesSection />);

    await user.click(checkButton());
    await shell.finishCheck({ kind: "unsupported" });
    expect(statusLine()).toHaveTextContent(
      "This copy doesn’t update itself. Download the released app.",
    );
    const link = screen.getByRole("link", {
      name: "Download the released app",
    });
    expect(link).toHaveAttribute(
      "href",
      "https://github.com/natyconnor/berean-desktop/releases",
    );
    expect(link).toHaveAttribute("target", "_blank");
  });
});
