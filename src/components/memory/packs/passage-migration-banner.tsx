import { Button } from "@/components/ui/button";

/**
 * One-time note after opt-in start unhearts auto-hearted spans. Leftover
 * user-shaped hearts stay listed on the pack.
 */
export function PassageMigrationBanner({
  unheartedCount,
  keptHeartCount,
  onDismiss,
}: {
  unheartedCount: number;
  keptHeartCount: number;
  onDismiss: () => void;
}) {
  const unheartLabel =
    unheartedCount === 1
      ? "1 auto-hearted unit"
      : `${unheartedCount} auto-hearted units`;
  const keptLabel =
    keptHeartCount === 1
      ? "1 heart you shaped yourself is still listed."
      : keptHeartCount > 0
        ? `${keptHeartCount} hearts you shaped yourself are still listed.`
        : null;

  return (
    <div
      role="status"
      className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-primary/30 bg-primary/[0.03] px-4 py-3"
    >
      <p className="min-w-0 flex-1 text-sm leading-5 text-muted-foreground">
        We unhearted {unheartLabel} so{" "}
        {unheartedCount === 1 ? "it is" : "they are"} not also due as verses.
        {keptLabel ? ` ${keptLabel}` : ""}
      </p>
      <Button
        size="sm"
        variant="outline"
        className="shrink-0"
        onClick={onDismiss}
      >
        Got it
      </Button>
    </div>
  );
}
