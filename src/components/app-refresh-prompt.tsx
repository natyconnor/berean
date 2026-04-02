import { Button } from "@/components/ui/button";

type AppRefreshPromptProps = {
  onRefresh: () => void;
};

export function AppRefreshPrompt({ onRefresh }: AppRefreshPromptProps) {
  return (
    <div
      aria-live="polite"
      className="fixed right-3 bottom-3 z-50 w-[min(24rem,calc(100vw-1.5rem))] rounded-xl border border-border/70 bg-background/95 p-4 shadow-2xl backdrop-blur"
      role="status"
    >
      <div className="space-y-1">
        <p className="text-sm font-semibold tracking-tight">
          An update is available.
        </p>
        <p className="text-sm text-muted-foreground">
          Refresh to get the latest version of Berean.
        </p>
      </div>
      <div className="mt-4 flex justify-end">
        <Button type="button" onClick={onRefresh}>
          Refresh now
        </Button>
      </div>
    </div>
  );
}
