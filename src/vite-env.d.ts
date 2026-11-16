/// <reference types="vite/client" />

declare const __APP_VERSION__: string;
declare const __APP_BUILD_ID__: string;
declare const __IS_PREVIEW__: boolean;

interface Window {
  /** Present only inside the desktop (Electron) shell; set by its preload. */
  bereanDesktop?: import("./lib/desktop-platform").BereanDesktopBridge;
}

declare module "*.md?raw" {
  const content: string;
  export default content;
}
