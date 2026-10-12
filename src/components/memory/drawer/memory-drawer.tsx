import type { ComponentProps, ReactNode, Ref } from "react";
import { ChevronLeft, Expand, X } from "lucide-react";

import { InternalLink } from "@/components/memory/internal-link";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";

import type { MemoryPanelBackLink } from "./memory-panel-context";

/** The heading that takes focus when a drawer opens or swaps. */
export const MEMORY_PANEL_TITLE_SELECTOR = "[data-memory-panel-title]";

/**
 * The drawer shell: a right-side panel from 640px up, a 92vh bottom sheet
 * below. Esc and the scrim call `onOpenChange(false)`.
 */
export function MemoryDrawer({
  open,
  onOpenChange,
  onOpenAutoFocus,
  contentRef,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenAutoFocus?: ComponentProps<typeof SheetContent>["onOpenAutoFocus"];
  contentRef?: Ref<HTMLDivElement>;
  children: ReactNode;
}) {
  const isMobile = useIsMobile();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        ref={contentRef}
        side={isMobile ? "bottom" : "right"}
        showCloseButton={false}
        overlayClassName="bg-[rgb(20_14_6/0.36)]"
        onOpenAutoFocus={onOpenAutoFocus}
        className={cn(
          "gap-0 ease-out",
          isMobile ? "h-[92dvh]" : "w-[min(66vw,880px)] sm:max-w-none",
        )}
      >
        {isMobile ? (
          <div
            aria-hidden
            className="mx-auto mt-2 h-1.5 w-10 shrink-0 rounded-full bg-muted-foreground/30"
          />
        ) : null}
        {children}
      </SheetContent>
    </Sheet>
  );
}

/**
 * Sticky drawer header (back link, title, subtitle, actions, Open full page,
 * close) over a body that scrolls on its own.
 */
export function MemoryDrawerFrame({
  back,
  title,
  subtitle,
  actions,
  fullPageHref,
  onClose,
  scrollBody = true,
  children,
}: {
  back?: MemoryPanelBackLink;
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  fullPageHref?: string;
  onClose?: () => void;
  scrollBody?: boolean;
  children: ReactNode;
}) {
  return (
    <>
      <header className="flex shrink-0 items-start gap-3 border-b bg-card/50 py-3 pr-3 pl-5 sm:py-3.5 sm:pr-4 sm:pl-6">
        <div className="min-w-0 flex-1 pt-1">
          {back ? (
            <InternalLink
              href={back.href}
              onClick={back.onClick}
              aria-label={`Back to ${back.label}`}
              className="-ml-1.5 mb-1 inline-flex min-h-8 items-center gap-0.5 rounded-md pr-1.5 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden />
              {back.label}
            </InternalLink>
          ) : null}
          <SheetTitle
            tabIndex={-1}
            data-memory-panel-title=""
            className="truncate text-xl font-semibold tracking-tight outline-none"
          >
            {title}
          </SheetTitle>
          {subtitle ? (
            <SheetDescription className="mt-0.5 text-[13px]">
              {subtitle}
            </SheetDescription>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {actions}
          {fullPageHref ? (
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="text-muted-foreground max-sm:size-11 max-sm:px-0"
            >
              <InternalLink href={fullPageHref} aria-label="Open full page">
                <Expand aria-hidden />
                <span className="hidden sm:inline">Open full page</span>
              </InternalLink>
            </Button>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-11 text-muted-foreground sm:size-8"
            onClick={onClose}
            aria-label="Close"
          >
            <X aria-hidden />
          </Button>
        </div>
      </header>
      <div
        className={cn(
          "min-h-0 flex-1",
          scrollBody
            ? "overflow-y-auto overscroll-contain px-5 pt-5 pb-8 sm:px-6"
            : "flex flex-col",
        )}
      >
        {children}
      </div>
    </>
  );
}
