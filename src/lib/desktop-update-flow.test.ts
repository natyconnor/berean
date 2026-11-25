import { describe, expect, it, vi } from "vitest";
import { createUpdateFlow } from "../../electron/update-flow";

const ARROW_DETAIL =
  "When it’s ready, you’ll see an arrow at the top of the window.";

function setup({ canUpdate = true } = {}) {
  let finishStartCheck: (found: unknown) => void = () => {};
  let failStartCheck: (error: Error) => void = () => {};
  const deps = {
    canUpdate: () => canUpdate,
    appVersion: () => "1.0.1",
    tellUser: vi.fn<(message: string, detail: string) => void>(),
    startCheck: vi.fn(
      () =>
        new Promise<unknown>((resolve, reject) => {
          finishStartCheck = resolve;
          failStartCheck = reject;
        }),
    ),
    quitAndInstall: vi.fn(),
  };
  const flow = createUpdateFlow(deps);
  return {
    deps,
    flow,
    finishStartCheck: (found: unknown) => finishStartCheck(found),
    failStartCheck: (error: Error) => failStartCheck(error),
    download: (version = "1.0.2") => {
      flow.handleUpdateAvailable(version);
      flow.handleUpdateDownloaded(version);
    },
    messages: () =>
      deps.tellUser.mock.calls.map(([message, detail]) => ({
        message,
        detail,
      })),
  };
}

