/**
 * The shell's update state and what each check tells the user. No Electron
 * imports, so it can be unit tested (`src/lib/desktop-update-flow.test.ts`);
 * `updater.ts` connects it to electron-updater and native windows.
 */

import type {
  DesktopUpdateCheckResult,
  DesktopUpdateState,
} from "../src/lib/desktop-platform";

export type UpdateFlowDeps = {
  /** Packaged with an update feed: a copy that can install an update. */
  canUpdate: () => boolean;
  appVersion: () => string;
  /** A native window with the message, the detail and one OK button. */
  tellUser: (message: string, detail: string) => void;
  /** Starts electron-updater's check; null when it considers itself off. */
  startCheck: () => Promise<unknown>;
  quitAndInstall: () => void;
};

const DOWNLOADING_DETAIL =
  "When it’s ready, you’ll see an arrow at the top of the window.";

export function createUpdateFlow(deps: UpdateFlowDeps) {
  let state: DesktopUpdateState["state"] = "idle";
  let downloadingVersion: string | null = null;
  /**
   * The downloaded version. It stays while a newer one is checked for or
   * downloads, so the page's arrow stays too.
   */
  let readyVersion: string | null = null;
  let isChecking = false;
  let installRequested = false;
  /** Callers waiting for the check in progress to find something. */
  let checkWaiters: ((result: DesktopUpdateCheckResult) => void)[] = [];
  const stateListeners = new Set<(state: DesktopUpdateState) => void>();

  function getUpdateState(): DesktopUpdateState {
    return {
      canSelfUpdate: deps.canUpdate(),
      state,
      downloadingVersion,
      readyVersion,
    };
  }

  function setState(next: DesktopUpdateState["state"]): void {
    state = next;
    const snapshot = getUpdateState();
    for (const listener of stateListeners) listener(snapshot);
  }

  /** Where a check that found nothing to download leaves the state. */
  function settledState(): DesktopUpdateState["state"] {
    return readyVersion !== null ? "downloaded" : "idle";
  }

  /** What a check that found nothing to download resolves with. */
  function nothingNewer(): DesktopUpdateCheckResult {
    return readyVersion !== null
      ? { kind: "ready", version: readyVersion }
      : { kind: "up-to-date" };
  }

  function finishCheck(
    next: DesktopUpdateState["state"],
    result: DesktopUpdateCheckResult,
  ): void {
    isChecking = false;
    setState(next);
    const waiters = checkWaiters;
    checkWaiters = [];
    for (const resolve of waiters) resolve(result);
  }

  /**
   * A menu check that finds the update already downloaded (F21). OK only:
   * the arrow in the page is where the user restarts, and OK leaves it as
   * it is.
   */
  function tellUserUpdateAlreadyReady(version: string): void {
    deps.tellUser(
      `Berean ${version} is ready.`,
      "Click the arrow at the top of the window to restart and update.",
    );
  }

  function tellUserCheckResult(result: DesktopUpdateCheckResult): void {
    switch (result.kind) {
      case "unsupported":
        deps.tellUser(
          "This copy of Berean doesn’t update itself.",
          "Only the released app updates itself. Download it from github.com/natyconnor/berean-desktop/releases.",
        );
        return;
      case "up-to-date":
        deps.tellUser(
          "Berean is up to date.",
          `You have the latest version (${deps.appVersion()}).`,
        );
        return;
      case "downloading":
        deps.tellUser(
          `Downloading Berean ${result.version}.`,
          DOWNLOADING_DETAIL,
        );
        return;
      case "ready":
        tellUserUpdateAlreadyReady(result.version);
        return;
      case "error":
        deps.tellUser(
          "Berean couldn’t check for updates.",
          "Check your internet connection and try again later.",
        );
        return;
    }
  }

  /**
   * Checks for an update, or joins the check in progress, and resolves with
   * what it found. A found update starts downloading on its own. Checks go on
   * after a download, so a newer version replaces the one that is ready.
   */
  function checkForUpdates(): Promise<DesktopUpdateCheckResult> {
    if (!deps.canUpdate()) return Promise.resolve({ kind: "unsupported" });
    if (state === "downloading" && downloadingVersion !== null) {
      return Promise.resolve({
        kind: "downloading",
        version: downloadingVersion,
      });
    }

    const result = new Promise<DesktopUpdateCheckResult>((resolve) => {
      checkWaiters.push(resolve);
    });
    if (!isChecking) {
      isChecking = true;
      // With an update ready, the state stays "downloaded" while checking.
      if (readyVersion === null) setState("checking");
      deps.startCheck().then(
        (found) => {
          // electron-updater considers itself inactive; nothing was checked.
          if (found === null) {
            finishCheck(settledState(), { kind: "unsupported" });
          }
        },
        () => {
          // Reported through `handleError`.
        },
      );
    }
    return result;
  }

  return {
    getUpdateState,
    checkForUpdates,

    onUpdateStateChange: (
      listener: (state: DesktopUpdateState) => void,
    ): void => {
      stateListeners.add(listener);
    },

    /** Berean → Check for Updates…: the same check, shown in a window. */
    checkForUpdatesFromMenu: (): void => {
      if (state === "downloading") {
        deps.tellUser("An update is downloading.", DOWNLOADING_DETAIL);
        return;
      }
      void checkForUpdates().then(tellUserCheckResult);
    },

    /**
     * Quits and installs, once: a repeat request does nothing. False when no
     * update is downloaded.
     */
    installDownloadedUpdate: (): boolean => {
      if (readyVersion === null) return false;
      if (installRequested) return true;
      installRequested = true;
      deps.quitAndInstall();
      return true;
    },

    handleUpdateAvailable: (version: string): void => {
      // electron-updater compares with the running version, so it finds the
      // update that is already downloaded again: nothing newer.
      if (version === readyVersion) {
        finishCheck("downloaded", { kind: "ready", version });
        return;
      }
      downloadingVersion = version;
      finishCheck("downloading", { kind: "downloading", version });
    },

    handleUpdateNotAvailable: (): void => {
      finishCheck(settledState(), nothingNewer());
    },

    /** Opens no window: the page shows its arrow. */
    handleUpdateDownloaded: (version: string): void => {
      downloadingVersion = null;
      readyVersion = version;
      setState("downloaded");
    },

    /** Logged by the caller; shown only to a check the user started. */
    handleError: (): void => {
      downloadingVersion = null;
      finishCheck(settledState(), { kind: "error" });
    },
  };
}
