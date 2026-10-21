import { useId, useState, type RefObject } from "react";
import { useNavigate } from "@tanstack/react-router";
import { GraduationCap, Play } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useEsvReference } from "@/hooks/use-esv-reference";
import {
  memorizeStartHref,
  useMemorizeStart,
} from "@/hooks/use-memorize-start";
import { estimateSessionMinutes } from "@/lib/memorize-plan";
import { resolveMemorizeTarget } from "@/lib/memorize-target";
import { TODAY_RETURN } from "@/lib/today-goal-card";
import {
  JOHN_3_16,
  firstRunSuggestions,
} from "../../../../shared/memorize-suggestions";

import { FromYourHearts } from "./from-your-hearts";
import {
  MakeYourOwnPackTile,
  MemorizeSearch,
  SuggestionChips,
} from "./start-something-new";

const FIRST_RUN_SUGGESTIONS = firstRunSuggestions();

const TRY_ONE_VERSE_MINUTES = estimateSessionMinutes({
  learningVerses: 1,
  reviewVerses: 0,
  passageSessions: 0,
});

const eyebrowClassName =
  "text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase";

/**
 * Today for someone with nothing in Memory: one invitation instead of an
 * empty dashboard. No goal grid, doorway cards, or zero stats.
 */
export function FirstRun({
  scrollRootRef,
}: {
  scrollRootRef: RefObject<HTMLElement | null>;
}) {
  const headingId = useId();
  const [query, setQuery] = useState("");

  return (
    <div className="mx-auto max-w-[920px] space-y-7">
      <section
        aria-labelledby={headingId}
        className="rounded-xl border bg-card p-5 shadow-md sm:px-7 sm:py-6"
      >
        <p className={eyebrowClassName}>Start here</p>
        <h2
          id={headingId}
          className="mt-1.5 text-[22px] leading-tight font-semibold tracking-tight sm:text-[26px]"
        >
          What do you want to memorize first?
        </h2>
        <p className="mt-1.5 flex items-center gap-2 text-sm text-muted-foreground">
          <GraduationCap
            aria-hidden
            className="size-4 shrink-0 text-amber-700 dark:text-amber-400"
          />
          Learn it in a few short days, then quick reviews keep it.
        </p>
        <StarterStrip />
        <MemorizeSearch
          label="Or find something to memorize"
          placeholder="Try Psalm 23 or Romans 8:28"
          query={query}
          onQueryChange={setQuery}
          className="mt-5"
        />
        <SuggestionChips suggestions={FIRST_RUN_SUGGESTIONS} />
        <MakeYourOwnPackTile />
      </section>
      <FromYourHearts
        variant="firstRun"
        query={query}
        scrollRootRef={scrollRootRef}
      />
    </div>
  );
}

/** Curly quotes around a verse, reusing any the ESV text already opens or closes with. */
function quoted(text: string): string {
  const open = /^[“"]/.test(text) ? "" : "“";
  const close = /[”"]$/.test(text) ? "" : "”";
  return `${open}${text}${close}`;
}

function StarterStrip() {
  const navigate = useNavigate();
  const { start, pending } = useMemorizeStart();
  const { data, loading } = useEsvReference(JOHN_3_16);
  const text = data?.verses.map((verse) => verse.text.trim()).join(" ");

  const tryOneVerse = async () => {
    try {
      const result = await start(
        resolveMemorizeTarget({ kind: "spans", spans: [JOHN_3_16] }),
      );
      void navigate({
        href: memorizeStartHref(result.destination, TODAY_RETURN),
      });
    } catch {
      toast.error("Couldn't start memorizing. Try again.");
    }
  };

  return (
    <div className="mt-[18px] flex flex-col gap-4 rounded-xl border border-primary/30 bg-primary/5 px-4 py-4 sm:flex-row sm:items-center sm:gap-5 sm:px-[18px]">
      <div className="min-w-0 flex-1">
        <p className="mb-1 text-xs font-medium text-muted-foreground">
          Not sure where to begin? Start small
        </p>
        {text ? (
          <p className="font-serif text-base leading-normal">{quoted(text)}</p>
        ) : (
          <div aria-hidden className="space-y-1.5">
            <div
              className={
                loading
                  ? "h-4 w-full animate-pulse rounded bg-muted"
                  : "h-4 w-full rounded bg-muted"
              }
            />
            <div className="h-4 w-3/4 rounded bg-muted" />
          </div>
        )}
        <p className="mt-1 text-xs font-medium text-muted-foreground">
          John 3:16
        </p>
      </div>
      <Button
        className="h-10 shrink-0 px-[18px] max-sm:h-11 max-sm:w-full"
        loading={pending}
        onClick={() => void tryOneVerse()}
      >
        <Play aria-hidden />
        Try one verse · about {TRY_ONE_VERSE_MINUTES} min
      </Button>
    </div>
  );
}
