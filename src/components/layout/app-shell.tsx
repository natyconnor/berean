import { useEffect, type ReactNode } from "react";
import { FeedbackFab } from "@/components/feedback/feedback-fab";
import { GRAIN_CONFIG } from "@/lib/candlelight-grain";
import { TabBar } from "./tab-bar";

function AppShellSurface({ children }: { children: ReactNode }) {
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
      <TabBar />
      <FeedbackFab />
      <div className="flex-1 overflow-hidden">{children}</div>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return <AppShellSurface>{children}</AppShellSurface>;
}
