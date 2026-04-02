import fs from "fs";
import path from "path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import type { PluginOption } from "vite";
import { defineConfig } from "vitest/config";

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

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(appVersionInfo.appVersion),
    __APP_BUILD_ID__: JSON.stringify(appVersionInfo.buildId),
    __IS_PREVIEW__: JSON.stringify(process.env.VERCEL_ENV === "preview"),
  },
  plugins: [
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
