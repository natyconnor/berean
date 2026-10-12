import type * as React from "react";
import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { Toaster as Sonner, type ToasterProps } from "sonner";

import { useTheme } from "@/lib/use-theme";

/** Clears the floating Mode Dock (`bottom-4` plus its pill height). */
const ABOVE_MODE_DOCK = { bottom: 80 };

function Toaster({ ...props }: ToasterProps) {
  const { darkMode } = useTheme();

  return (
    <Sonner
      theme={darkMode ? "dark" : "light"}
      position="bottom-center"
      offset={ABOVE_MODE_DOCK}
      mobileOffset={ABOVE_MODE_DOCK}
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      {...props}
    />
  );
}

export { Toaster };
