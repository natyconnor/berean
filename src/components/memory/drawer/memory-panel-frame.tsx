import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";

import { InternalLink } from "@/components/memory/internal-link";
import { Button } from "@/components/ui/button";
import { TODAY_LABEL } from "@/lib/memory-copy";
import type { MemoryPanel } from "@/lib/memory-panel";
import { cn } from "@/lib/utils";

import { MemoryDrawerFrame } from "./memory-drawer";
import { MemoryPageShell } from "./memory-page-shell";
import { useMemoryPanelFrame } from "./memory-panel-context";

export interface MemoryPanelFrameProps {
  /** Drawer title (focused on open and swap) or page heading. */
  title: ReactNode;
  /** Beside the title, outside the heading (e.g. a Rename button). */
  titleAccessory?: ReactNode;
  subtitle?: ReactNode;
  /** Header actions: cross-links and a ⋯ menu. */
  actions?: ReactNode;
  /** Drawer only: off for bodies that scroll themselves. */
  scrollBody?: boolean;
  children: ReactNode;
}

/**
 * The header slot every panel body renders through. In the drawer it adds
 * the back link, Open full page and close; on a full page, the page shell.
 */
export function MemoryPanelFrame({
  title,
  titleAccessory,
  subtitle,
  actions,
  scrollBody,
  children,
}: MemoryPanelFrameProps) {
  const frame = useMemoryPanelFrame();

  if (frame.surface === "drawer") {
    return (
      <MemoryDrawerFrame
        back={frame.back}
        title={title}
        titleAccessory={titleAccessory}
        subtitle={subtitle}
        actions={actions}
        fullPageHref={frame.fullPageHref}
        onClose={frame.close}
        scrollBody={scrollBody}
      >
        {children}
      </MemoryDrawerFrame>
    );
  }

  return (
    <MemoryPageShell
      back={frame.back ?? { label: TODAY_LABEL, href: "/memory" }}
      title={title}
      titleAccessory={titleAccessory}
      subtitle={subtitle}
      actions={actions}
    >
      {children}
    </MemoryPageShell>
  );
}

/** "Your verses →" / "Your progress →". Hidden in the mobile drawer to save room. */
export function MemoryPanelCrossLink({
  panel,
  label,
}: {
  panel: MemoryPanel;
  label: string;
}) {
  const frame = useMemoryPanelFrame();
  return (
    <Button
      asChild
      variant="ghost"
      size="sm"
      className={cn(
        "text-muted-foreground",
        frame.surface === "drawer" && "hidden sm:inline-flex",
      )}
    >
      <InternalLink href={frame.hrefFor(panel)}>
        {label}
        <ArrowRight aria-hidden />
      </InternalLink>
    </Button>
  );
}
