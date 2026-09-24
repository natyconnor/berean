import { useMemo, useState, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useMutation, useQuery } from "convex/react";

import { api } from "../../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  formatChapterRange,
  formatPresetPassage,
  getMemoryPreset,
} from "../../../../shared/memory-presets";

export function CollectionPresetPage() {
  const { presetId } = useParams({ from: "/memory/presets/$presetId" });
  const preset = getMemoryPreset(presetId);
  if (!preset) {
    return (
      <PresetShell>
        <p className="text-sm text-muted-foreground">
          That preset is not in the catalog.
        </p>
      </PresetShell>
    );
  }
  if (preset.kind === "chapter") {
    return <ChapterStart presetId={preset.id} />;
  }
  return <CollectionStart presetId={preset.id} />;
}

function PresetShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <header className="shrink-0 border-b px-5 py-4">
        <Link
          to="/memory/presets"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          All presets
        </Link>
      </header>
      <div className="mx-auto w-full max-w-3xl px-5 pt-6">{children}</div>
    </div>
  );
}

function ChapterStart({ presetId }: { presetId: string }) {
  const preset = getMemoryPreset(presetId);
  const navigate = useNavigate();
  const startPreset = useMutation(api.packs.startPreset);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!preset || preset.kind !== "chapter") return null;

  async function start() {
    setPending(true);
    setError(null);
    try {
      const result = await startPreset({ presetId });
      await navigate({
        to: "/memory/$packId",
        params: { packId: result.packId },
        search: result.created ? { startPassage: true } : {},
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not start");
      setPending(false);
    }
  }

  return (
    <PresetShell>
      <h1 className="text-lg font-semibold tracking-tight">{preset.title}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {formatChapterRange(preset)}. Starting this creates a scope pack and
        begins passage learning. Deleting the pack later keeps any verses you
        have hearted.
      </p>
      {error ? (
        <p className="mt-3 text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <Button className="mt-4" disabled={pending} onClick={() => void start()}>
        {pending ? "Starting…" : "Memorize"}
      </Button>
    </PresetShell>
  );
}

function CollectionStart({ presetId }: { presetId: string }) {
  const preset = getMemoryPreset(presetId);
  const navigate = useNavigate();
  const progress = useQuery(api.packs.presetProgress, {});
  const startPreset = useMutation(api.packs.startPreset);
  const [query, setQuery] = useState("");
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState<"all" | "subset" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const hearted = useMemo(() => {
    const row = progress?.find((item) => item.presetId === presetId);
    return new Set(row?.heartedPassageIds ?? []);
  }, [progress, presetId]);

  if (!preset || preset.kind !== "collection") return null;

  const needle = query.trim().toLowerCase();
  const visible = preset.passages.filter((passage) => {
    if (!needle) return true;
    const label = formatPresetPassage(passage).toLowerCase();
    return (
      label.includes(needle) || passage.book.toLowerCase().includes(needle)
    );
  });

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function start(mode: "all" | "subset") {
    setError(null);
    setPending(mode);
    try {
      const result = await startPreset({
        presetId,
        name: name.trim() || undefined,
        passageIds: mode === "subset" ? [...selected] : undefined,
      });
      await navigate({
        to: "/memory/$packId",
        params: { packId: result.packId },
        search: {},
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not start");
      setPending(null);
    }
  }

  const selectedCount = selected.size;

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <header className="shrink-0 border-b px-5 py-4">
        <Link
          to="/memory/presets"
          className="mb-1 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          All presets
        </Link>
        <h1 className="text-lg font-semibold tracking-tight">{preset.title}</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {preset.description} Deleting the pack later keeps the verses hearted.
        </p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={preset.title}
            aria-label="Pack name"
            className="sm:max-w-xs"
          />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by book or reference"
            aria-label="Search passages"
            className="sm:max-w-xs"
          />
        </div>
      </header>
      <ScrollArea className="min-h-0 flex-1">
        <ul className="mx-auto max-w-3xl space-y-1 px-5 pt-4 pb-28">
          {visible.map((passage) => (
            <PassageRow
              key={passage.id}
              label={formatPresetPassage(passage)}
              checked={selected.has(passage.id)}
              inLibrary={hearted.has(passage.id)}
              onToggle={() => toggle(passage.id)}
            />
          ))}
          {visible.length === 0 ? (
            <li className="py-8 text-sm text-muted-foreground">
              No passages match that search.
            </li>
          ) : null}
        </ul>
      </ScrollArea>
      <div className="shrink-0 border-t bg-background px-5 py-3">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            {selectedCount === 0
              ? `${preset.passages.length} passages`
              : `${selectedCount} selected`}
          </p>
          <div className="flex flex-wrap gap-2">
            {error ? (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : null}
            {selectedCount > 0 ? (
              <Button
                disabled={pending !== null}
                onClick={() => void start("subset")}
              >
                {pending === "subset"
                  ? "Creating…"
                  : `Create pack with ${selectedCount}`}
              </Button>
            ) : (
              <Button
                disabled={pending !== null}
                onClick={() => void start("all")}
              >
                {pending === "all" ? "Starting…" : "Start all"}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function PassageRow({
  label,
  checked,
  inLibrary,
  onToggle,
}: {
  label: string;
  checked: boolean;
  inLibrary: boolean;
  onToggle: () => void;
}) {
  return (
    <li>
      <label className="flex cursor-pointer items-start gap-3 rounded-lg px-2 py-2 hover:bg-muted/60">
        <input
          type="checkbox"
          className="mt-1"
          checked={checked}
          onChange={onToggle}
          aria-label={label}
        />
        <span className="min-w-0">
          <span className="block text-sm font-medium">
            {label}
            {inLibrary ? (
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                In your library
              </span>
            ) : null}
          </span>
        </span>
      </label>
    </li>
  );
}
