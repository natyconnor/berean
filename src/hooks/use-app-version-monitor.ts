import { useCallback, useEffect, useRef, useState } from "react";
import {
  hasDetectedNewBuild,
  isValidAppVersionInfo,
  type AppVersionInfo,
} from "@/lib/app-version";
import { devLog, logInteraction } from "@/lib/dev-log";

const VERSION_POLL_INTERVAL_MS = 5 * 60 * 1000;

async function fetchLatestVersion(): Promise<AppVersionInfo | null> {
  const url = new URL("/version.json", window.location.origin);
  url.searchParams.set("t", Date.now().toString());

  const response = await fetch(url.toString(), {
    cache: "no-store",
    headers: {
      accept: "application/json",
    },
  });

  if (!response.ok) return null;

  const payload: unknown = await response.json();
  if (!isValidAppVersionInfo(payload)) return null;

  return payload;
}

export function useAppVersionMonitor() {
  const [latestVersion, setLatestVersion] = useState<AppVersionInfo | null>(
    null,
  );
  const requestInFlightRef = useRef(false);
  const lastDetectedBuildIdRef = useRef<string | null>(null);

  const checkForUpdate = useCallback(async () => {
    if (
      typeof window === "undefined" ||
      requestInFlightRef.current ||
      hasDetectedNewBuild(__APP_BUILD_ID__, latestVersion?.buildId)
    ) {
      return;
    }

    devLog.debug("version", "check-started", {
      currentBuildId: __APP_BUILD_ID__,
    });
    requestInFlightRef.current = true;

    try {
      const version = await fetchLatestVersion();
      if (!version) {
        devLog.debug("version", "check-skipped", {
          reason: "missing-version-payload",
        });
        return;
      }

      devLog.debug("version", "check-completed", {
        currentBuildId: __APP_BUILD_ID__,
        latestBuildId: version.buildId,
        latestAppVersion: version.appVersion,
      });

      if (!hasDetectedNewBuild(__APP_BUILD_ID__, version.buildId)) return;

      if (lastDetectedBuildIdRef.current !== version.buildId) {
        lastDetectedBuildIdRef.current = version.buildId;
        logInteraction("version", "update-detected", {
          currentBuildId: __APP_BUILD_ID__,
          latestAppVersion: version.appVersion,
          latestBuildId: version.buildId,
        });
      }
      setLatestVersion((currentVersion) => currentVersion ?? version);
    } catch (error) {
      devLog.warn("version", "check-failed", {
        error:
          error instanceof Error
            ? error.message
            : "Unknown version check error",
      });
    } finally {
      requestInFlightRef.current = false;
    }
  }, [latestVersion?.buildId]);

  useEffect(() => {
    void checkForUpdate();

    if (hasDetectedNewBuild(__APP_BUILD_ID__, latestVersion?.buildId)) return;

    const intervalId = window.setInterval(() => {
      void checkForUpdate();
    }, VERSION_POLL_INTERVAL_MS);

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void checkForUpdate();
      }
    };
    const handleOnline = () => {
      void checkForUpdate();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("online", handleOnline);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("online", handleOnline);
    };
  }, [checkForUpdate, latestVersion?.buildId]);

  const refreshToLatestVersion = useCallback(() => {
    logInteraction("version", "refresh-requested", {
      currentBuildId: __APP_BUILD_ID__,
      latestBuildId: latestVersion?.buildId,
    });
    window.location.reload();
  }, [latestVersion?.buildId]);

  return {
    currentBuildId: __APP_BUILD_ID__,
    latestVersion,
    updateAvailable: hasDetectedNewBuild(
      __APP_BUILD_ID__,
      latestVersion?.buildId,
    ),
    showRefreshPrompt: hasDetectedNewBuild(
      __APP_BUILD_ID__,
      latestVersion?.buildId,
    ),
    refreshToLatestVersion,
  };
}
