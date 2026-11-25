import fs from "node:fs";
import path from "node:path";
import { app, BrowserWindow, dialog, type MessageBoxOptions } from "electron";
import { autoUpdater } from "electron-updater";
import { createUpdateFlow } from "./update-flow";

/**
 * Shell self-update from the releases of natyconnor/berean-desktop (see
 * `publish` in electron-builder.yml). Only the shell updates here; the web app
 * updates with every web deploy.
 *
 * - Off unless packaged with an update feed (`app-update.yml`). Unsigned
 *   builds (`pack`, `dist:unsigned`) are built without one: macOS only
 *   installs updates into a signed app, and electron-updater would otherwise
 *   announce a download as ready before macOS rejects it.
 * - Downloads in the background and installs on quit. A finished download
 *   never opens a window: the page shows an arrow in its top bar, and its
 *   "Restart to update" calls `installDownloadedUpdate`.
 * - Never blocks startup and never shows an error on its own: no network or
 *   no feed just means no update this time. Results and errors are shown
 *   only for a check the user started, from the menu (native windows) or
 *   from Settings (in the page). See `update-flow.ts`.
 */

const FIRST_CHECK_DELAY_MS = 10 * 1000;
const CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000;

/** Packaged, and built with an update feed (signed release builds only). */
function canUpdate(): boolean {
  return (
    app.isPackaged &&
    fs.existsSync(path.join(process.resourcesPath, "app-update.yml"))
  );
}

function tellUser(message: string, detail: string): void {
  const options: MessageBoxOptions = {
    type: "info",
    buttons: ["OK"],
    message,
    detail,
  };
  const parent = BrowserWindow.getFocusedWindow();
  void (parent
    ? dialog.showMessageBox(parent, options)
    : dialog.showMessageBox(options));
}

const flow = createUpdateFlow({
  canUpdate,
  appVersion: () => app.getVersion(),
  tellUser,
  startCheck: () => autoUpdater.checkForUpdates(),
  quitAndInstall: () => {
    autoUpdater.quitAndInstall();
  },
});

export const {
  getUpdateState,
  onUpdateStateChange,
  checkForUpdates,
  checkForUpdatesFromMenu,
  installDownloadedUpdate,
} = flow;

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
    flow.handleUpdateAvailable(info.version);
  });
  autoUpdater.on("update-not-available", () => {
    flow.handleUpdateNotAvailable();
  });
  autoUpdater.on("update-downloaded", (info) => {
    flow.handleUpdateDownloaded(info.version);
  });
  autoUpdater.on("error", (error) => {
    console.error("[berean] Update failed:", error.message);
    flow.handleError();
  });

  const backgroundCheck = (): void => {
    void checkForUpdates();
  };
  setTimeout(backgroundCheck, FIRST_CHECK_DELAY_MS);
  setInterval(backgroundCheck, CHECK_INTERVAL_MS);
}
