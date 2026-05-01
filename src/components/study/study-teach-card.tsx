import { Link } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUpRight, Check, Loader2 } from "lucide-react";
import { useMutation } from "convex/react";
import { useState, type JSX } from "react";

import { api } from "../../../convex/_generated/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useEsvReference } from "@/hooks/use-esv-reference";
import { useStarterTagBadgeStyle } from "@/lib/tag-color-styles";
import { createPlainTextNoteBody } from "@/lib/note-inline-content";
import { cn } from "@/lib/utils";
import { formatVerseRef, toPassageId } from "@/lib/verse-ref-utils";

import { FlipFaces } from "./flip-faces";
import type {
  PassageNote,
  TeachCard as TeachCardData,
} from "./study-card-model";

const ESV_FADE_S = 0.3;

interface StudyTeachCardProps {
  card: TeachCardData;
  flipped: boolean;
  typedAnswer: string;
  onTypedAnswerChange: (value: string) => void;
  extraPassageNotes: PassageNote[];
  onPassageNoteSaved: (cardId: string, note: PassageNote) => void;
}

export function StudyTeachCard({
  card,
  flipped,
  typedAnswer,
  onTypedAnswerChange,
  extraPassageNotes,
  onPassageNoteSaved,
}: StudyTeachCardProps): JSX.Element {
  const resolveTagStyle = useStarterTagBadgeStyle();
  const refLabel = formatVerseRef(card.reference);
  const passageId = toPassageId(card.reference.book, card.reference.chapter);

  const { data, loading, error } = useEsvReference(card.reference);

  const createNote = useMutation(api.notes.create);
  const findOrCreateRef = useMutation(api.verseRefs.findOrCreate);
  const linkNote = useMutation(api.noteVerseLinks.link);

  const [newNoteDraft, setNewNoteDraft] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  const seenIds = new Set<string>();
  const mergedNotes: PassageNote[] = [];
  for (const note of [...card.passageNotes, ...extraPassageNotes]) {
    if (seenIds.has(note.noteId)) continue;
    seenIds.add(note.noteId);
    mergedNotes.push(note);
  }

  async function handleSaveFollowUp() {
    const trimmed = newNoteDraft.trim();
    if (!trimmed || savingNote) return;
    setSavingNote(true);
    try {
      const body = createPlainTextNoteBody(trimmed);
      const noteId = await createNote({ body, tags: [] });
      const verseRefId = await findOrCreateRef({
        book: card.reference.book,
        chapter: card.reference.chapter,
        startVerse: card.reference.startVerse,
        endVerse: card.reference.endVerse,
      });
      await linkNote({ noteId, verseRefId });
      onPassageNoteSaved(card.id, {
        noteId: String(noteId),
        content: trimmed,
        tags: [],
      });
      setNewNoteDraft("");
      setJustSaved(true);
      window.setTimeout(() => setJustSaved(false), 1500);
    } finally {
      setSavingNote(false);
    }
  }

  const verseBlock = (
    <div className="w-full max-w-xl mx-auto space-y-2 text-base leading-relaxed text-foreground">
      <AnimatePresence mode="wait" initial={false}>
        {loading ? (
          <motion.div
            key="loading"
            className="space-y-2 px-2"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: ESV_FADE_S, ease: "easeOut" }}
          >
            <div className="h-4 w-full animate-pulse rounded bg-muted" />
            <div className="h-4 w-11/12 animate-pulse rounded bg-muted" />
          </motion.div>
        ) : error ? (
          <motion.p
            key="error"
            className="text-sm text-destructive"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: ESV_FADE_S, ease: "easeOut" }}
          >
            Could not load verse text.
          </motion.p>
        ) : data ? (
          // Plain div (not motion) so touch/trackpad scrolling works inside the
          // flipped card’s 3D transform + overflow stack (esp. iOS Safari).
          <div key="data" className="touch-pan-y space-y-2">
            {data.verses.map((verse) => (
              <p key={verse.number}>
                <span className="mr-1 text-xs font-semibold text-muted-foreground align-top">
                  {verse.number}
                </span>
                {verse.text}
              </p>
            ))}
          </div>
        ) : null}
      </AnimatePresence>
    </div>
  );

  const front = (
    <div className="flex h-full w-full flex-col gap-4 px-6 py-8">
      <h2 className="shrink-0 text-center text-2xl font-semibold tracking-tight text-foreground">
        {refLabel}
      </h2>
      <div className="min-h-0 flex-1 touch-pan-y overflow-y-auto overflow-x-hidden overscroll-y-contain pr-1 [-webkit-overflow-scrolling:touch]">
        {verseBlock}
      </div>
      <div className="flex shrink-0 flex-col gap-3">
        <Textarea
          value={typedAnswer}
          onChange={(e) => onTypedAnswerChange(e.target.value)}
          placeholder="Practice teaching a point on this passage. Then reveal to compare with your notes."
          className="mx-auto w-full max-w-xl min-h-[120px] resize-none"
          aria-label="Your teach outline"
        />
      </div>
    </div>
  );

  const hasPractice = typedAnswer.trim().length > 0;
  const practicePane = (
    <section
      className="flex flex-col gap-2"
      aria-labelledby="teach-practice-heading"
    >
      <p
        id="teach-practice-heading"
        className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
      >
        What you wrote
      </p>
      {hasPractice ? (
        // Mount-gate on `flipped` so the entrance animation fires when the
        // card reveals, not silently while the back face is still hidden.
        flipped ? (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="rounded-lg border-2 border-primary/30 bg-primary/5 px-4 py-3 shadow-sm"
          >
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
              {typedAnswer}
            </p>
          </motion.div>
        ) : null
      ) : (
        <div className="rounded-lg border border-dashed bg-muted/30 px-4 py-3">
          <p className="text-sm italic text-muted-foreground">
            You didn&apos;t jot anything this round. Try writing a one-line
            teach point next time.
          </p>
        </div>
      )}
    </section>
  );

  const passagePane = (
    <section
      className="flex flex-col gap-2"
      aria-labelledby="teach-passage-heading"
    >
      <p
        id="teach-passage-heading"
        className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
      >
        Passage
      </p>
      <div
        className={cn(
          "relative isolate max-h-[min(40vh,320px)] min-h-0 overflow-y-auto overflow-x-hidden rounded-lg border bg-card/50 px-4 py-3",
          "touch-pan-y overscroll-y-contain [-webkit-overflow-scrolling:touch]",
        )}
      >
        {verseBlock}
      </div>
    </section>
  );

  const notesPane = (
    <section
      className="flex h-full min-h-0 flex-col gap-2"
      aria-labelledby="teach-notes-heading"
    >
      <div className="flex items-baseline justify-between">
        <p
          id="teach-notes-heading"
          className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
        >
          Your notes on this passage
          {mergedNotes.length > 0 ? ` (${mergedNotes.length})` : ""}
        </p>
      </div>
      {mergedNotes.length === 0 ? (
        <p className="rounded-lg border bg-card px-4 py-3 text-sm text-muted-foreground shadow-sm">
          No saved notes for this passage yet — capture your first one below.
        </p>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto rounded-lg border bg-card/40 shadow-sm">
          <ul className="divide-y">
            {mergedNotes.map((note) => (
              <li key={note.noteId} className="space-y-2 px-4 py-3">
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                  {note.content}
                </p>
                {note.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {note.tags.map((tag) => (
                      <Badge
                        key={tag}
                        variant="outline"
                        className="text-[10px]"
                        style={resolveTagStyle(tag)}
                      >
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );

  const composerPane = (
    <section
      className="flex flex-col gap-2 rounded-lg border bg-card px-4 py-3 shadow-sm"
      aria-labelledby="teach-composer-heading"
    >
      <p
        id="teach-composer-heading"
        className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
      >
        Add a follow-up note
      </p>
      <Textarea
        value={newNoteDraft}
        onChange={(e) => setNewNoteDraft(e.target.value)}
        placeholder="A new thought you had while practicing (optional)"
        className="min-h-[96px] resize-none"
        aria-label="New note for this passage"
        disabled={savingNote}
      />
      <div className="flex items-center justify-end gap-2">
        {justSaved && (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Check className="h-3.5 w-3.5" />
            Saved
          </span>
        )}
        <Button
          type="button"
          size="sm"
          onClick={() => void handleSaveFollowUp()}
          disabled={savingNote || newNoteDraft.trim().length === 0}
        >
          {savingNote && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Save note
        </Button>
      </div>
    </section>
  );

  const back = (
    <div className="flex h-full w-full flex-col gap-4 px-6 py-6">
      <div className="flex shrink-0 items-center justify-between gap-3">
        <h2 className="text-xl font-semibold tracking-tight text-foreground">
          {refLabel}
        </h2>
        <Link
          to="/passage/$passageId"
          params={{ passageId }}
          search={{
            startVerse: card.reference.startVerse,
            endVerse: card.reference.endVerse,
          }}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          Open in passage view
          <ArrowUpRight className="h-3 w-3" />
        </Link>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-5 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div className="flex min-h-0 flex-col gap-4">
          {passagePane}
          {practicePane}
        </div>
        <div className="flex min-h-0 flex-col gap-3">
          <div className="min-h-0 flex-1">{notesPane}</div>
          {composerPane}
        </div>
      </div>
    </div>
  );

  return (
    <FlipFaces
      flipped={flipped}
      front={front}
      back={back}
      className="h-full w-full"
      faceClassName="rounded-xl border bg-card shadow-sm overflow-hidden"
    />
  );
}
