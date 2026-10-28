import type { JSX, ReactNode } from "react";

import { SessionColumns } from "@/components/memory/practice/session-columns";
import {
  SessionHeaderProgress,
  type SessionProgress,
} from "@/components/memory/practice/session-header-progress";
import { SessionBackButton } from "@/components/memory/session-back-button";
import { ScrollArea } from "@/components/ui/scroll-area";

export function PassageSessionShell({
  phaseLabel,
  packName,
  onExit,
  onHome,
  backLabel,
  exitHref,
  progress,
  persistError,
  aside,
  children,
}: {
  phaseLabel: string;
  packName: string;
  onExit: () => void;
  onHome?: () => void;
  backLabel: string;
  exitHref?: string;
  progress?: SessionProgress;
  persistError: string | null;
  aside?: ReactNode;
  children: ReactNode;
}): JSX.Element {
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background">
      <header className="shrink-0 border-b px-5 py-4">
        <div className="flex min-w-0 items-center gap-3">
          <SessionBackButton
            onExit={onExit}
            onHome={onHome}
            label={backLabel}
            exitHref={exitHref}
          />
          <h1 className="flex min-w-0 items-baseline gap-2 text-lg tracking-tight">
            <span
              className="shrink-0 font-semibold"
              role="status"
              aria-label={`Session phase: ${phaseLabel}`}
            >
              {phaseLabel}
            </span>
            <span aria-hidden className="text-muted-foreground">
              ·
            </span>
            <span className="truncate font-medium text-muted-foreground">
              {packName}
            </span>
          </h1>
          {progress ? <SessionHeaderProgress progress={progress} /> : null}
        </div>
      </header>
      {persistError ? (
        <div
          role="alert"
          className="shrink-0 border-b border-destructive/30 bg-destructive/10 px-5 py-2 text-sm text-destructive"
        >
          {persistError}
        </div>
      ) : null}
      <ScrollArea className="min-h-0 flex-1">
        <div className="mx-auto max-w-6xl px-5 pt-6 pb-24">
          <SessionColumns aside={aside}>{children}</SessionColumns>
        </div>
      </ScrollArea>
    </div>
  );
}
