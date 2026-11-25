import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  app,
  BrowserWindow,
  ipcMain,
  Menu,
  session,
  shell,
  type MenuItemConstructorOptions,
  type WebContents,
} from "electron";
import {
  parseBereanOpenUrl,
  toAppUrl,
  withAuthCode,
  type BereanAuthTarget,
  type BereanRouteTarget,
} from "../shared/desktop-deep-link";
import { CANONICAL_ORIGIN } from "../shared/http-routes";
import { RETRY_LOAD_CHANNEL } from "./ipc-channels";
import { checkForUpdatesFromMenu, startUpdater } from "./updater";
import {
  findBereanUrl,
  isAllowedFrameUrl,
  isConvexSignInUrl,
  isSameOrigin,
  signInAttemptFromUrl,
  signInCodeTarget,
  type PendingSignIn,
} from "./shell-policy";

/**
 * Berean desktop shell: a native window around the live web app.
 *
 * The shell renders exactly two things: the app origin and its own local
 * offline page. Every other navigation is cancelled and, if it is a web URL,
 * handed to the system browser.
 *
 * Sign-in therefore happens in the browser. The login page navigates to the
 * provider, the guard sends that to the browser, and the browser hands a
 * one-time code back through `berean://auth?code=…` (see README.md).
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

/**
 * The window that sent a sign-in to the browser, and that sign-in's attempt
 * id. `berean://auth` is only accepted while this is set and recent
 * (10 minutes), and only with the same attempt id; it goes back to this
 * window. A new sign-in replaces it, and delivering its code clears it.
 */
let pendingSignIn: PendingSignIn<WebContents> | null = null;

/** The window the user was in last, for links that arrive in the background. */
let lastFocusedWindow: BrowserWindow | null = null;

/** A `berean:` link that arrived before the app finished starting. */
let pendingOpenUrl: string | null = null;
let hasLaunched = false;

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
  return isSameOrigin(rawUrl, appOrigin);
}

