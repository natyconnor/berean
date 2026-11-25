import { useEffect, type ReactNode } from "react";
import { FeedbackFab } from "@/components/feedback/feedback-fab";
import { UnsavedNotesDiscardDialog } from "@/components/unsaved-notes-discard-dialog";
import { GRAIN_CONFIG } from "@/lib/candlelight-grain";
import { ModeDock } from "./mode-dock";
import { TabBar } from "./tab-bar";
import type { WebUpdate } from "./update-indicator";

type AppShellProps = {
  children: ReactNode;
  /** A new web build, shown as the desktop app's update arrow. */
  webUpdate?: WebUpdate | null;
};

function AppShellSurface({ children, webUpdate }: AppShellProps) {
  useEffect(() => {
    if (!GRAIN_CONFIG.grainLightFalloff) return;

    const root = document.documentElement;
    let rafId = 0;

    const onMove = (e: MouseEvent) => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        root.style.setProperty(
          "--cl-light-x",
          `${(e.clientX / window.innerWidth) * 100}%`,
        );
        root.style.setProperty(
          "--cl-light-y",
          `${(e.clientY / window.innerHeight) * 100}%`,
        );
      });
    };

    const onLeave = () => {
      cancelAnimationFrame(rafId);
      root.style.removeProperty("--cl-light-x");
      root.style.removeProperty("--cl-light-y");
    };

    document.addEventListener("mousemove", onMove);
    root.addEventListener("mouseleave", onLeave);

    return () => {
      cancelAnimationFrame(rafId);
      document.removeEventListener("mousemove", onMove);
      root.removeEventListener("mouseleave", onLeave);
      root.style.removeProperty("--cl-light-x");
      root.style.removeProperty("--cl-light-y");
    };
  }, []);

  return (
    <div
      data-feedback-capture-root
      className="flex flex-col h-screen w-screen overflow-hidden bg-background cl-theme cl-grain-full cl-grain-lightfalloff"
      style={
        {
          "--cl-grain-intensity": GRAIN_CONFIG.grainIntensity,
        } as React.CSSProperties
      }
    >
      <TabBar webUpdate={webUpdate} />
      <FeedbackFab />
      {/* Mode Dock is position:fixed and floats over content; pages add their own scroll padding. */}
      <div className="flex-1 overflow-hidden">{children}</div>
      <ModeDock />
      <UnsavedNotesDiscardDialog />
    </div>
  );
}

export function AppShell({ children, webUpdate }: AppShellProps) {
  return <AppShellSurface webUpdate={webUpdate}>{children}</AppShellSurface>;
}
