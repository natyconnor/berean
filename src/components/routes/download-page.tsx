import { Link } from "@tanstack/react-router";
import { useConvexAuth } from "convex/react";
import { Download } from "lucide-react";
import { LegalPageLayout } from "@/components/legal/legal-page-layout";
import { DesktopUpdatesSection } from "@/components/settings/desktop-updates-section";
import { Button } from "@/components/ui/button";
import { isBereanDesktop, isMacBrowser } from "@/lib/desktop-platform";
import { loadTabs } from "@/lib/tab-context-internal";

const MAC_DOWNLOAD_URL =
  "https://github.com/natyconnor/berean-desktop/releases/latest/download/Berean.dmg";

const DESCRIPTION = "All of Berean, in its own app on your Mac.";

/** Berean for Mac: the download on a Mac, a note elsewhere, updates in the app. */
export function DownloadPage() {
  return (
    <LegalPageLayout>
      <div className="max-w-xl">
        <h1 className="mb-3 text-3xl font-semibold tracking-tight">
          Berean for Mac
        </h1>
        {isBereanDesktop() ? (
          <>
            <p className="text-sm text-muted-foreground">
              You’re already using it.
            </p>
            <div className="mt-6">
              <DesktopUpdatesSection />
            </div>
          </>
        ) : (
          <>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {DESCRIPTION}
            </p>
            {isMacBrowser() ? <MacDownload /> : <NotAMac />}
          </>
        )}
      </div>
    </LegalPageLayout>
  );
}

function MacDownload() {
  return (
    <>
      <Button size="lg" asChild className="mt-6">
        <a href={MAC_DOWNLOAD_URL}>
          <Download aria-hidden />
          Download
        </a>
      </Button>
      <h2 className="mt-10 mb-3 text-sm font-semibold">After it downloads</h2>
      <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
        <li>Open Berean.dmg.</li>
        <li>Drag Berean into Applications.</li>
        <li>
          Open Berean and sign in with Google. When your browser asks, allow it
          to open Berean.
        </li>
      </ol>
    </>
  );
}

function NotAMac() {
  // Signed out, or auth still loading, goes to the home page.
  const { isAuthenticated } = useConvexAuth();
  return (
    <>
      <p className="mt-6 rounded-lg border bg-muted/40 p-4 text-sm text-muted-foreground">
        Berean for Mac needs a Mac. You can keep using Berean in your browser.
      </p>
      <Button asChild className="mt-4">
        {isAuthenticated ? (
          <Link
            to="/passage/$passageId"
            params={{ passageId: loadTabs()[0].passageId }}
          >
            Open Berean
          </Link>
        ) : (
          <Link to="/">Open Berean</Link>
        )}
      </Button>
    </>
  );
}
