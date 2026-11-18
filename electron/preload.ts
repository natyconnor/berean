import { contextBridge, ipcRenderer } from "electron";
import type { BereanDesktopBridge } from "../src/lib/desktop-platform";
import { RETRY_LOAD_CHANNEL } from "./ipc-channels";

/** What `offline.html` gets on top of the normal bridge. */
type BereanOfflineBridge = { retry: () => void };

function desktopPlatform(): BereanDesktopBridge["platform"] {
  if (process.platform === "darwin" || process.platform === "win32") {
    return process.platform;
  }
  return "linux";
}

const desktopBridge: BereanDesktopBridge = {
  isDesktop: true,
  platform: desktopPlatform(),
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
