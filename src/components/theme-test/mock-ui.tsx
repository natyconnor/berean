/**
 * Static mock of the app's main UI elements for theme previewing.
 * No Convex queries — everything is hardcoded sample data.
 */

import { Plus, X, ChevronLeft, ChevronRight, Search } from "lucide-react";

export function MockUI() {
  return (
    <div className="flex flex-col h-full overflow-hidden text-[--foreground] bg-[--background] font-sans">
      {/* Tab bar */}
      <div className="flex items-center border-b border-[--border] bg-[--muted]/30 h-10 shrink-0 px-1 gap-0">
        <MockTab label="John 1" active />
        <MockTab label="Mark 1" active={false} />
        <MockTab label="Genesis 1" active={false} />
        <div className="ml-auto flex items-center gap-1 px-1">
          <button className="h-8 w-8 flex items-center justify-center rounded hover:bg-[--muted] text-[--muted-foreground]">
            <Search className="h-4 w-4" />
          </button>
          <button className="h-8 w-8 flex items-center justify-center rounded hover:bg-[--muted] text-[--muted-foreground]">
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Split content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Bible panel */}
        <div className="flex-1 overflow-y-auto px-6 pb-8">
          {/* Chapter header */}
          <div className="flex items-center justify-between py-4">
            <button className="h-8 w-8 flex items-center justify-center rounded text-[--muted-foreground] hover:bg-[--muted]">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <h1 className="text-2xl font-serif font-semibold tracking-tight">
              John 1
            </h1>
            <button className="h-8 w-8 flex items-center justify-center rounded text-[--muted-foreground] hover:bg-[--muted]">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Verses */}
          <div className="space-y-0.5">
            <MockVerse
              number={1}
              text="In the beginning was the Word, and the Word was with God, and the Word was God."
              selected
            />
            <MockVerse
              number={2}
              text="He was in the beginning with God."
              hasNote
            />
            <MockVerse
              number={3}
              text="All things were made through him, and without him was not any thing made that was made."
            />
            <MockVerse
              number={4}
              text="In him was life, and the life was the light of men."
              hovered
            />
            <MockVerse
              number={5}
              text="The light shines in the darkness, and the darkness has not overcome it."
            />
            <MockVerse
              number={6}
              text="There was a man sent from God, whose name was John."
              hasNote
            />
            <MockVerse
              number={7}
              text="He came as a witness, to bear witness about the light, that all might believe through him."
            />
          </div>
        </div>

        {/* Divider */}
        <div className="w-px bg-[--border] shrink-0" />

        {/* Notes panel */}
        <div className="w-72 shrink-0 overflow-y-auto p-4 space-y-3">
          <div className="flex items-center gap-2 pl-1 border-l-2 border-[--primary]">
            <h2 className="text-xs font-semibold text-[--muted-foreground] uppercase tracking-wider">
              Notes
            </h2>
          </div>

          {/* Note editor */}
          <MockNoteEditor />

          {/* Regular note bubble */}
          <MockNoteBubble
            verse="v. 1"
            content="Original greek for Word is Logos — the rational principle governing the cosmos, now revealed personally in Christ."
            tags={["greek", "christology"]}
          />

          {/* Passage note bubble */}
          <MockNoteBubble
            verse="vv. 6–8"
            content="John the Baptist isn't just any man. He was sent from God. God sends people. He uses people for His purposes."
            tags={["john-the-baptist", "purpose"]}
            isPassage
          />

          {/* Stacked note bubble */}
          <MockNoteBubbleStack
            verse="v. 14"
            count={3}
            preview="And the Word became flesh and dwelt among us..."
          />
        </div>
      </div>
    </div>
  );
}

function MockTab({ label, active }: { label: string; active: boolean }) {
  return (
    <div
      className={[
        "flex items-center gap-1 h-10 px-4 border-r border-[--border] cursor-pointer select-none text-sm transition-colors",
        active
          ? "bg-[--background] text-[--foreground] border-b-2 border-b-[--primary]"
          : "text-[--muted-foreground] hover:bg-[--muted]/50",
      ].join(" ")}
    >
      <span>{label}</span>
      {active && (
        <span className="ml-1 p-0.5 rounded-sm hover:bg-[--muted-foreground]/20">
          <X className="h-3 w-3" />
        </span>
      )}
    </div>
  );
}

