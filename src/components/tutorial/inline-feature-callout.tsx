import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { FeatureHintState } from "./use-feature-hint";

interface InlineFeatureCalloutProps {
  state: FeatureHintState;
  title: ReactNode;
  description: ReactNode;
  primaryActionLabel?: string;
  onPrimaryAction?: () => void;
  dismissLabel?: string;
  className?: string;
}

/**
 * A small banner-style callout that flows inline with surrounding content.
 * Use this when you want the hint to appear next to a feature without
 * anchoring a popover (e.g. inside a note editor or list empty state).
 */
export function InlineFeatureCallout({
  state,
  title,
  description,
  primaryActionLabel,
  onPrimaryAction,
  dismissLabel = "Got it",
  className,
}: InlineFeatureCalloutProps) {
  const visible = state.pending;

  useEffect(() => {
    if (!visible) return;
    if (state.shown) return;
    state.markShown();
  }, [state, visible]);

  return (
    <AnimatePresence initial={false}>
      {visible ? (
        <motion.div
          key="inline-callout"
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
          className={cn(
            "relative rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-xs text-foreground",
            className,
          )}
          role="status"
        >
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1 space-y-1">
              <p className="font-medium leading-tight">{title}</p>
              <p className="text-muted-foreground leading-snug">
                {description}
              </p>
              {primaryActionLabel ? (
                <div className="pt-1">
                  <Button
                    size="xs"
                    onClick={() => {
                      onPrimaryAction?.();
                      state.complete();
                    }}
                  >
                    {primaryActionLabel}
                  </Button>
                </div>
              ) : null}
            </div>
            <button
              type="button"
              aria-label={dismissLabel}
              onClick={() => state.dismiss()}
              className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
