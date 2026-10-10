import fs from "fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import path from "path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import type { PluginOption, ViteDevServer } from "vite";
import { defineConfig } from "vitest/config";
import { resolveAppPath } from "./shared/http-routes";

type AppVersionInfo = {
  appVersion: string;
  buildId: string;
};

function readPackageVersion(): string {
  const packageJsonPath = path.resolve(__dirname, "package.json");
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8")) as {
    version?: string;
  };

  return packageJson.version ?? "0.0.0";
}

function createAppVersionInfo(): AppVersionInfo {
  const appVersion = readPackageVersion();
  const buildId =
    process.env.VERCEL_DEPLOYMENT_ID ??
    process.env.VERCEL_GIT_COMMIT_SHA ??
    process.env.GITHUB_SHA ??
    `dev-${appVersion}`;

  return {
    appVersion,
    buildId,
  };
}

function appVersionMetadataPlugin(versionInfo: AppVersionInfo): PluginOption {
  const source = JSON.stringify(versionInfo, null, 2);

  return {
    name: "app-version-metadata",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url?.split("?")[0] !== "/version.json") {
          next();
          return;
        }

        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.setHeader("Cache-Control", "no-store");
        res.end(source);
      });
    },
    generateBundle() {
      this.emitFile({
        type: "asset",
        fileName: "version.json",
        source,
      });
    },
  };
}

const appVersionInfo = createAppVersionInfo();

function isViteInternalPath(pathname: string): boolean {
  return (
    pathname.startsWith("/@") ||
    pathname.startsWith("/src/") ||
    pathname.startsWith("/node_modules/") ||
    pathname.startsWith("/__") ||
    pathname.startsWith("/.vite")
  );
}

function sendHtml(
  req: IncomingMessage,
  res: ServerResponse,
  status: number,
  html: string,
) {
  res.statusCode = status;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  if (status === 404) res.setHeader("X-Robots-Tag", "noindex");
  res.end(req.method === "HEAD" ? undefined : html);
}

function buildNotFoundHtml(indexHtml: string): string {
  let html = indexHtml;
  if (!html.includes('name="robots"')) {
    html = html.replace(
      "<head>",
      '<head>\n    <meta name="robots" content="noindex" />',
    );
  }
  return html.replace(
    /<title>[^<]*<\/title>/,
    "<title>Page not found · Berean</title>",
  );
}

function bereanHttpRoutingPlugin(): PluginOption {
  const indexPath = path.resolve(__dirname, "index.html");
  const distIndexPath = path.resolve(__dirname, "dist/index.html");
  const distNotFoundPath = path.resolve(__dirname, "dist/404.html");

  const routeRequest = (
    req: IncomingMessage,
    res: ServerResponse,
    next: (error?: unknown) => void,
    loadNotFoundHtml: () => Promise<string> | string,
  ) => {
    const method = req.method ?? "GET";
    if (method !== "GET" && method !== "HEAD") {
      next();
      return;
    }

    const rawUrl = req.url ?? "/";
    const queryIndex = rawUrl.indexOf("?");
    const rawPath = queryIndex === -1 ? rawUrl : rawUrl.slice(0, queryIndex);
    const search = queryIndex === -1 ? "" : rawUrl.slice(queryIndex);

    let pathname: string;
    try {
      pathname = decodeURI(rawPath);
    } catch {
      res.statusCode = 400;
      res.end();
      return;
    }

    if (isViteInternalPath(pathname)) {
      next();
      return;
    }

    const decision = resolveAppPath(pathname, search);
    if (decision.type === "redirect") {
      res.statusCode = 308;
      res.setHeader("Location", `${decision.pathname}${search}`);
      res.end();
      return;
    }

    if (decision.type !== "not-found") {
      next();
      return;
    }

    try {
      const loaded = loadNotFoundHtml();
      if (typeof loaded === "string") {
        sendHtml(req, res, 404, loaded);
        return;
      }
      loaded
        .then((html) => {
          sendHtml(req, res, 404, html);
        })
        .catch((error: unknown) => {
          next(error);
        });
    } catch (error: unknown) {
      next(error);
    }
  };

  return {
    name: "berean-http-routing",
    configureServer(server: ViteDevServer) {
      server.middlewares.use((req, res, next) => {
        routeRequest(req, res, next, async () => {
          const html = fs.readFileSync(indexPath, "utf8");
          return server.transformIndexHtml("/index.html", html);
        });
      });
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, res, next) => {
        routeRequest(req, res, next, () => {
          const file = fs.existsSync(distNotFoundPath)
            ? distNotFoundPath
            : distIndexPath;
          return fs.readFileSync(file, "utf8");
        });
      });
    },
    closeBundle() {
      if (!fs.existsSync(distIndexPath)) return;
      const html = fs.readFileSync(distIndexPath, "utf8");
      fs.writeFileSync(distNotFoundPath, buildNotFoundHtml(html));
    },
  };
}

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(appVersionInfo.appVersion),
    __APP_BUILD_ID__: JSON.stringify(appVersionInfo.buildId),
    __IS_PREVIEW__: JSON.stringify(process.env.VERCEL_ENV === "preview"),
  },
  plugins: [
    bereanHttpRoutingPlugin(),
    TanStackRouterVite({ target: "react", autoCodeSplitting: true }),
    appVersionMetadataPlugin(appVersionInfo),
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./src/test/setup.ts",
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    exclude: ["**/.pnpm-store/**", "**/dist/**", "**/coverage/**"],
  },
});
