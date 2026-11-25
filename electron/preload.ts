import { contextBridge, ipcRenderer, type IpcRendererEvent } from "electron";
import type {
  BereanDesktopBridge,
  DesktopUpdateCheckResult,
  DesktopUpdateState,
} from "../src/lib/desktop-platform";
import {
  ANY_UNSAVED_NOTES_CHANNEL,
  DISCARD_REQUEST_CHANNEL,
  RETRY_LOAD_CHANNEL,
  SHELL_VERSION_ARG,
  UNSAVED_NOTES_CHANNEL,
  UPDATE_CHECK_CHANNEL,
  UPDATE_INSTALL_CHANNEL,
  UPDATE_STATE_CHANNEL,
} from "./ipc-channels";

/** What `offline.html` gets on top of the normal bridge. */
type BereanOfflineBridge = { retry: () => void };

function desktopPlatform(): BereanDesktopBridge["platform"] {
  if (process.platform === "darwin" || process.platform === "win32") {
    return process.platform;
  }
  return "linux";
}

/** Main passes its version as a launch argument (see `createWindow`). */
function shellVersion(): string | undefined {
  const prefix = `${SHELL_VERSION_ARG}=`;
  return process.argv
    .find((arg) => arg.startsWith(prefix))
    ?.slice(prefix.length);
}

const desktopBridge: BereanDesktopBridge = {
  isDesktop: true,
  platform: desktopPlatform(),
  shellVersion: shellVersion(),
  subscribeToUpdates: (listener) => {
    const onChange = (_event: IpcRendererEvent, state: DesktopUpdateState) => {
      listener(state);
    };
    ipcRenderer.on(UPDATE_STATE_CHANNEL, onChange);
    void ipcRenderer
      .invoke(UPDATE_STATE_CHANNEL)
      .then((state: DesktopUpdateState) => {
        listener(state);
      });
    return () => {
      ipcRenderer.off(UPDATE_STATE_CHANNEL, onChange);
    };
  },
  checkForUpdates: () =>
    ipcRenderer.invoke(
      UPDATE_CHECK_CHANNEL,
    ) as Promise<DesktopUpdateCheckResult>,
  installUpdate: () => {
    ipcRenderer.send(UPDATE_INSTALL_CHANNEL);
  },
  setHasUnsavedNotes: (hasUnsavedNotes) => {
    ipcRenderer.send(UNSAVED_NOTES_CHANNEL, hasUnsavedNotes);
  },
  hasUnsavedNotes: () =>
    ipcRenderer.invoke(ANY_UNSAVED_NOTES_CHANNEL) as Promise<boolean>,
  onDiscardRequest: (confirm) => {
    const onRequest = (_event: IpcRendererEvent, requestId: number) => {
      void confirm().then((discard) => {
        ipcRenderer.send(DISCARD_REQUEST_CHANNEL, requestId, discard);
      });
    };
    ipcRenderer.on(DISCARD_REQUEST_CHANNEL, onRequest);
    return () => {
      ipcRenderer.off(DISCARD_REQUEST_CHANNEL, onRequest);
    };
  },
};

contextBridge.exposeInMainWorld("bereanDesktop", desktopBridge);

// Only the shell's own offline page can ask main to try the app URL again.
// Main checks the sender too; the web app never sees this.
if (window.location.protocol === "file:") {
  const offlineBridge: BereanOfflineBridge = {
    retry: () => {
      ipcRenderer.send(RETRY_LOAD_CHANNEL);
    },
  };
  contextBridge.exposeInMainWorld("bereanOffline", offlineBridge);
}
