import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { UnsavedNotesDiscardDialog } from "@/components/unsaved-notes-discard-dialog";
import type {
  BereanDesktopBridge,
  DesktopUpdateState,
} from "@/lib/desktop-platform";
import { setUnsavedNotes } from "@/lib/unsaved-notes";
import { UpdateIndicator, type WebUpdate } from "./update-indicator";

const IDLE: DesktopUpdateState = {
  canSelfUpdate: true,
  state: "idle",
  downloadingVersion: null,
  readyVersion: null,
};
const SHELL_READY: DesktopUpdateState = {
  ...IDLE,
  state: "downloaded",
  readyVersion: "1.0.2",
};

function installShell(initial: DesktopUpdateState) {
  const listeners = new Set<(state: DesktopUpdateState) => void>();
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
    installUpdate: vi.fn(),
    hasUnsavedNotes: vi.fn(() => Promise.resolve(false)),
    setHasUnsavedNotes: vi.fn(),
  } satisfies BereanDesktopBridge;
  window.bereanDesktop = bridge;
  return {
    bridge,
    push(state: DesktopUpdateState) {
      act(() => {
        for (const listener of listeners) listener(state);
      });
    },
  };
}

function webUpdate(buildId = "build-2"): WebUpdate {
  return { buildId, refresh: vi.fn() };
}

function renderIndicator(update: WebUpdate | null = null) {
  return render(
    <TooltipProvider delayDuration={0}>
      <UpdateIndicator webUpdate={update} />
      <UnsavedNotesDiscardDialog />
    </TooltipProvider>,
  );
}

function arrow() {
  return screen.queryByRole("button", { name: /^Update ready/ });
}

function dotIsVisible() {
  return screen.getByTestId("update-dot").dataset.visible === "true";
}

afterEach(() => {
  delete window.bereanDesktop;
  window.localStorage.clear();
  setUnsavedNotes("test-editor", false);
});

