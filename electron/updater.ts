import fs from "node:fs";
import path from "node:path";
import {
  app,
  BrowserWindow,
  dialog,
  type MessageBoxOptions,
  type MessageBoxReturnValue,
} from "electron";
import { autoUpdater } from "electron-updater";

/**
 * Shell self-update from the releases of natyconnor/berean-desktop (see
 * `publish` in electron-builder.yml). Only the shell updates here; the web app
 * updates with every web deploy.
 *
 * - Off unless packaged with an update feed (`app-update.yml`). Unsigned
 *   builds (`pack`, `dist:unsigned`) are built without one: macOS only
 *   installs updates into a signed app, and electron-updater would otherwise
 *   announce a download as ready before macOS rejects it.
 * - Downloads in the background and installs on quit. When a download is
 *   ready it offers Restart Now / Later.
 * - Never blocks startup and never shows an error on its own: no network or
 *   no feed just means no update this time. Results and errors are shown
 *   only for a check the user started from the menu.
 */

const FIRST_CHECK_DELAY_MS = 10 * 1000;
const CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000;

type UpdateState = "idle" | "checking" | "downloading" | "downloaded";

let state: UpdateState = "idle";
/** The check in progress was started from "Check for Updates…". */
let userAskedForCheck = false;
let readyVersion: string | null = null;
let isRestartPromptOpen = false;

function showMessage(
  options: MessageBoxOptions,
): Promise<MessageBoxReturnValue> {
  const parent = BrowserWindow.getFocusedWindow();
  return parent
    ? dialog.showMessageBox(parent, options)
    : dialog.showMessageBox(options);
}

function tellUser(message: string, detail?: string): void {
  void showMessage({ type: "info", buttons: ["OK"], message, detail });
}

async function offerRestart(): Promise<void> {
  if (isRestartPromptOpen) return;
  isRestartPromptOpen = true;
  try {
    const { response } = await showMessage({
      type: "info",
      buttons: ["Restart Now", "Later"],
      defaultId: 0,
      cancelId: 1,
      message: "A new version of Berean is ready.",
      detail: `Restart to finish updating to Berean ${readyVersion ?? ""}. If you choose Later, it installs the next time you quit.`,
    });
    if (response === 0) autoUpdater.quitAndInstall();
  } finally {
    isRestartPromptOpen = false;
  }
}

async function checkForUpdates(fromMenu: boolean): Promise<void> {
  if (state === "downloaded") {
    if (fromMenu) await offerRestart();
    return;
  }
  if (state === "downloading") {
    if (fromMenu) {
      tellUser(
        "An update is downloading.",
        "Berean will ask you to restart when it is ready.",
      );
    }
    return;
  }
  if (state === "checking") {
    // Report this check's result to the user too.
    userAskedForCheck ||= fromMenu;
    return;
  }

  state = "checking";
  userAskedForCheck = fromMenu;
  try {
    const result = await autoUpdater.checkForUpdates();
    if (result === null) {
      // electron-updater considers itself inactive; nothing was checked.
      state = "idle";
      userAskedForCheck = false;
    }
  } catch {
    // Reported by the "error" listener.
  }
}

/** Packaged, and built with an update feed (signed release builds only). */
function canUpdate(): boolean {
  return (
    app.isPackaged &&
    fs.existsSync(path.join(process.resourcesPath, "app-update.yml"))
  );
}

export function checkForUpdatesFromMenu(): void {
  if (!canUpdate()) {
    tellUser(
      "This copy of Berean doesn’t update itself.",
      "Only the released app updates itself. Download it from github.com/natyconnor/berean-desktop/releases.",
    );
    return;
  }
  void checkForUpdates(true);
}

export function startUpdater(): void {
  if (!canUpdate()) return;

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.logger = {
    info: (message?: unknown) => console.info("[berean] Updater:", message),
    warn: (message?: unknown) => console.warn("[berean] Updater:", message),
    error: (message?: unknown) => console.error("[berean] Updater:", message),
    debug: () => undefined,
  };

  autoUpdater.on("update-available", (info) => {
    state = "downloading";
    if (userAskedForCheck) {
      tellUser(
        `Downloading Berean ${info.version}.`,
        "Berean will ask you to restart when it is ready.",
      );
    }
    userAskedForCheck = false;
  });

  autoUpdater.on("update-not-available", () => {
    state = "idle";
    if (userAskedForCheck) {
      tellUser(
        "Berean is up to date.",
        `You have the latest version (${app.getVersion()}).`,
      );
    }
    userAskedForCheck = false;
  });

  autoUpdater.on("update-downloaded", (info) => {
    state = "downloaded";
    readyVersion = info.version;
    void offerRestart();
  });

  autoUpdater.on("error", (error) => {
    console.error("[berean] Update failed:", error.message);
    if (state !== "downloaded") state = "idle";
    if (userAskedForCheck) {
      tellUser(
        "Berean couldn’t check for updates.",
        "Check your internet connection and try again later.",
      );
    }
    userAskedForCheck = false;
  });

  const backgroundCheck = (): void => {
    void checkForUpdates(false);
  };
  setTimeout(backgroundCheck, FIRST_CHECK_DELAY_MS);
  setInterval(backgroundCheck, CHECK_INTERVAL_MS);
}
