import { useId, useRef, useState, type RefObject } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Brain, Heart } from "lucide-react";
import { useQuery } from "convex-helpers/react/cache";
import type { FunctionReturnType } from "convex/server";

import { api } from "../../../../convex/_generated/api";
import { InternalLink } from "@/components/memory/internal-link";
import { useMemorizeSheet } from "@/components/memory/memorize/memorize-context";
import { Button } from "@/components/ui/button";
import { useEsvReference } from "@/hooks/use-esv-reference";
import { useNearViewportVisible } from "@/hooks/use-near-viewport-visible";
import { heartListLabel, NOT_MEMORIZING_MAX_LIMIT } from "@/lib/heart-list";
import type { VerseSpan } from "@/lib/hearted-verse-coverage";
import { heartMatchesSearch } from "@/lib/memorize-search";
import { MEMORIZE_LABEL, memorizeTitleLabel } from "@/lib/memory-copy";
import { cn } from "@/lib/utils";
import { toPassageId } from "@/lib/verse-ref-utils";

type HeartItem = FunctionReturnType<
  typeof api.savedVerses.listNotMemorizing
>[number];

/** Cards shown before "Show all": one row of four, or three in a column. */
const VISIBLE_HEARTS = { grid: 4, column: 3 } as const;

function heartSpan(item: HeartItem): VerseSpan {
  return {
    book: item.book,
    chapter: item.chapter,
    startVerse: item.startVerse,
    endVerse: item.endVerse,
  };
}

function heartHref(item: HeartItem): string {
  const params = new URLSearchParams({
    startVerse: String(item.startVerse),
    endVerse: String(item.endVerse),
  });
  return `/passage/${toPassageId(item.book, item.chapter)}?${params.toString()}`;
}

/**
 * Hearted verses the user is not memorizing, newest first, each with
 * Memorize. Filtered by the search text above it; absent when there are none.
 * First run titles it "Start with a verse you love".
 */
export function FromYourHearts({
  query,
  variant,
  layout = "grid",
  scrollRootRef,
}: {
  query: string;
  variant: "today" | "firstRun";
  /** `column` stacks the cards for a narrow rail. */
  layout?: "grid" | "column";
  scrollRootRef: RefObject<HTMLElement | null>;
}) {
  const hearts = useQuery(api.savedVerses.listNotMemorizing, {
    limit: NOT_MEMORIZING_MAX_LIMIT,
  });
  const [expanded, setExpanded] = useState(false);
  const headingId = useId();
  const sheet = useMemorizeSheet();
  const reduceMotion = useReducedMotion();

  if (!hearts || hearts.length === 0) return null;
  const matches = hearts.filter((item) =>
    heartMatchesSearch(heartSpan(item), query),
  );
  if (matches.length === 0) return null;
  const visible = VISIBLE_HEARTS[layout];
  const shown = expanded ? matches : matches.slice(0, visible);

  const toggle =
    matches.length > visible ? (
      <Button
        variant="ghost"
        size="xs"
        className="shrink-0 max-sm:h-11 max-sm:px-3"
        aria-expanded={expanded}
        onClick={() => setExpanded((open) => !open)}
      >
        {expanded ? "Show fewer" : `Show all (${matches.length})`}
      </Button>
    ) : null;

  const heading =
    variant === "today" ? (
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <h3
            id={headingId}
            className="flex items-center gap-2 text-sm font-semibold"
          >
            <Heart
              aria-hidden
              className="size-3.5 fill-red-500 text-red-500 dark:fill-red-400 dark:text-red-400"
            />
            From your hearts
          </h3>
          <p className="text-xs text-muted-foreground">
            Verses you&apos;ve hearted. Memorize any of them.
          </p>
        </div>
        {toggle}
      </div>
    ) : (
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2
          id={headingId}
          className="flex items-center gap-2 text-[15px] font-semibold tracking-tight"
        >
          <Heart
            aria-hidden
            className="size-3.5 fill-red-500 text-red-500 dark:fill-red-400 dark:text-red-400"
          />
          Start with a verse you love
        </h2>
        {toggle ?? (
          <span className="hidden text-xs text-muted-foreground sm:inline">
            Verses you&apos;ve hearted in the reader
          </span>
        )}
      </div>
    );

  return (
    <section
      aria-labelledby={headingId}
      className={cn(variant === "today" && "mt-4 border-t pt-4")}
    >
      {heading}
      <ul
        className={cn(
          "grid gap-2.5",
          layout === "grid" && "sm:grid-cols-2 lg:grid-cols-4",
        )}
      >
        <AnimatePresence initial={false}>
          {shown.map((item) => (
            <HeartCard
              key={item.savedVerseId}
              item={item}
              scrollRootRef={scrollRootRef}
              reduceMotion={reduceMotion === true}
              onMemorize={() =>
                sheet.open({ kind: "spans", spans: [heartSpan(item)] })
              }
            />
          ))}
        </AnimatePresence>
      </ul>
    </section>
  );
}

function HeartCard({
  item,
  scrollRootRef,
  reduceMotion,
  onMemorize,
}: {
  item: HeartItem;
  scrollRootRef: RefObject<HTMLElement | null>;
  reduceMotion: boolean;
  onMemorize: () => void;
}) {
  const rowRef = useRef<HTMLLIElement | null>(null);
  const nearViewport = useNearViewportVisible(rowRef, scrollRootRef);
  const label = heartListLabel(item);

  return (
    <motion.li
      ref={rowRef}
      layout={!reduceMotion}
      exit={reduceMotion ? undefined : { opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.2 }}
      className="flex min-w-0 flex-col gap-2 rounded-lg border bg-card p-3"
    >
      <InternalLink
        href={heartHref(item)}
        className="self-start rounded-sm text-sm font-semibold underline-offset-4 outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        {label}
      </InternalLink>
      <HeartText span={heartSpan(item)} enabled={nearViewport} />
      <Button
        type="button"
        variant="outline"
        size="xs"
        className="mt-auto self-start max-sm:h-11 max-sm:self-end max-sm:px-3"
        aria-label={memorizeTitleLabel(label)}
        onClick={onMemorize}
      >
        <Brain aria-hidden />
        {MEMORIZE_LABEL}
      </Button>
    </motion.li>
  );
}

function HeartText({ span, enabled }: { span: VerseSpan; enabled: boolean }) {
  const { data, loading, error } = useEsvReference(span, { enabled });
  if (!enabled || loading) {
    return (
      <div aria-hidden className="space-y-1.5">
        <div
          className={cn(
            "h-3.5 w-full rounded bg-muted",
            loading && "animate-pulse",
          )}
        />
        <div
          className={cn(
            "h-3.5 w-2/3 rounded bg-muted",
            loading && "animate-pulse",
          )}
        />
      </div>
    );
  }
  if (error) return null;
  const text = data?.verses.map((verse) => verse.text.trim()).join(" ");
  if (!text) return null;
  return (
    <p className="line-clamp-2 font-serif text-sm leading-normal text-foreground/85">
      {text}
    </p>
  );
}