function MockVerse({
  number,
  text,
  selected,
  hasNote,
  hovered,
}: {
  number: number;
  text: string;
  selected?: boolean;
  hasNote?: boolean;
  hovered?: boolean;
}) {
  return (
    <div
      className={[
        "group relative flex gap-2 py-2 px-3 min-h-[2.5rem] rounded-sm transition-colors",
        selected ? "bg-[--primary]/10 ring-1 ring-[--primary]/20" : "",
        hovered && !selected ? "bg-[--muted]" : "",
        !selected && !hovered ? "" : "",
      ].join(" ")}
    >
      <span className="flex items-start gap-1 shrink-0 pt-0.5">
        <span className="text-xs font-semibold text-[--muted-foreground] tabular-nums min-w-[1.5rem] text-right">
          {number}
        </span>
        {hasNote && (
          <span className="w-1.5 h-1.5 rounded-full bg-[--primary]/70 mt-1.5 shrink-0" />
        )}
      </span>
      <span className="font-serif text-sm leading-relaxed flex-1">{text}</span>
      {hovered && (
        <button className="absolute right-1 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-[--primary]/10">
          <Plus className="h-4 w-4 text-[--primary]" />
        </button>
      )}
    </div>
  );
}

function MockNoteEditor() {
  return (
    <div className="border border-[--border] rounded-lg p-3 bg-[--card] shadow-sm space-y-2">
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-[--secondary] text-[--secondary-foreground] text-xs font-normal">
          John 1:4
        </span>
        <button className="h-6 w-6 flex items-center justify-center rounded hover:bg-[--muted] text-[--muted-foreground]">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="min-h-[60px] w-full rounded-md border border-[--input] bg-[--background] px-3 py-2 text-sm text-[--muted-foreground] italic">
        Write your note...
      </div>
      <div className="flex justify-end gap-2">
        <button className="h-8 px-3 text-xs rounded-md hover:bg-[--muted] text-[--muted-foreground]">
          Cancel
        </button>
        <button className="h-8 px-3 text-xs rounded-md bg-[--primary] text-[--primary-foreground] opacity-50 cursor-not-allowed">
          Save
        </button>
      </div>
    </div>
  );
}

function MockNoteBubble({
  verse,
  content,
  tags,
  isPassage,
}: {
  verse: string;
  content: string;
  tags: string[];
  isPassage?: boolean;
}) {
  return (
    <div
      className={[
        "border rounded-lg p-3 shadow-sm space-y-1.5",
        isPassage
          ? "bg-amber-50/80 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800"
          : "bg-[--card] border-[--border]",
      ].join(" ")}
    >
      <div className="flex items-center gap-1.5">
        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-[--secondary] text-[--secondary-foreground] text-xs font-normal">
          {verse}
        </span>
        {isPassage && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md border border-amber-300 text-amber-700 text-xs font-normal">
            passage
          </span>
        )}
      </div>
      <p className="text-sm leading-relaxed">{content}</p>
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1 pt-0.5">
          {tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center px-2 py-0.5 rounded-md border border-[--border] text-xs text-[--muted-foreground]"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function MockNoteBubbleStack({
  verse,
  count,
  preview,
}: {
  verse: string;
  count: number;
  preview: string;
}) {
  return (
    <div className="relative cursor-pointer">
      <div className="absolute inset-0 translate-x-1.5 translate-y-1.5 rounded-lg border border-[--border] bg-[--muted]/50" />
      <div className="absolute inset-0 translate-x-0.5 translate-y-0.5 rounded-lg border border-[--border] bg-[--muted]/70" />
      <div className="relative border border-[--border] rounded-lg p-3 bg-[--card]">
        <div className="flex items-center justify-between mb-1">
          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-[--secondary] text-[--secondary-foreground] text-xs font-normal">
            {verse}
          </span>
          <span className="inline-flex items-center px-2 py-0.5 rounded-md border border-[--border] text-xs text-[--muted-foreground]">
            {count} notes
          </span>
        </div>
        <p className="text-sm text-[--muted-foreground] truncate">{preview}</p>
      </div>
    </div>
  );
}