describe("UpdateIndicator", () => {
  it.each([
    ["idle", IDLE],
    ["checking", { ...IDLE, state: "checking" as const }],
    [
      "downloading",
      { ...IDLE, state: "downloading" as const, downloadingVersion: "1.0.2" },
    ],
  ])("shows nothing while the shell is %s", (_label, state) => {
    installShell(state);
    renderIndicator();
    expect(arrow()).toBeNull();
  });

  it("never shows a shell update for a copy that cannot update itself", () => {
    installShell({ ...IDLE, canSelfUpdate: false });
    renderIndicator();
    expect(arrow()).toBeNull();
  });

  it("appears with a dot when a shell download finishes", () => {
    const shell = installShell(IDLE);
    renderIndicator();
    expect(arrow()).toBeNull();

    shell.push(SHELL_READY);
    expect(arrow()).toHaveAccessibleName("Update ready, Berean 1.0.2");
    expect(dotIsVisible()).toBe(true);
  });

  it("uses the shell copy for a shell update", async () => {
    const user = userEvent.setup();
    installShell(SHELL_READY);
    renderIndicator();

    await user.hover(arrow()!);
    expect(
      await screen.findByRole("tooltip", { name: "Berean 1.0.2 is ready" }),
    ).toBeInTheDocument();

    await user.click(arrow()!);
    expect(
      await screen.findByText("Berean 1.0.2 is ready", { selector: "p" }),
    ).toBeInTheDocument();
    const primary = screen.getByRole("button", { name: "Restart to update" });
    expect(primary).toHaveFocus();
    expect(screen.getByRole("button", { name: "Not now" })).toBeInTheDocument();
  });

  it("uses the web copy for a web build on its own", async () => {
    const user = userEvent.setup();
    installShell(IDLE);
    renderIndicator(webUpdate());

    expect(arrow()).toHaveAccessibleName("Update ready");
    await user.click(arrow()!);
    expect(
      await screen.findByText("A new version of Berean is ready", {
        selector: "p",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Refresh to update" }),
    ).toBeInTheDocument();
  });

  it("lets the shell update win when both are ready", async () => {
    const user = userEvent.setup();
    installShell(SHELL_READY);
    renderIndicator(webUpdate());

    expect(
      screen.getAllByRole("button", { name: /^Update ready/ }),
    ).toHaveLength(1);
    expect(arrow()).toHaveAccessibleName("Update ready, Berean 1.0.2");
    await user.click(arrow()!);
    expect(
      await screen.findByRole("button", { name: "Restart to update" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("A new version of Berean is ready")).toBeNull();
  });

  it("shows a web build on a shell too old to report updates", () => {
    window.bereanDesktop = { isDesktop: true, platform: "darwin" };
    renderIndicator(webUpdate());
    expect(arrow()).toHaveAccessibleName("Update ready");
  });

  it("drops the dot but keeps the arrow on Not now", async () => {
    const user = userEvent.setup();
    installShell(SHELL_READY);
    renderIndicator();

    await user.click(arrow()!);
    await user.click(await screen.findByRole("button", { name: "Not now" }));

    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Not now" })).toBeNull(),
    );
    expect(arrow()).toHaveAccessibleName("Update ready, Berean 1.0.2");
    expect(dotIsVisible()).toBe(false);
  });

  it("treats Escape as Not now", async () => {
    const user = userEvent.setup();
    installShell(SHELL_READY);
    renderIndicator();

    await user.click(arrow()!);
    await screen.findByRole("button", { name: "Restart to update" });
    await user.keyboard("{Escape}");

    expect(dotIsVisible()).toBe(false);
  });

  it("keeps the dot off for the same update, and brings it back for a newer one", async () => {
    const user = userEvent.setup();
    const shell = installShell(SHELL_READY);
    const { unmount } = renderIndicator();
    await user.click(arrow()!);
    await user.click(await screen.findByRole("button", { name: "Not now" }));
    unmount();

    // Another window, or this one after a reload: same update, no dot.
    renderIndicator();
    expect(dotIsVisible()).toBe(false);

    shell.push({ ...SHELL_READY, readyVersion: "1.0.3" });
    expect(dotIsVisible()).toBe(true);
  });

  it("drops the dot when another window chooses Not now", () => {
    installShell(SHELL_READY);
    renderIndicator();
    expect(dotIsVisible()).toBe(true);

    act(() => {
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: "berean:update-dot-dismissed",
          newValue: JSON.stringify({ shellVersion: "1.0.2", webBuildId: null }),
        }),
      );
    });
    expect(dotIsVisible()).toBe(false);
  });

  it("restarts with no dialog when no window has unsaved notes", async () => {
    const user = userEvent.setup();
    const { bridge } = installShell(SHELL_READY);
    renderIndicator();

    await user.click(arrow()!);
    await user.click(
      await screen.findByRole("button", { name: "Restart to update" }),
    );

    await waitFor(() => expect(bridge.installUpdate).toHaveBeenCalledOnce());
    expect(screen.queryByText("Discard unsaved notes?")).toBeNull();
    expect(arrow()).toBeDisabled();
  });

  it("requests the install once however often Restart is clicked", async () => {
    const user = userEvent.setup();
    const { bridge } = installShell(SHELL_READY);
    let answerUnsavedCheck: (hasUnsaved: boolean) => void = () => {};
    bridge.hasUnsavedNotes.mockReturnValue(
      new Promise<boolean>((resolve) => {
        answerUnsavedCheck = resolve;
      }),
    );
    renderIndicator();

    await user.click(arrow()!);
    const restart = await screen.findByRole("button", {
      name: "Restart to update",
    });
    fireEvent.click(restart);
    fireEvent.click(restart);
    fireEvent.click(restart);
    // Disabled while it asks the other windows about unsaved notes.
    expect(restart).toBeDisabled();
    expect(bridge.hasUnsavedNotes).toHaveBeenCalledOnce();

    await act(async () => {
      answerUnsavedCheck(false);
      await Promise.resolve();
    });
    expect(bridge.installUpdate).toHaveBeenCalledOnce();
  });

  it("asks before restarting when another window has unsaved notes", async () => {
    const user = userEvent.setup();
    const { bridge } = installShell(SHELL_READY);
    bridge.hasUnsavedNotes.mockResolvedValue(true);
    renderIndicator();

    await user.click(arrow()!);
    await user.click(
      await screen.findByRole("button", { name: "Restart to update" }),
    );
    await user.click(
      await screen.findByRole("button", { name: "Keep editing" }),
    );

    expect(bridge.installUpdate).not.toHaveBeenCalled();
    expect(dotIsVisible()).toBe(true);
    expect(arrow()).toBeEnabled();

    await user.click(arrow()!);
    await user.click(
      await screen.findByRole("button", { name: "Restart to update" }),
    );
    expect(
      await screen.findByText(
        "You have unsaved changes in your notes. Do you want to discard them?",
      ),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Discard" }));
    expect(bridge.installUpdate).toHaveBeenCalledOnce();
  });

  it("refreshes a web build without quitting, after asking about this window", async () => {
    const user = userEvent.setup();
    const { bridge } = installShell(IDLE);
    const update = webUpdate();
    setUnsavedNotes("test-editor", true);
    renderIndicator(update);

    await user.click(arrow()!);
    await user.click(
      await screen.findByRole("button", { name: "Refresh to update" }),
    );
    await user.click(await screen.findByRole("button", { name: "Discard" }));

    expect(update.refresh).toHaveBeenCalledOnce();
    expect(bridge.installUpdate).not.toHaveBeenCalled();
  });
});
