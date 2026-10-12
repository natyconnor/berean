import type { ReactNode } from "react";
import { ChevronLeft } from "lucide-react";

import { InternalLink } from "@/components/memory/internal-link";
import { ScrollArea } from "@/components/ui/scroll-area";

import type { MemoryPanelBackLink } from "./memory-panel-context";

/**
 * Full-page frame for a Memory panel: back link, title, subtitle and header
 * actions, then the same body the drawer shows, with more room.
 */
export function MemoryPageShell({
  back,
  title,
  subtitle,
  actions,
  children,
}: {
  back: MemoryPanelBackLink;
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <header className="shrink-0 border-b px-5 py-3 sm:py-4">
        <div className="mx-auto flex max-w-5xl items-start gap-3">
          <div className="min-w-0 flex-1">
            <InternalLink
              href={back.href}
              onClick={back.onClick}
              aria-label={`Back to ${back.label}`}
              className="-ml-1.5 inline-flex min-h-11 items-center gap-0.5 rounded-md pr-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground sm:mb-0.5 sm:min-h-7"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden />
              {back.label}
            </InternalLink>
            <h1 className="truncate text-lg font-semibold tracking-tight">
              {title}
            </h1>
            {subtitle ? (
              <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>
            ) : null}
          </div>
          {actions ? (
            <div className="flex shrink-0 items-center gap-1 pt-1">
              {actions}
            </div>
          ) : null}
        </div>
      </header>
      <ScrollArea className="min-h-0 flex-1">
        <div className="mx-auto max-w-5xl px-5 pt-6 pb-24">{children}</div>
      </ScrollArea>
    </div>
  );
}
