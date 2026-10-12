import {
  Component,
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";
import { useCanGoBack, useNavigate } from "@tanstack/react-router";
import { useQuery } from "convex-helpers/react/cache";
import { motion, useReducedMotion } from "framer-motion";

import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { PackView } from "@/components/memory/packs/pack-view";
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
      return <PackPanel packId={panel.packId as Id<"packs">} />;
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

/** Until the pack detail body lands, the drawer hosts the existing pack view. */
function PackPanel({ packId }: { packId: Id<"packs"> }) {
  const pack = useQuery(api.packs.get, { id: packId });
  return (
    <MemoryPanelFrame
      title={pack?.name ?? "Pack"}
      subtitle={pack === null ? "Pack not found" : "Pack"}
      scrollBody={false}
    >
      <PackView packId={packId} />
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
    return (
      <MemoryPanelFrame title="Not found">
        <p className="py-6 text-sm text-muted-foreground">
          We couldn&apos;t open this. It may have been removed.
        </p>
      </MemoryPanelFrame>
    );
  }
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

  const lastKeyRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    const previous = lastKeyRef.current;
    lastKeyRef.current = key;
    if (previous !== undefined && key !== undefined && previous !== key) {
      focusTitle();
    }
  }, [key, focusTitle]);

  const close = () => void navigate({ to: "/memory", search: {} });

  const frame: MemoryPanelFrameValue | null = shown
    ? {
        surface: "drawer",
        panel: shown.panel,
        from: shown.from,
        returnTo: memoryPanelDrawerHref(shown.panel, { from: shown.from }),
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
            void navigate({ href: memoryPanelDrawerHref(VERSES_PANEL) });
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

function isPlainClick(event: MouseEvent<HTMLAnchorElement>): boolean {
  return (
    event.button === 0 &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey
  );
}

/** A panel as a full page, for deep links and arrivals from other screens. */
export function MemoryPanelPage({
  panel,
  from,
}: {
  panel: MemoryPanel;
  from: MemoryPanelFrom | undefined;
}) {
  const navigate = useNavigate();
  const canGoBack = useCanGoBack();
  const fromVerses = from === "verses" && panel.kind !== "verses";
  const versesHref = memoryPanelFullPagePath(VERSES_PANEL);

  const back: MemoryPanelBackLink = fromVerses
    ? { label: YOUR_VERSES_LABEL, href: versesHref }
    : {
        label: TODAY_LABEL,
        href: "/memory",
        onClick: (event) => {
          if (!canGoBack || !isPlainClick(event)) return;
          event.preventDefault();
          window.history.back();
        },
      };

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
