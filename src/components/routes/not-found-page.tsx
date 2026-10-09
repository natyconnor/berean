import { Link, useCanGoBack, useLocation } from "@tanstack/react-router";
import { useConvexAuth } from "convex/react";
import { Compass } from "lucide-react";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Button } from "@/components/ui/button";
import { useDismissSplashBackdrop } from "@/hooks/use-dismiss-splash";
import { GRAIN_CONFIG } from "@/lib/candlelight-grain";
import { DARK_MODE_STORAGE_KEY } from "@/lib/theme-provider";
import { cn } from "@/lib/utils";
import { warmManuscriptTheme } from "@/themes/theme-warm-manuscript";

export const NOT_FOUND_DOCUMENT_TITLE = "Page not found · Berean";

function readStoredDarkMode(): boolean {
  try {
    return localStorage.getItem(DARK_MODE_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

function manuscriptStyle(dark: boolean): CSSProperties {
  const vars = dark ? warmManuscriptTheme.darkVars : warmManuscriptTheme.vars;
  return {
    ...vars,
    "--cl-grain-intensity": String(GRAIN_CONFIG.grainIntensity),
  } as CSSProperties;
}

export function NotFoundPage() {
  useDismissSplashBackdrop();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const { pathname } = useLocation();
  const canGoBack = useCanGoBack();
  const { isAuthenticated } = useConvexAuth();
  const [dark] = useState(readStoredDarkMode);
  const homeLabel = isAuthenticated ? "Back to your notes" : "Go to Berean";

  useEffect(() => {
    document.title = NOT_FOUND_DOCUMENT_TITLE;
    let meta = document.querySelector<HTMLMetaElement>('meta[name="robots"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "robots";
      document.head.appendChild(meta);
    }
    meta.content = "noindex";
    headingRef.current?.focus();

    return () => {
      document.title = "Berean";
      document.querySelectorAll('meta[name="robots"]').forEach((node) => {
        if (node.getAttribute("content") === "noindex") node.remove();
      });
    };
  }, []);

  return (
    <div
      className={cn("min-h-dvh bg-background text-foreground", dark && "dark")}
      style={manuscriptStyle(dark)}
    >
      <div
        className="cl-theme cl-grain-full cl-grain-lightfalloff flex min-h-dvh flex-col"
        style={
          {
            "--cl-grain-intensity": String(GRAIN_CONFIG.grainIntensity),
            paddingTop: "max(1.5rem, env(safe-area-inset-top))",
            paddingRight: "max(1.5rem, env(safe-area-inset-right))",
            paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))",
            paddingLeft: "max(1.5rem, env(safe-area-inset-left))",
          } as CSSProperties
        }
      >
        <header className="relative z-10">
          <Link
            to="/"
            className="rounded-sm text-sm tracking-[0.16em] text-foreground outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            style={{
              fontFamily: '"Cormorant SC", Georgia, serif',
              fontWeight: 400,
            }}
          >
            Berean
          </Link>
        </header>

        <main className="relative z-10 flex flex-1 items-center justify-center">
          <div className="w-full max-w-[420px] -translate-y-6 text-center sm:-translate-y-10">
            <div className="mx-auto flex size-12 items-center justify-center rounded-full border border-border bg-card text-muted-foreground">
              <Compass className="size-6" aria-hidden />
            </div>
            <p className="mt-5 text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
              404
            </p>
            <h1
              ref={headingRef}
              tabIndex={-1}
              className="mt-2 font-serif text-2xl font-semibold tracking-tight text-foreground outline-none sm:text-3xl"
            >
              This page isn&apos;t here
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              The link may be mistyped, or the page may have moved.
            </p>
            <p
              className="mx-auto mt-4 max-w-full truncate rounded-md border border-border bg-muted px-2.5 py-1 font-mono text-xs text-muted-foreground"
              title={pathname}
            >
              {pathname}
            </p>
            <div className="mt-6 flex w-full flex-col gap-2 sm:flex-row sm:justify-center">
              <Button asChild className="w-full sm:w-auto">
                <Link to="/">{homeLabel}</Link>
              </Button>
              {canGoBack ? (
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full sm:w-auto"
                  onClick={() => {
                    window.history.back();
                  }}
                >
                  Go back
                </Button>
              ) : null}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
