import { Link } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import type { JSX } from "react";

import { Textarea } from "@/components/ui/textarea";
import { useEsvReference } from "@/hooks/use-esv-reference";
import { diffWords, type DiffToken } from "@/lib/diff-words";
import { formatVerseRef, toPassageId } from "@/lib/verse-ref-utils";

import { FlipFaces } from "./flip-faces";
import type { VerseMemoryCard as VerseMemoryCardData } from "./study-card-model";

const ESV_FADE_S = 0.3;

interface StudyVerseMemoryCardProps {
  card: VerseMemoryCardData;
  flipped: boolean;
  typedAnswer: string;
  onTypedAnswerChange: (value: string) => void;
}

function renderDiffToken(token: DiffToken, idx: number): JSX.Element {
  let className = "";
  switch (token.status) {
    case "match":
      className = "text-foreground";
      break;
    case "mismatch":
      className = "text-destructive line-through decoration-destructive/50";
      break;
    case "missing":
      className = "text-destructive/70 underline decoration-dotted";
      break;
    case "extra":
      className = "text-muted-foreground italic";
      break;
  }
  return (
    <span key={idx} className={className}>
      {idx > 0 ? " " : ""}
      {token.text}
    </span>
  );
}

export function StudyVerseMemoryCard({
  card,
  flipped,
  typedAnswer,
  onTypedAnswerChange,
}: StudyVerseMemoryCardProps): JSX.Element {
  const refLabel = formatVerseRef(card.reference);
  const passageId = toPassageId(card.reference.book, card.reference.chapter);

  // Fetch eagerly (not gated on `flipped`) so the verse text is cached and
  // ready the moment the user reveals the back of the card. The result is
  // only rendered on the back face, so this is pure prefetch.
  const { data, loading, error } = useEsvReference(card.reference);

  const trimmedTyped = typedAnswer.trim();
  const showAttempt =
    trimmedTyped.length > 0 && data !== null && data !== undefined;
  const versePlainText = data ? data.verses.map((v) => v.text).join(" ") : "";
  const diffTokens = showAttempt ? diffWords(typedAnswer, versePlainText) : [];

  const front = (
    <div className="flex flex-col items-center gap-5 py-8 h-full w-full px-6 text-center">
      <h2 className="text-3xl font-semibold tracking-tight text-foreground">
        {refLabel}
      </h2>
      <p className="text-sm text-muted-foreground">
        Can you recall this verse?
      </p>
      <Textarea
        value={typedAnswer}
        onChange={(e) => onTypedAnswerChange(e.target.value)}
        placeholder="Type what you remember (optional)"
        className="w-full max-w-xl min-h-[200px] resize-none"
        aria-label="Your recalled verse"
      />
    </div>
  );

  const back = (
    <div className="flex flex-col gap-4 py-8 h-full w-full px-6 overflow-auto">
      <h2 className="text-center text-3xl font-semibold tracking-tight text-foreground">
        {refLabel}
      </h2>

      {showAttempt && (
        <div className="w-full max-w-xl mx-auto space-y-1 rounded-lg border bg-muted/30 px-3 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Your attempt
          </p>
          <p className="text-sm leading-relaxed">
            {diffTokens.map((token, idx) => renderDiffToken(token, idx))}
          </p>
        </div>
      )}

      <div className="w-full max-w-xl mx-auto space-y-2 text-left text-base leading-relaxed text-foreground">
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
              <div className="h-4 w-10/12 animate-pulse rounded bg-muted" />
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
            <motion.div
              key="data"
              className="space-y-2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: ESV_FADE_S, ease: "easeOut" }}
            >
              {data.verses.map((verse) => (
                <p key={verse.number}>
                  <span className="mr-1 text-xs font-semibold text-muted-foreground align-top">
                    {verse.number}
                  </span>
                  {verse.text}
                </p>
              ))}
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      <div className="w-full max-w-xl mx-auto pt-2 text-center">
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
