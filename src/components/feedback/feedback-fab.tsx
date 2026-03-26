import { Loader2, MessageSquarePlus } from "lucide-react";
import { useCallback, useState, type ComponentProps } from "react";
import { flushSync } from "react-dom";
import { useMutation } from "convex/react";
import { toCanvas } from "html-to-image";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  devLog,
  formatRecentDevLogEntriesForExport,
  logInteraction,
} from "@/lib/dev-log";
import { cn } from "@/lib/utils";

const CAPTURE_FILTER = (node: HTMLElement) => {
  const maybeElement = node as Element;
  if (
    typeof maybeElement.closest === "function" &&
    maybeElement.closest("[data-capture-ignore]")
  ) {
    return false;
  }
  return true;
};

function getCaptureNode(): HTMLElement | null {
  return document.querySelector<HTMLElement>("[data-feedback-capture-root]");
}

type FeedbackKind = "bug" | "feature";
const MAX_CAPTURE_WIDTH = 1280;
const MAX_CAPTURE_HEIGHT = 800;
const TARGET_SCREENSHOT_BYTES = 100 * 1024;
const MIN_SCREENSHOT_BYTES = 45 * 1024;
const BUG_REPORT_LOG_WINDOW_MS = 60_000;
const BUG_REPORT_APP_LOG_MAX_CHARS = 350_000;
const BUG_REPORT_CAPTURE_LOG_MAX_CHARS = 40_000;
const BUG_REPORT_NO_RECENT_LOGS =
  "(No recent app log entries captured in the last 60 seconds.)";

function truncateText(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  const omittedChars = text.length - maxChars;
  return `[truncated ${omittedChars} chars]\n${text.slice(-maxChars)}`;
}

function buildBugReportLogsText(captureDebugLines: readonly string[]): string {
  const recentAppLogs =
    formatRecentDevLogEntriesForExport(BUG_REPORT_LOG_WINDOW_MS, {
      maxChars: BUG_REPORT_APP_LOG_MAX_CHARS,
    }) || BUG_REPORT_NO_RECENT_LOGS;
  const captureLogs =
    captureDebugLines.length > 0
      ? truncateText(
          captureDebugLines.join("\n"),
          BUG_REPORT_CAPTURE_LOG_MAX_CHARS,
        )
      : "(No capture diagnostics recorded.)";

  return [
    "=== Recent app logs (last 60s) ===",
    recentAppLogs,
    "",
    "=== Feedback capture diagnostics ===",
    captureLogs,
  ].join("\n");
}

function waitForNextFrame(): Promise<void> {
  return new Promise((resolve) => {
    window.requestAnimationFrame(() => resolve());
  });
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality?: number,
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), type, quality);
  });
}

function scaleCanvas(
  source: HTMLCanvasElement,
  width: number,
  height: number,
): HTMLCanvasElement {
  const nextCanvas = document.createElement("canvas");
  nextCanvas.width = width;
  nextCanvas.height = height;
  const ctx = nextCanvas.getContext("2d");
  if (!ctx) {
    throw new Error("Could not create screenshot canvas context");
  }
  ctx.drawImage(source, 0, 0, width, height);
  return nextCanvas;
}

async function compressScreenshot(
  canvas: HTMLCanvasElement,
  logCaptureDebug: (message: string, details?: Record<string, unknown>) => void,
): Promise<Blob> {
  let workingCanvas = canvas;

  for (const quality of [0.72, 0.58, 0.46, 0.36]) {
    const blob = await canvasToBlob(workingCanvas, "image/webp", quality);
    logCaptureDebug("compression attempt", {
      width: workingCanvas.width,
      height: workingCanvas.height,
      quality,
      size: blob?.size ?? 0,
      type: blob?.type ?? null,
    });
    if (
      blob &&
      (blob.size <= TARGET_SCREENSHOT_BYTES || blob.size <= MIN_SCREENSHOT_BYTES)
    ) {
      return blob;
    }
    if (blob && blob.size <= TARGET_SCREENSHOT_BYTES * 1.25) {
      return blob;
    }
  }

  while (workingCanvas.width > 640 && workingCanvas.height > 400) {
    const nextWidth = Math.max(640, Math.round(workingCanvas.width * 0.82));
    const nextHeight = Math.max(400, Math.round(workingCanvas.height * 0.82));
    workingCanvas = scaleCanvas(workingCanvas, nextWidth, nextHeight);

    for (const quality of [0.5, 0.4, 0.32]) {
      const blob = await canvasToBlob(workingCanvas, "image/webp", quality);
      logCaptureDebug("compression retry", {
        width: workingCanvas.width,
        height: workingCanvas.height,
        quality,
        size: blob?.size ?? 0,
        type: blob?.type ?? null,
      });
      if (blob && blob.size <= TARGET_SCREENSHOT_BYTES) {
        return blob;
      }
    }
  }

  const fallbackBlob = await canvasToBlob(workingCanvas, "image/webp", 0.3);
  if (!fallbackBlob) {
    throw new Error("Could not encode screenshot");
  }
  logCaptureDebug("compression fallback", {
    width: workingCanvas.width,
    height: workingCanvas.height,
    size: fallbackBlob.size,
    type: fallbackBlob.type,
  });
  return fallbackBlob;
}

