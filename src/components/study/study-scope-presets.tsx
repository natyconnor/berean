import { BIBLE_BOOKS } from "@/lib/bible-books";
import { Button } from "@/components/ui/button";

const OT_BOOKS = BIBLE_BOOKS.filter((b) => b.testament === "OT").map(
  (b) => b.name,
);
const NT_BOOKS = BIBLE_BOOKS.filter((b) => b.testament === "NT").map(
  (b) => b.name,
);
const GOSPEL_BOOKS = ["Matthew", "Mark", "Luke", "John"];
const PAULINE_BOOKS = [
  "Romans",
  "1 Corinthians",
  "2 Corinthians",
  "Galatians",
  "Ephesians",
  "Philippians",
  "Colossians",
  "1 Thessalonians",
  "2 Thessalonians",
  "1 Timothy",
  "2 Timothy",
  "Titus",
  "Philemon",
];

interface Preset {
  label: string;
  books: string[];
}

const PRESETS: Preset[] = [
  { label: "All Scripture", books: [] },
  { label: "Old Testament", books: OT_BOOKS },
  { label: "New Testament", books: NT_BOOKS },
  { label: "Gospels", books: GOSPEL_BOOKS },
  { label: "Paul\u2019s Letters", books: PAULINE_BOOKS },
];

function sameSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const setB = new Set(b);
  return a.every((v) => setB.has(v));
}

interface StudyScopePresetsProps {
  selectedBooks: string[];
  onSelectPreset: (books: string[]) => void;
}

export function StudyScopePresets({
  selectedBooks,
  onSelectPreset,
}: StudyScopePresetsProps) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {PRESETS.map((preset) => {
        const isActive = sameSet(selectedBooks, preset.books);
        return (
          <Button
            key={preset.label}
            size="xs"
            variant={isActive ? "secondary" : "outline"}
            onClick={() => onSelectPreset(preset.books)}
          >
            {preset.label}
          </Button>
        );
      })}
    </div>
  );
}
