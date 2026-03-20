import { FlaskConical, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SeedResultSummary {
  seed: number;
  selectedChapters: number;
  heavyChapters: number;
  notesCreated: number;
  verseRefsCreated: number;
  linksCreated: number;
  testamentDistribution: { ot: number; nt: number };
  cleanup: {
    notesDeleted: number;
    linksDeleted: number;
    verseRefsDeleted: number;
  };
  usedTags: string[];
}

interface DevSeedSectionProps {
  isDev: boolean;
  busyAction: string | null;
  seedResult: SeedResultSummary | null;
  onRunDevSeed: () => void | Promise<void>;
}

export function DevSeedSection({
  isDev,
  busyAction,
  seedResult,
  onRunDevSeed,
}: DevSeedSectionProps) {
  if (!isDev) return null;

  return (
    <section className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-sm font-semibold inline-flex items-center gap-2">
            <FlaskConical className="h-4 w-4 text-muted-foreground" />
            Dev note seed
          </h2>
          <p className="text-xs text-muted-foreground">
            Replace your current notes with generated chapter-linked test data
            (50 chapters, 10 heavy).
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => void onRunDevSeed()}
          disabled={busyAction !== null}
        >
          {busyAction === "seed-dev-notes" && (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          )}
          Generate dev test notes
        </Button>
      </div>

      {seedResult && (
        <div className="rounded-md border bg-background p-3 space-y-2 text-xs">
          <p className="text-muted-foreground">
            Seed <code>{seedResult.seed}</code> complete.
          </p>
          <div className="grid gap-1 sm:grid-cols-2">
            <p>
              Notes created:{" "}
              <span className="font-semibold">{seedResult.notesCreated}</span>
            </p>
            <p>
              Verse refs created:{" "}
              <span className="font-semibold">
                {seedResult.verseRefsCreated}
              </span>
            </p>
            <p>
              Links created:{" "}
              <span className="font-semibold">{seedResult.linksCreated}</span>
            </p>
            <p>
              Chapters:{" "}
              <span className="font-semibold">
                {seedResult.selectedChapters} ({seedResult.testamentDistribution.ot}{" "}
                OT / {seedResult.testamentDistribution.nt} NT)
              </span>
            </p>
            <p>
              Heavy chapters:{" "}
              <span className="font-semibold">{seedResult.heavyChapters}</span>
            </p>
            <p>
              Cleanup removed:{" "}
              <span className="font-semibold">
                {seedResult.cleanup.notesDeleted} notes,{" "}
                {seedResult.cleanup.linksDeleted} links,{" "}
                {seedResult.cleanup.verseRefsDeleted} verse refs
              </span>
            </p>
          </div>
          <p className="text-muted-foreground">
            Starter tags used:{" "}
            <span className="font-medium">{seedResult.usedTags.length}</span>
          </p>
        </div>
      )}
    </section>
  );
}
