import "@/lib/web-speech";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider, createRouter } from "@tanstack/react-router";
import { ConvexReactClient } from "convex/react";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexQueryCacheProvider } from "convex-helpers/react/cache";
import { routeTree } from "./routeTree.gen";
import { DevLogRoot } from "@/components/dev/dev-log-root";
import { initDevSelectionLogger } from "./lib/dev-selection-logger";
import { isPreviewTestToolsEnabled } from "./lib/preview-test-tools";
import { sttDebugEnabled } from "./lib/stt-log";
import "./index.css";

initDevSelectionLogger();
const sttDebug = sttDebugEnabled();
const showDevLogOverlay = isPreviewTestToolsEnabled() || sttDebug;

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string);

const router = createRouter({
  routeTree,
  defaultPreload: "intent",
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ConvexAuthProvider client={convex}>
      <ConvexQueryCacheProvider>
        {showDevLogOverlay ? <DevLogRoot /> : null}
        <RouterProvider router={router} />
      </ConvexQueryCacheProvider>
    </ConvexAuthProvider>
  </StrictMode>,
);