function createCaptureDebugLogger(lines: string[]) {
  return (message: string, details?: Record<string, unknown>) => {
    const suffix = details ? ` ${JSON.stringify(details)}` : "";
    const line = `[feedback-capture] ${message}${suffix}`;
    lines.push(line);
    if (details) {
      devLog.info("feedback-capture", message, details);
    } else {
      devLog.info("feedback-capture", message);
    }
    console.info(line);
  };
}

export function FeedbackFab() {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<FeedbackKind>("bug");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [captureWarning, setCaptureWarning] = useState<string | null>(null);

  const generateUploadUrl = useMutation(api.feedback.generateFeedbackUploadUrl);
  const submitFeedback = useMutation(api.feedback.submitFeedback);

  const resetForm = useCallback(() => {
    setKind("bug");
    setDescription("");
    setError(null);
    setCaptureWarning(null);
  }, []);

  const onOpenChange = useCallback(
    (next: boolean) => {
      if (next !== open) {
        logInteraction("feedback", next ? "dialog-opened" : "dialog-closed", {
          kind,
        });
      }
      setOpen(next);
      if (!next) resetForm();
    },
    [kind, open, resetForm],
  );

  const onSubmit = useCallback(async () => {
    const trimmed = description.trim();
    if (!trimmed) {
      setError("Please add a description.");
      return;
    }

    flushSync(() => {
      setSubmitting(true);
      setError(null);
      setCaptureWarning(null);
    });
    await waitForNextFrame();

    const path = `${window.location.pathname}${window.location.search}`;
    const userAgent =
      typeof navigator !== "undefined" ? navigator.userAgent : undefined;

    let screenshotId: Id<"_storage"> | undefined;
    let logsText: string | undefined;
    const warnings: string[] = [];
    const captureDebugLines: string[] = [];
    const logCaptureDebug = createCaptureDebugLogger(captureDebugLines);

    try {
      if (kind === "bug") {
        let blob: Blob | null = null;
        try {
          logCaptureDebug("starting");
          const captureNode = getCaptureNode();
          if (!captureNode) {
            throw new Error("Could not find the app view to capture");
          }

          const rect = captureNode.getBoundingClientRect();
          const backgroundColor =
            getComputedStyle(captureNode).backgroundColor ||
            getComputedStyle(document.body).backgroundColor;
          logCaptureDebug("resolved capture node", {
            tagName: captureNode.tagName,
            width: Math.round(rect.width),
            height: Math.round(rect.height),
            backgroundColor,
          });

          await waitForNextFrame();
          logCaptureDebug("animation frame settled");

          const scale = Math.min(
            1,
            MAX_CAPTURE_WIDTH / Math.max(1, rect.width),
            MAX_CAPTURE_HEIGHT / Math.max(1, rect.height),
          );
          const targetWidth = Math.max(1, Math.round(rect.width * scale));
          const targetHeight = Math.max(1, Math.round(rect.height * scale));
          logCaptureDebug("rendering canvas", {
            targetWidth,
            targetHeight,
            scale,
          });

          const canvas = await toCanvas(captureNode, {
            filter: CAPTURE_FILTER,
            cacheBust: true,
            skipFonts: true,
            pixelRatio: 1,
            backgroundColor,
            width: Math.max(1, Math.round(rect.width)),
            height: Math.max(1, Math.round(rect.height)),
            canvasWidth: targetWidth,
            canvasHeight: targetHeight,
          });
          logCaptureDebug("canvas completed", {
            width: canvas.width,
            height: canvas.height,
          });
          blob = await compressScreenshot(canvas, logCaptureDebug);
          logCaptureDebug("blob completed", {
            hasBlob: blob !== null,
            size: blob.size,
            type: blob.type,
          });
        } catch (captureErr) {
          devLog.error("feedback-capture", "capture failed", captureErr);
          console.error("[feedback-capture] capture failed", captureErr);
          warnings.push(
            captureErr instanceof Error
              ? `Screenshot failed (${captureErr.message}).`
              : "Screenshot failed.",
          );
          logCaptureDebug("capture error", {
            message:
              captureErr instanceof Error ? captureErr.message : "Unknown error",
          });
        }

        if (!blob || blob.size === 0) {
          if (warnings.length === 0) {
            warnings.push("No screenshot captured.");
          }
          logCaptureDebug("capture produced no blob");
        } else {
          try {
            const postUrl = await generateUploadUrl();
            logCaptureDebug("generated upload url");
            const uploadRes = await fetch(postUrl, {
              method: "POST",
              headers: { "Content-Type": blob.type || "image/png" },
              body: blob,
            });
            logCaptureDebug("upload response", {
              ok: uploadRes.ok,
              status: uploadRes.status,
            });
            if (!uploadRes.ok) {
              throw new Error(`Upload failed (${uploadRes.status})`);
            }
            const json = (await uploadRes.json()) as { storageId: string };
            screenshotId = json.storageId as Id<"_storage">;
            logCaptureDebug("upload completed", {
              storageId: json.storageId,
            });
          } catch (uploadErr) {
            devLog.error("feedback-capture", "upload failed", uploadErr);
            console.error("[feedback-capture] upload failed", uploadErr);
            warnings.push(
              uploadErr instanceof Error
                ? `Could not upload screenshot: ${uploadErr.message}`
                : "Could not upload screenshot.",
            );
            logCaptureDebug("upload error", {
              message:
                uploadErr instanceof Error ? uploadErr.message : "Unknown error",
            });
          }
        }

        logsText = buildBugReportLogsText(captureDebugLines);

        if (warnings.length > 0) {
          setCaptureWarning(
            `${warnings.join(" ")} Submitting without image if needed.`,
          );
        }
      }

      await submitFeedback({
        kind,
        description: trimmed,
        path,
        userAgent,
        logsText: kind === "bug" ? logsText : undefined,
        screenshotId: kind === "bug" ? screenshotId : undefined,
      });
      logInteraction("feedback", "submitted", {
        kind,
        hasScreenshot: kind === "bug" && !!screenshotId,
        hasWarnings: warnings.length > 0,
      });

      setOpen(false);
      resetForm();
    } catch (e) {
      logInteraction("feedback", "submit-failed", {
        kind,
        message: e instanceof Error ? e.message : "unknown-error",
      });
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }, [description, generateUploadUrl, kind, resetForm, submitFeedback]);

  return (
    <div data-capture-ignore>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label="Give feedback on the app"
            className={cn(
              "fixed bottom-4 left-4 z-9999 flex h-11 w-11 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-lg transition-[transform,box-shadow] hover:scale-105 hover:shadow-xl",
              open &&
                "ring-2 ring-primary ring-offset-2 ring-offset-background",
            )}
            onClick={() => {
              logInteraction("feedback", "dialog-opened", { kind });
              setOpen(true);
            }}
          >
            <MessageSquarePlus className="h-5 w-5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="right" sideOffset={8}>
          Give feedback on the app
        </TooltipContent>
      </Tooltip>

      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className="z-10020 sm:max-w-md"
          data-capture-ignore
          overlayClassName="z-10019"
          overlayProps={
            {
              "data-capture-ignore": true,
            } as ComponentProps<typeof DialogOverlay>
          }
        >
          <DialogHeader>
            <DialogTitle>Feedback</DialogTitle>
            <DialogDescription>
              Bug reports may auto-upload a screenshot of what is on screen and
              in-app diagnostic logs. Describe what happened or what you would
              like to see.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-3">
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="text-muted-foreground">Type</span>
              <select
                className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                value={kind}
                disabled={submitting}
                onChange={(e) => {
                  const nextKind = e.target.value as FeedbackKind;
                  logInteraction("feedback", "kind-changed", { kind: nextKind });
                  setKind(nextKind);
                }}
                aria-label="Feedback type"
              >
                <option value="bug">Bug report</option>
                <option value="feature">Feature request</option>
              </select>
            </label>

            <label className="flex flex-col gap-1.5 text-sm">
              <span className="text-muted-foreground">Description</span>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={submitting}
                placeholder="What went wrong or what would help you?"
                rows={5}
                className="min-h-[120px] resize-y"
                aria-label="Description"
              />
            </label>

            {error && (
              <p className="text-destructive text-sm" role="alert">
                {error}
              </p>
            )}
            {captureWarning && (
              <p className="text-amber-600 text-sm dark:text-amber-400">
                {captureWarning}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={submitting}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={submitting}
              onClick={() => void onSubmit()}
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                "Send"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
