import { Bug, ChevronDown, X } from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  clearDevLog,
  formatDevLogEntryLine,
  getDevLogEntries,
  getMirrorToConsole,
  setMirrorToConsole,
  subscribeDevLog,
  type DevLogLevel,
} from "@/lib/dev-log";
import { cn } from "@/lib/utils";

const OVERLAY_OPEN_KEY = "berean:devLogOverlayOpen";

function readOverlayOpen(): boolean {
  try {
    return sessionStorage.getItem(OVERLAY_OPEN_KEY) === "1";
  } catch {
    return false;
  }
}

function writeOverlayOpen(open: boolean): void {
  try {
    if (open) {
      sessionStorage.setItem(OVERLAY_OPEN_KEY, "1");
    } else {
      sessionStorage.removeItem(OVERLAY_OPEN_KEY);
    }
  } catch {
    /* ignore */
  }
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}

const LEVEL_OPTIONS: Array<{ value: DevLogLevel | "all"; label: string }> = [
  { value: "all", label: "All levels" },
  { value: "error", label: "Error" },
  { value: "warn", label: "Warn" },
  { value: "info", label: "Info" },
  { value: "debug", label: "Debug" },
];

export function DevLogRoot() {
  const entries = useSyncExternalStore(
    subscribeDevLog,
    () => getDevLogEntries(),
    () => [],
  );

  const [open, setOpen] = useState(readOverlayOpen);
  const [filterText, setFilterText] = useState("");
  const [level, setLevel] = useState<DevLogLevel | "all">("all");
  const [mirror, setMirror] = useState(getMirrorToConsole);
  const [copyHint, setCopyHint] = useState<string | null>(null);

  useEffect(() => {
    if (copyHint === null) return;
    const t = window.setTimeout(() => setCopyHint(null), 1600);
    return () => window.clearTimeout(t);
  }, [copyHint]);

  const needle = filterText.trim().toLowerCase();

  const visible = useMemo(() => {
    return entries.filter((e) => {
      if (level !== "all" && e.level !== level) return false;
      if (!needle) return true;
      return (
        e.channel.toLowerCase().includes(needle) ||
        e.body.toLowerCase().includes(needle)
      );
    });
  }, [entries, level, needle]);

  const linesAll = useMemo(
    () => entries.map((e) => formatDevLogEntryLine(e)).join("\n"),
    [entries],
  );

  const linesVisible = useMemo(
    () => visible.map((e) => formatDevLogEntryLine(e)).join("\n"),
    [visible],
  );

  const setOpenPersist = useCallback((next: boolean) => {
    setOpen(next);
    writeOverlayOpen(next);
  }, []);

  const onMirrorChange = useCallback((checked: boolean) => {
    setMirrorToConsole(checked);
    setMirror(checked);
  }, []);

  const onCopyVisible = useCallback(async () => {
    const ok = await copyText(linesVisible);
    setCopyHint(ok ? "Copied visible" : "Copy failed");
  }, [linesVisible]);

  const onCopyAll = useCallback(async () => {
    const ok = await copyText(linesAll);
    setCopyHint(ok ? "Copied all" : "Copy failed");
  }, [linesAll]);

  return (
    <>
      <button
        type="button"
        aria-label={open ? "Close dev log panel" : "Open dev log panel"}
        title="Dev log"
        data-passage-dismiss-exempt
        className={cn(
          "fixed bottom-4 right-4 z-9999 flex h-11 w-11 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-lg transition-[transform,box-shadow] hover:scale-105 hover:shadow-xl",
          open && "ring-2 ring-primary ring-offset-2 ring-offset-background",
        )}
        onClick={() => setOpenPersist(!open)}
      >
        <Bug className="h-5 w-5" />
      </button>

      {open && (
        <div
          className="fixed right-4 bottom-18 z-9998 flex h-[min(420px,50vh)] w-[min(560px,calc(100vw-2rem))] flex-col overflow-hidden rounded-lg border border-border bg-card text-card-foreground shadow-xl"
          role="dialog"
          aria-label="Development log"
          data-passage-dismiss-exempt
        >
          <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
            <span className="text-sm font-semibold">Dev log</span>
            {copyHint && (
              <span className="text-xs text-muted-foreground">{copyHint}</span>
            )}
            <div className="ml-auto flex flex-wrap items-center gap-1">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={onCopyVisible}
              >
                Copy visible
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={onCopyAll}
              >
                Copy all
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => clearDevLog()}
              >
                Clear
              </Button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-8 w-8 shrink-0"
                aria-label="Close"
                onClick={() => setOpenPersist(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="flex flex-col gap-2 border-b border-border px-3 py-2 sm:flex-row sm:items-center">
            <Input
              placeholder="Filter by channel or message…"
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              className="h-8 flex-1 text-sm"
              aria-label="Filter logs"
            />
            <div className="relative shrink-0">
              <select
                className="border-input bg-background h-8 w-full min-w-34 appearance-none rounded-md border px-2 pr-8 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] sm:w-auto"
                value={level}
                onChange={(e) =>
                  setLevel(e.target.value as DevLogLevel | "all")
                }
                aria-label="Log level filter"
              >
                {LEVEL_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="text-muted-foreground pointer-events-none absolute top-1/2 right-2 h-4 w-4 -translate-y-1/2 opacity-70" />
            </div>
          </div>

          <label className="flex cursor-pointer items-center gap-2 border-b border-border px-3 py-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              className="accent-primary h-3.5 w-3.5 rounded border border-input"
              checked={mirror}
              onChange={(e) => onMirrorChange(e.target.checked)}
            />
            Mirror new lines to browser console
          </label>

          <ScrollArea className="min-h-0 min-w-0 flex-1">
            <ul className="font-mono text-[11px] leading-snug">
              {visible.length === 0 ? (
                <li className="text-muted-foreground px-3 py-6 text-center text-xs">
                  No matching entries
                </li>
              ) : (
                visible.map((e) => (
                  <li
                    key={e.id}
                    className="border-border/50 hover:bg-muted/40 border-b px-3 py-1.5 wrap-break-word whitespace-pre-wrap"
                  >
                    <span className="text-muted-foreground">
                      {new Date(e.ts).toLocaleTimeString(undefined, {
                        hour12: false,
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })}{" "}
                    </span>
                    <span
                      className={cn(
                        e.level === "error" && "text-destructive",
                        e.level === "warn" &&
                          "text-amber-600 dark:text-amber-400",
                        e.level === "info" && "text-sky-600 dark:text-sky-400",
                        e.level === "debug" && "text-muted-foreground",
                      )}
                    >
                      [{e.level}]
                    </span>{" "}
                    <span className="text-foreground/90">{e.channel}</span>{" "}
                    <span className="text-foreground">{e.body}</span>
                  </li>
                ))
              )}
            </ul>
          </ScrollArea>

          <div className="text-muted-foreground border-t border-border px-3 py-1.5 text-[10px]">
            {visible.length} visible · {entries.length} total
          </div>
        </div>
      )}
    </>
  );
}
