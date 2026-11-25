import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { useDesktopUpdateState } from "@/hooks/use-desktop-update-state";
import {
  isBereanDesktop,
  type DesktopUpdateCheckResult,
  type DesktopUpdateState,
} from "@/lib/desktop-platform";
import { cn } from "@/lib/utils";

const RELEASES_URL = "https://github.com/natyconnor/berean-desktop/releases";

type Status = DesktopUpdateCheckResult | { kind: "checking" } | null;

/**
 * A download in progress becomes "ready" the moment it finishes (when the
 * top bar's arrow appears), or clears if it failed.
 */
function followDownload(
  status: Status,
  live: DesktopUpdateState | null,
): Status {
  if (status?.kind !== "downloading" || live === null) return status;
  if (live.state === "downloaded" && live.readyVersion !== null) {
    return { kind: "ready", version: live.readyVersion };
  }
  return live.state === "downloading" ? status : null;
}

function statusLine(status: Status): ReactNode {
  switch (status?.kind) {
    case "up-to-date":
      return "You have the latest version.";
    case "downloading":
      return `Downloading Berean ${status.version}.`;
    case "ready":
      return `Berean ${status.version} is ready.`;
    case "error":
      return "Couldn’t check for updates. Check your internet connection and try again.";
    case "unsupported":
      return (
        <>
          This copy doesn’t update itself.{" "}
          <a
            href={RELEASES_URL}
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-4 hover:text-foreground"
          >
            Download the released app
          </a>
          .
        </>
      );
    default:
      return null;
  }
}

function DesktopUpdatesCard({ currentVersion }: { currentVersion: string }) {
  const live = useDesktopUpdateState();
  const [checked, setChecked] = useState<Status>(null);
  // The state when Settings opened: a download already running shows
  // without a click.
  const [opened, setOpened] = useState<DesktopUpdateState | null>(null);
  if (opened === null && live !== null) setOpened(live);

  const openedDownloading: Status =
    opened?.state === "downloading" && opened.downloadingVersion !== null
      ? { kind: "downloading", version: opened.downloadingVersion }
      : null;
  const status = followDownload(checked ?? openedDownloading, live);

  const handleCheck = async () => {
    setChecked({ kind: "checking" });
    const result = await window.bereanDesktop?.checkForUpdates?.();
    setChecked(result ?? { kind: "error" });
  };

  return (
    <section className="rounded-lg border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-sm font-semibold">Berean for Mac</h2>
          <p className="text-xs text-muted-foreground">
            Version {currentVersion}
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          disabled={
            status?.kind === "checking" || status?.kind === "downloading"
          }
          onClick={() => void handleCheck()}
        >
          {status?.kind === "checking"
            ? "Checking…"
            : status?.kind === "downloading"
              ? "Downloading…"
              : "Check for updates"}
        </Button>
      </div>
      <p
        role="status"
        aria-live="polite"
        className={cn(
          "mt-2 text-xs text-muted-foreground",
          status?.kind === "error" && "text-destructive",
        )}
      >
        {statusLine(status)}
      </p>
    </section>
  );
}

/** The desktop app's version and update check. Absent on the website. */
export function DesktopUpdatesSection() {
  const shellVersion = isBereanDesktop()
    ? window.bereanDesktop?.shellVersion
    : undefined;
  if (!shellVersion) return null;
  return <DesktopUpdatesCard currentVersion={shellVersion} />;
}
