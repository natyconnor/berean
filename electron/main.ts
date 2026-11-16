import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  app,
  BrowserWindow,
  ipcMain,
  Menu,
  shell,
  type MenuItemConstructorOptions,
  type WebContents,
} from "electron";
import { CANONICAL_ORIGIN } from "../shared/http-routes";
import { RETRY_LOAD_CHANNEL } from "./ipc-channels";

/**
 * Berean desktop shell: a native window around the live web app.
 *
 * The shell renders exactly two things: the app origin and its own local
 * offline page. Every other navigation is cancelled and, if it is a web URL,
 * handed to the system browser.
 */

const APP_NAME = "Berean";
/** Shared by every window, so they share one sign-in and it survives relaunch. */
const SESSION_PARTITION = "persist:berean";
/** Chromium's code for a navigation that was cancelled, not one that failed. */
const ERR_ABORTED = -3;

const PRELOAD_SCRIPT = path.join(__dirname, "preload.js");
const OFFLINE_PAGE = path.join(__dirname, "../offline.html");
const OFFLINE_PAGE_URL = pathToFileURL(OFFLINE_PAGE).href;

const appOrigin = resolveAppOrigin();

/** The app URL each window should load when its offline page asks to retry. */
const retryUrls = new WeakMap<WebContents, string>();

function resolveAppOrigin(): string {
  const override = process.env.BEREAN_DESKTOP_URL;
  if (!override) return CANONICAL_ORIGIN;

  try {
    const url = new URL(override);
    if (url.protocol === "https:" || url.protocol === "http:") {
      return url.origin;
    }
  } catch {
    // Fall through to the warning below.
  }

  console.warn(
    `[berean] Ignoring BEREAN_DESKTOP_URL (not an http(s) URL); using ${CANONICAL_ORIGIN}`,
  );
  return CANONICAL_ORIGIN;
}

function isAppUrl(rawUrl: string): boolean {
  try {
    return new URL(rawUrl).origin === appOrigin;
  } catch {
    return false;
  }
}

function isOfflinePageUrl(rawUrl: string | undefined): boolean {
  if (rawUrl === undefined) return false;
  return rawUrl.split(/[?#]/)[0] === OFFLINE_PAGE_URL;
}

/** Opens a web URL in the system browser. Anything else is dropped. */
function openInBrowser(rawUrl: string): void {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return;

  console.info(`[berean] Opening ${url.origin} in the default browser`);
  shell.openExternal(url.toString()).catch((error: unknown) => {
    console.error("[berean] Could not open the default browser:", error);
  });
}

function loadAppUrl(contents: WebContents, url: string): void {
  // A failed load is handled by did-fail-load, which shows the offline page.
  contents.loadURL(url).catch(() => undefined);
}

/**
 * Keeps a WebContents on the app origin. Attached to every WebContents the
 * app ever creates, so no window can be made without it.
 */
function guardNavigation(contents: WebContents): void {
  contents.on("will-navigate", (details) => {
    if (isAppUrl(details.url)) return;
    details.preventDefault();
    openInBrowser(details.url);
  });

  contents.on("will-redirect", (details) => {
    if (!details.isMainFrame || isAppUrl(details.url)) return;
    details.preventDefault();
    openInBrowser(details.url);
  });

  contents.setWindowOpenHandler(({ url }) => {
    if (isAppUrl(url)) {
      createWindow(url);
    } else {
      openInBrowser(url);
    }
    return { action: "deny" };
  });

  contents.on("will-attach-webview", (event) => {
    event.preventDefault();
  });
}

function createWindow(initialUrl = `${appOrigin}/`): BrowserWindow {
  const anchor =
    BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];
  const [anchorX, anchorY] = anchor?.getPosition() ?? [];

  const win = new BrowserWindow({
    title: APP_NAME,
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 700,
    // Offset from an existing window so a new one is visibly new.
    ...(anchorX !== undefined && anchorY !== undefined
      ? { x: anchorX + 24, y: anchorY + 24 }
      : {}),
    backgroundColor: "#14110d",
    webPreferences: {
      partition: SESSION_PARTITION,
      preload: PRELOAD_SCRIPT,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  // The title bar always says "Berean", whatever the page title is.
  win.on("page-title-updated", (event) => {
    event.preventDefault();
  });

  const contents = win.webContents;
  contents.on(
    "did-fail-load",
    (_event, errorCode, _errorDescription, validatedURL, isMainFrame) => {
      if (!isMainFrame || errorCode === ERR_ABORTED) return;
      if (!isAppUrl(validatedURL)) return;
      retryUrls.set(contents, validatedURL);
      contents.loadFile(OFFLINE_PAGE).catch((error: unknown) => {
        console.error("[berean] Could not show the offline page:", error);
      });
    },
  );

  loadAppUrl(contents, initialUrl);
  return win;
}

function focusWindow(win: BrowserWindow): void {
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
}

function focusOrCreateWindow(): void {
  const win = BrowserWindow.getAllWindows()[0];
  if (win) {
    focusWindow(win);
  } else {
    createWindow();
  }
}

/** Reload, except on the offline page, where it means "try the app again". */
function reloadWindow(win: BrowserWindow): void {
  const contents = win.webContents;
  const retryUrl = retryUrls.get(contents);
  if (retryUrl !== undefined && isOfflinePageUrl(contents.getURL())) {
    loadAppUrl(contents, retryUrl);
  } else {
    contents.reload();
  }
}

function registerIpc(): void {
  ipcMain.on(RETRY_LOAD_CHANNEL, (event) => {
    if (!isOfflinePageUrl(event.senderFrame?.url)) return;
    const retryUrl = retryUrls.get(event.sender);
    if (retryUrl !== undefined) loadAppUrl(event.sender, retryUrl);
  });
}

/**
 * The web app owns Cmd+K, Cmd+G, Cmd+, Cmd+J and Cmd+Enter. Nothing here may
 * bind those keys, or the menu would swallow them before the page sees them.
 */
function buildMenu(): Menu {
  const template: MenuItemConstructorOptions[] = [
    {
      label: APP_NAME,
      submenu: [
        { role: "about" },
        { type: "separator" },
        { role: "services" },
        { type: "separator" },
        { role: "hide" },
        { role: "hideOthers" },
        { role: "unhide" },
        { type: "separator" },
        { role: "quit" },
      ],
    },
    {
      label: "File",
      submenu: [
        {
          label: "New Window",
          accelerator: "CmdOrCtrl+N",
          click: () => {
            createWindow();
          },
        },
        { type: "separator" },
        { role: "close" },
      ],
    },
    { role: "editMenu" },
    {
      label: "View",
      submenu: [
        {
          label: "Reload",
          accelerator: "CmdOrCtrl+R",
          click: () => {
            const win = BrowserWindow.getFocusedWindow();
            if (win) reloadWindow(win);
          },
        },
        { role: "toggleDevTools" },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },
    { role: "windowMenu" },
  ];

  return Menu.buildFromTemplate(template);
}

app.setName(APP_NAME);

if (!app.isPackaged) {
  // Keep `desktop:dev` apart from an installed Berean: its own storage, and
  // its own single-instance lock so both can run at once.
  app.setPath("userData", path.join(app.getPath("appData"), "Berean Dev"));
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("web-contents-created", (_event, contents) => {
    guardNavigation(contents);
  });

  app.on("second-instance", () => {
    focusOrCreateWindow();
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });

  app
    .whenReady()
    .then(() => {
      Menu.setApplicationMenu(buildMenu());
      registerIpc();
      createWindow();
    })
    .catch((error: unknown) => {
      console.error("[berean] Failed to start:", error);
      app.quit();
    });
}