function isOfflinePageUrl(rawUrl: string | undefined): boolean {
  if (rawUrl === undefined) return false;
  return rawUrl.split(/[?#]/)[0] === OFFLINE_PAGE_URL;
}

/**
 * Opens a web URL in the system browser and returns true. Anything that is
 * not an http(s) URL is dropped, returning false.
 */
function openInBrowser(rawUrl: string): boolean {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return false;

  // Origin only: sign-in URLs carry state that does not belong in a log.
  console.info(`[berean] Opening ${url.origin} in the default browser`);
  shell.openExternal(url.toString()).catch((error: unknown) => {
    console.error("[berean] Could not open the default browser:", error);
  });
  return true;
}

function loadAppUrl(contents: WebContents, url: string): void {
  retryUrls.set(contents, url);
  // A failed load is handled by did-fail-load, which shows the offline page.
  contents.loadURL(url).catch(() => undefined);
}

function showOfflinePage(contents: WebContents): void {
  contents.loadFile(OFFLINE_PAGE).catch((error: unknown) => {
    console.error("[berean] Could not show the offline page:", error);
  });
}

/**
 * Keeps a WebContents on the app origin. Attached to every WebContents the
 * app ever creates, so no window can be made without it.
 */
function guardNavigation(contents: WebContents): void {
  contents.on("will-navigate", (details) => {
    if (isAppUrl(details.url)) return;
    details.preventDefault();
    if (openInBrowser(details.url) && isConvexSignInUrl(details.url)) {
      // A new sign-in overwrites the web app's verifier, so it always
      // replaces the pending one.
      const attempt = signInAttemptFromUrl(details.url);
      pendingSignIn =
        attempt === null ? null : { contents, attempt, startedAt: Date.now() };
      if (attempt === null) {
        console.warn(
          "[berean] Sign-in has no attempt id; its code will be ignored",
        );
      }
    }
  });

  contents.on("will-redirect", (details) => {
    if (!details.isMainFrame) {
      // will-frame-navigate does not see redirects.
      if (!isAllowedFrameUrl(details.url, appOrigin)) details.preventDefault();
      return;
    }
    if (isAppUrl(details.url)) return;
    details.preventDefault();
    openInBrowser(details.url);
    // Nothing of the app is showing yet, so the window would stay blank.
    if (!isAppUrl(contents.getURL())) showOfflinePage(contents);
  });

  // Main-frame navigations are handled above; frames never leave the app.
  contents.on("will-frame-navigate", (details) => {
    if (details.isMainFrame || isAllowedFrameUrl(details.url, appOrigin)) {
      return;
    }
    details.preventDefault();
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

  win.on("focus", () => {
    lastFocusedWindow = win;
  });
  win.on("closed", () => {
    if (lastFocusedWindow === win) lastFocusedWindow = null;
  });

  const contents = win.webContents;
  contents.on(
    "did-fail-load",
    (_event, errorCode, _errorDescription, validatedURL, isMainFrame) => {
      if (!isMainFrame || errorCode === ERR_ABORTED) return;
      if (!isAppUrl(validatedURL)) return;
      retryUrls.set(contents, validatedURL);
      showOfflinePage(contents);
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

/**
 * The window a link should use: the focused one, else the one used last
 * (Berean is usually in the background when a link arrives), else any.
 */
function preferredWindow(): BrowserWindow | undefined {
  const focused = BrowserWindow.getFocusedWindow();
  if (focused) return focused;
  if (lastFocusedWindow && !lastFocusedWindow.isDestroyed()) {
    return lastFocusedWindow;
  }
  return BrowserWindow.getAllWindows()[0];
}

function focusOrCreateWindow(): void {
  const win = preferredWindow();
  if (win) {
    focusWindow(win);
  } else {
    createWindow();
  }
}

/**
 * Finishes a browser sign-in: reloads a window with `?code=` set. On load the
 * web app exchanges the code using the verifier it stored (in this session's
 * localStorage) when sign-in started, then strips the param.
 */
function finishSignIn(
  target: BereanAuthTarget,
  startedFrom: WebContents,
): void {
  const startedIn = startedFrom.isDestroyed()
    ? null
    : BrowserWindow.fromWebContents(startedFrom);

  const win = startedIn ?? preferredWindow();
  if (!win) {
    createWindow(withAuthCode(`${appOrigin}/`, target.code, target.attempt));
    return;
  }

  const contents = win.webContents;
  const currentUrl = contents.getURL();
  const currentAppUrl = isAppUrl(currentUrl)
    ? currentUrl
    : (retryUrls.get(contents) ?? `${appOrigin}/`);

  loadAppUrl(
    contents,
    withAuthCode(currentAppUrl, target.code, target.attempt),
  );
  focusWindow(win);
}

/**
 * Opens an app route from a `berean://` link, always in a window of its own.
 * The link that launches the app opens its first window at the route; while
 * running, a link opens a new window. It never reloads an existing window:
 * notes do not autosave, and a reload would skip the app's "Discard unsaved
 * notes?" prompt and silently lose a note in progress.
 *
 * Signed out, the web app shows its login page on that URL and renders the
 * route once signed in; the sign-in hand-back reloads the same URL.
 */
function openRoute(target: BereanRouteTarget): void {
  focusWindow(createWindow(toAppUrl(appOrigin, target)));
}

/** Handles a `berean:` link from the OS. Never log the link: it has a code. */
function handleOpenUrl(rawUrl: string): void {
  const target = parseBereanOpenUrl(rawUrl);
  if (target === null) {
    console.info("[berean] Ignoring a berean: link that is not an app route");
    return;
  }

  if (target.kind === "route") {
    console.info(`[berean] Opening ${target.pathname} from a link`);
    openRoute(target);
    return;
  }

  const startedFrom = signInCodeTarget(
    pendingSignIn,
    target.attempt,
    Date.now(),
  );
  if (startedFrom !== null) {
    // Used up: a repeat or stray link must not reload the window again.
    pendingSignIn = null;
    console.info("[berean] Sign-in code received from the browser");
    finishSignIn(target, startedFrom);
  } else {
    console.info(
      "[berean] Ignoring a sign-in link: not for the pending sign-in",
    );
    focusOrCreateWindow();
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

/**
 * The web app needs no permissions (its only async clipboard call is in the
 * dev-only log overlay, which falls back to execCommand). Electron grants
 * everything by default, so refuse everything.
 */
function denyPermissions(): void {
  const appSession = session.fromPartition(SESSION_PARTITION);
  appSession.setPermissionRequestHandler((_contents, _permission, callback) => {
    callback(false);
  });
  appSession.setPermissionCheckHandler(() => false);
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
        {
          label: "Check for Updates…",
          click: () => {
            checkForUpdatesFromMenu();
          },
        },
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

  // A link can arrive before the app is ready to make windows (the one that
  // launched it, on macOS); that one is handled once it is.
  const receiveOpenUrl = (url: string): void => {
    if (hasLaunched) {
      handleOpenUrl(url);
    } else {
      pendingOpenUrl = url;
    }
  };

  // Starting Berean again (other platforms deliver berean: links this way,
  // and so does running the binary with a link argument) reaches this
  // instance instead.
  app.on("second-instance", (_event, argv) => {
    const url = findBereanUrl(argv);
    if (url !== null) {
      receiveOpenUrl(url);
    } else {
      focusOrCreateWindow();
    }
  });

  // macOS delivers berean: links here.
  app.on("open-url", (event, url) => {
    event.preventDefault();
    receiveOpenUrl(url);
  });

  // A link given on the command line of this, the first, instance.
  const launchArgUrl = findBereanUrl(process.argv);
  if (launchArgUrl !== null) receiveOpenUrl(launchArgUrl);

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });

  app
    .whenReady()
    .then(() => {
      denyPermissions();
      Menu.setApplicationMenu(buildMenu());
      registerIpc();
      hasLaunched = true;

      if (pendingOpenUrl !== null) {
        const launchUrl = pendingOpenUrl;
        pendingOpenUrl = null;
        handleOpenUrl(launchUrl);
      }
      // Unless the launching link already opened one.
      if (BrowserWindow.getAllWindows().length === 0) createWindow();

      // Packaged builds only; checks in the background after a delay.
      startUpdater();
    })
    .catch((error: unknown) => {
      console.error("[berean] Failed to start:", error);
      app.quit();
    });
}
