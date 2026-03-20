import { Button } from "@/components/ui/button";

interface TutorialActionsSectionProps {
  busyAction: string | null;
  onReplayMainTour: () => void;
  onReplaySearchTour: () => void;
}

export function TutorialActionsSection({
  busyAction,
  onReplayMainTour,
  onReplaySearchTour,
}: TutorialActionsSectionProps) {
  return (
    <section className="rounded-lg border bg-card p-4 space-y-3">
      <div className="space-y-1">
        <h2 className="text-sm font-semibold">Tutorials</h2>
        <p className="text-xs text-muted-foreground">
          Replay the guided tours any time.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={onReplayMainTour}
          disabled={busyAction !== null}
        >
          Replay main tour
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={onReplaySearchTour}
          disabled={busyAction !== null}
        >
          Replay advanced search tour
        </Button>
      </div>
    </section>
  );
}
