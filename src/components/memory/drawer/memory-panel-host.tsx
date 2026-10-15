import {
  Component,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useNavigate } from "@tanstack/react-router";
import { motion, useReducedMotion } from "framer-motion";

import type { Id } from "../../../../convex/_generated/dataModel";
import { PackDetail } from "@/components/memory/packs/pack-detail";
import { ProgressBody } from "@/components/memory/progress/progress-body";
import { VerseDetailPanel } from "@/components/memory/verse-detail";
import { VersesDrawerBody } from "@/components/memory/verses/verses-drawer-body";
import { VersesPageBody } from "@/components/memory/verses/verses-page-body";
import {
  TODAY_LABEL,
  YOUR_PROGRESS_LABEL,
  YOUR_VERSES_LABEL,
} from "@/lib/memory-copy";
import {
  formatMemoryPanel,
  memoryPanelDrawerHref,
  memoryPanelFullPagePath,
  parseMemoryPanel,
  type MemoryPanel,
  type MemoryPanelFrom,
} from "@/lib/memory-panel";

import { MEMORY_PANEL_TITLE_SELECTOR, MemoryDrawer } from "./memory-drawer";
import {
  MemoryPanelFrameContext,
  useMemoryPanelFrame,
  type MemoryPanelBackLink,
  type MemoryPanelFrameValue,
} from "./memory-panel-context";
import { MemoryPanelCrossLink, MemoryPanelFrame } from "./memory-panel-frame";

/**
 * Memory's drawers and their full pages. `MemoryPanelHost` shows a panel as a
 * drawer over Today (`/memory?panel=…`); `MemoryPanelPage` shows the same
 * panel as a page. Both render {@link MemoryPanelContent}, so moving a panel
 * between the two only touches this file.
 */

const VERSES_PANEL: MemoryPanel = { kind: "verses" };

function MemoryPanelContent({ panel }: { panel: MemoryPanel }) {
  switch (panel.kind) {
    case "progress":
      return <ProgressPanel />;
    case "verses":
      return <VersesPanel />;
    case "verse":
      return (
        <VerseDetailPanel verseRefId={panel.verseRefId as Id<"verseRefs">} />
      );
    case "pack":
      return <PackDetail packId={panel.packId as Id<"packs">} />;
  }
}

function ProgressPanel() {
  return (
    <MemoryPanelFrame
      title={YOUR_PROGRESS_LABEL}
      subtitle="How your memory is growing: practice, accuracy and mastery"
      actions={
        <MemoryPanelCrossLink panel={VERSES_PANEL} label={YOUR_VERSES_LABEL} />
      }
    >
      <ProgressBody />
    </MemoryPanelFrame>
  );
}

function VersesPanel() {
  const { surface } = useMemoryPanelFrame();
  return (
    <MemoryPanelFrame
      title={YOUR_VERSES_LABEL}
      subtitle="Everything you're learning and have memorized"
      actions={
        <MemoryPanelCrossLink
          panel={{ kind: "progress" }}
          label={YOUR_PROGRESS_LABEL}
        />
      }
    >
      {surface === "drawer" ? <VersesDrawerBody /> : <VersesPageBody />}
    </MemoryPanelFrame>
  );
}

/** A bad link (an id that was never valid) shows a message instead of breaking Today. */
class PanelErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return <NotFoundPanel />;
  }
}

/** Nothing to open, so no Open full page either. */
function NotFoundPanel() {
  const frame = useMemoryPanelFrame();
  return (
    <MemoryPanelFrameContext.Provider
      value={{ ...frame, fullPageHref: undefined }}
    >
      <MemoryPanelFrame title="Not found">
        <p className="py-6 text-sm text-muted-foreground">
          We couldn&apos;t open this. It may have been removed.
        </p>
      </MemoryPanelFrame>
    </MemoryPanelFrameContext.Provider>
  );
}