describe("update flow", () => {
  it("opens no window when a download finishes, and reports it ready", () => {
    const { deps, flow, download } = setup();
    const changes = vi.fn();
    flow.onUpdateStateChange(changes);

    void flow.checkForUpdates();
    download();

    expect(deps.tellUser).not.toHaveBeenCalled();
    expect(deps.quitAndInstall).not.toHaveBeenCalled();
    expect(flow.getUpdateState()).toEqual({
      canSelfUpdate: true,
      state: "downloaded",
      downloadingVersion: null,
      readyVersion: "1.0.2",
    });
    expect(changes).toHaveBeenLastCalledWith(
      expect.objectContaining({ state: "downloaded", readyVersion: "1.0.2" }),
    );
  });

  it("checks again from the menu after a download; nothing newer gets an OK window, never a restart", async () => {
    const { deps, flow, download, messages } = setup();
    download();

    flow.checkForUpdatesFromMenu();
    expect(deps.startCheck).toHaveBeenCalledOnce();
    expect(messages()).toEqual([]);
    flow.handleUpdateNotAvailable();

    // tellUser windows have one button, OK.
    await vi.waitFor(() =>
      expect(messages()).toEqual([
        {
          message: "Berean 1.0.2 is ready.",
          detail:
            "Click the arrow at the top of the window to restart and update.",
        },
      ]),
    );
    expect(deps.quitAndInstall).not.toHaveBeenCalled();
  });

  it("tells a menu check after a download when a newer version is downloading", async () => {
    const { flow, download, messages } = setup();
    download("1.0.3");

    flow.checkForUpdatesFromMenu();
    flow.handleUpdateAvailable("1.0.4");

    await vi.waitFor(() =>
      expect(messages()).toEqual([
        { message: "Downloading Berean 1.0.4.", detail: ARROW_DETAIL },
      ]),
    );
  });

  it("keeps checking after a download and replaces it with a newer version", async () => {
    const { deps, flow, download } = setup();
    download("1.0.3");

    const check = flow.checkForUpdates();
    expect(deps.startCheck).toHaveBeenCalledOnce();
    // The arrow stays while checking and while the newer one downloads.
    expect(flow.getUpdateState()).toMatchObject({
      state: "downloaded",
      readyVersion: "1.0.3",
    });

    flow.handleUpdateAvailable("1.0.4");
    await expect(check).resolves.toEqual({
      kind: "downloading",
      version: "1.0.4",
    });
    expect(flow.getUpdateState()).toMatchObject({
      state: "downloading",
      downloadingVersion: "1.0.4",
      readyVersion: "1.0.3",
    });

    flow.handleUpdateDownloaded("1.0.4");
    expect(flow.getUpdateState()).toMatchObject({
      state: "downloaded",
      readyVersion: "1.0.4",
    });
  });

  it("stays ready when a check after a download finds nothing newer", async () => {
    const { deps, flow, download } = setup();
    download("1.0.3");

    const notAvailable = flow.checkForUpdates();
    flow.handleUpdateNotAvailable();
    await expect(notAvailable).resolves.toEqual({
      kind: "ready",
      version: "1.0.3",
    });

    // electron-updater compares with the running version, so it reports the
    // downloaded one as available again.
    const sameAgain = flow.checkForUpdates();
    flow.handleUpdateAvailable("1.0.3");
    await expect(sameAgain).resolves.toEqual({
      kind: "ready",
      version: "1.0.3",
    });

    expect(deps.startCheck).toHaveBeenCalledTimes(2);
    expect(flow.getUpdateState()).toMatchObject({
      state: "downloaded",
      downloadingVersion: null,
      readyVersion: "1.0.3",
    });
  });

  it("keeps the ready version when a check after a download fails", async () => {
    const { flow, download } = setup();
    download("1.0.3");

    const check = flow.checkForUpdates();
    flow.handleError();
    await expect(check).resolves.toEqual({ kind: "error" });
    expect(flow.getUpdateState()).toMatchObject({
      state: "downloaded",
      readyVersion: "1.0.3",
    });
  });

  it("points a menu check that finds an update at the arrow", async () => {
    const { flow, messages } = setup();
    flow.checkForUpdatesFromMenu();
    flow.handleUpdateAvailable("1.0.2");

    await vi.waitFor(() =>
      expect(messages()).toEqual([
        { message: "Downloading Berean 1.0.2.", detail: ARROW_DETAIL },
      ]),
    );
  });

  it("points a menu check during a download at the arrow", () => {
    const { flow, messages } = setup();
    void flow.checkForUpdates();
    flow.handleUpdateAvailable("1.0.2");

    flow.checkForUpdatesFromMenu();
    expect(messages()).toEqual([
      { message: "An update is downloading.", detail: ARROW_DETAIL },
    ]);
  });

  it("keeps the up-to-date and failed windows for a menu check", async () => {
    const { flow, messages, failStartCheck } = setup();
    flow.checkForUpdatesFromMenu();
    flow.handleUpdateNotAvailable();
    await vi.waitFor(() => expect(messages()).toHaveLength(1));

    flow.checkForUpdatesFromMenu();
    failStartCheck(new Error("offline"));
    flow.handleError();
    await vi.waitFor(() => expect(messages()).toHaveLength(2));

    expect(messages()).toEqual([
      {
        message: "Berean is up to date.",
        detail: "You have the latest version (1.0.1).",
      },
      {
        message: "Berean couldn’t check for updates.",
        detail: "Check your internet connection and try again later.",
      },
    ]);
  });

  it("shows nothing for a background failure", async () => {
    const { deps, flow } = setup();
    const background = flow.checkForUpdates();
    flow.handleError();

    await expect(background).resolves.toEqual({ kind: "error" });
    expect(deps.tellUser).not.toHaveBeenCalled();
    expect(flow.getUpdateState()).toMatchObject({
      state: "idle",
      readyVersion: null,
    });
  });

  it("lets a Settings check join one already running", async () => {
    const { deps, flow } = setup();
    const background = flow.checkForUpdates();
    const fromSettings = flow.checkForUpdates();
    flow.handleUpdateNotAvailable();

    await expect(background).resolves.toEqual({ kind: "up-to-date" });
    await expect(fromSettings).resolves.toEqual({ kind: "up-to-date" });
    expect(deps.startCheck).toHaveBeenCalledOnce();
    expect(deps.tellUser).not.toHaveBeenCalled();
  });

  it("gives Settings the download and the ready version", async () => {
    const { flow } = setup();
    const check = flow.checkForUpdates();
    flow.handleUpdateAvailable("1.0.2");
    await expect(check).resolves.toEqual({
      kind: "downloading",
      version: "1.0.2",
    });
    await expect(flow.checkForUpdates()).resolves.toEqual({
      kind: "downloading",
      version: "1.0.2",
    });

    flow.handleUpdateDownloaded("1.0.2");
    const afterDownload = flow.checkForUpdates();
    flow.handleUpdateNotAvailable();
    await expect(afterDownload).resolves.toEqual({
      kind: "ready",
      version: "1.0.2",
    });
  });

  it("never offers an update in a copy that cannot install one", async () => {
    const { deps, flow, messages } = setup({ canUpdate: false });

    await expect(flow.checkForUpdates()).resolves.toEqual({
      kind: "unsupported",
    });
    expect(flow.getUpdateState()).toMatchObject({
      canSelfUpdate: false,
      readyVersion: null,
    });
    expect(deps.startCheck).not.toHaveBeenCalled();

    flow.checkForUpdatesFromMenu();
    await vi.waitFor(() =>
      expect(messages()[0]?.message).toBe(
        "This copy of Berean doesn’t update itself.",
      ),
    );
  });

  it("installs only a downloaded update", () => {
    const { deps, flow, download } = setup();
    expect(flow.installDownloadedUpdate()).toBe(false);
    expect(deps.quitAndInstall).not.toHaveBeenCalled();

    download();
    expect(flow.installDownloadedUpdate()).toBe(true);
    expect(deps.quitAndInstall).toHaveBeenCalledOnce();
  });

  it("asks electron-updater to install only once", () => {
    const { deps, flow, download } = setup();
    download();

    flow.installDownloadedUpdate();
    flow.installDownloadedUpdate();
    flow.installDownloadedUpdate();
    expect(deps.quitAndInstall).toHaveBeenCalledOnce();
  });
});