/** The drawer over Today. `panel` and `from` are `/memory`'s search params. */
export function MemoryPanelHost({
  panel: rawPanel,
  from,
}: {
  panel: string | undefined;
  from: MemoryPanelFrom | undefined;
}) {
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const panel = parseMemoryPanel(rawPanel);
  const key = panel ? formatMemoryPanel(panel) : undefined;

  // Keep the last panel on screen while the drawer animates closed.
  const [shown, setShown] = useState<{
    key: string;
    panel: MemoryPanel;
    from: MemoryPanelFrom | undefined;
  } | null>(null);
  if (panel && key && (shown?.key !== key || shown.from !== from)) {
    setShown({ key, panel, from });
  }

  const contentRef = useRef<HTMLDivElement>(null);
  const focusTitle = useCallback(() => {
    contentRef.current
      ?.querySelector<HTMLElement>(MEMORY_PANEL_TITLE_SELECTOR)
      ?.focus({ preventScroll: true });
  }, []);

  // Panels open by navigation, not a Radix trigger, so remember what had
  // focus to hand it back on close.
  const openerRef = useRef<HTMLElement | null>(null);
  const isOpen = panel !== undefined;
  useLayoutEffect(() => {
    if (!isOpen) return;
    const active = document.activeElement;
    openerRef.current =
      active instanceof HTMLElement && active !== document.body ? active : null;
  }, [isOpen]);

  const lastKeyRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    const previous = lastKeyRef.current;
    lastKeyRef.current = key;
    if (previous !== undefined && key !== undefined && previous !== key) {
      focusTitle();
    }
  }, [key, focusTitle]);

  // Replace, so Back doesn't reopen a drawer that was just closed.
  const close = () =>
    void navigate({ to: "/memory", search: {}, replace: true });

  const frame: MemoryPanelFrameValue | null = shown
    ? {
        surface: "drawer",
        panel: shown.panel,
        from: shown.from,
        returnTo: "/memory",
        hrefFor: memoryPanelDrawerHref,
        back:
          shown.from === "verses" && shown.panel.kind !== "verses"
            ? {
                label: YOUR_VERSES_LABEL,
                href: memoryPanelDrawerHref(VERSES_PANEL),
              }
            : undefined,
        fullPageHref: memoryPanelFullPagePath(shown.panel, {
          from: shown.from,
        }),
        close,
        exit: () => {
          if (shown.from === "verses") {
            void navigate({
              href: memoryPanelDrawerHref(VERSES_PANEL),
              replace: true,
            });
          } else {
            close();
          }
        },
      }
    : null;

  return (
    <MemoryDrawer
      open={panel !== undefined}
      onOpenChange={(open) => {
        if (!open) close();
      }}
      onOpenAutoFocus={(event) => {
        event.preventDefault();
        focusTitle();
      }}
      onCloseAutoFocus={(event) => {
        const opener = openerRef.current;
        openerRef.current = null;
        if (opener?.isConnected) {
          event.preventDefault();
          opener.focus({ preventScroll: true });
        }
      }}
      contentRef={contentRef}
    >
      {frame && shown ? (
        <MemoryPanelFrameContext.Provider value={frame}>
          <motion.div
            key={shown.key}
            className="flex min-h-0 flex-1 flex-col"
            initial={{ opacity: 0, x: reduceMotion ? 0 : 8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            <PanelErrorBoundary>
              <MemoryPanelContent panel={shown.panel} />
            </PanelErrorBoundary>
          </motion.div>
        </MemoryPanelFrameContext.Provider>
      ) : null}
    </MemoryDrawer>
  );
}

/**
 * A panel as a full page, for deep links and arrivals from other screens.
 * Its back link always goes to plain Today (or the Your verses page), never
 * through history, which may hold another mode's screen.
 */
export function MemoryPanelPage({
  panel,
  from,
}: {
  panel: MemoryPanel;
  from: MemoryPanelFrom | undefined;
}) {
  const navigate = useNavigate();
  const fromVerses = from === "verses" && panel.kind !== "verses";
  const versesHref = memoryPanelFullPagePath(VERSES_PANEL);

  const back: MemoryPanelBackLink = fromVerses
    ? { label: YOUR_VERSES_LABEL, href: versesHref }
    : { label: TODAY_LABEL, href: "/memory" };

  const frame: MemoryPanelFrameValue = {
    surface: "page",
    panel,
    from,
    returnTo: memoryPanelFullPagePath(panel, { from }),
    hrefFor: memoryPanelFullPagePath,
    back,
    fullPageHref: undefined,
    close: undefined,
    exit: () =>
      void navigate({
        href: fromVerses ? versesHref : "/memory",
        replace: true,
      }),
  };

  return (
    <MemoryPanelFrameContext.Provider value={frame}>
      <PanelErrorBoundary key={formatMemoryPanel(panel)}>
        <MemoryPanelContent panel={panel} />
      </PanelErrorBoundary>
    </MemoryPanelFrameContext.Provider>
  );
}
