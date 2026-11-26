import { useId, useRef, type RefObject } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Brain, ChevronRight, Heart } from "lucide-react";

import { InternalLink } from "@/components/memory/internal-link";
import { useMemorizeSheet } from "@/components/memory/memorize/memorize-context";
import { Button } from "@/components/ui/button";
import { useEsvReference } from "@/hooks/use-esv-reference";
import { useNearViewportVisible } from "@/hooks/use-near-viewport-visible";
import {
  heartSpan,
  useNotMemorizingHearts,
  type HeartItem,
} from "@/hooks/use-not-memorizing-hearts";
import { heartListLabel, NOT_MEMORIZING_MAX_LIMIT } from "@/lib/heart-list";
import type { VerseSpan } from "@/lib/hearted-verse-coverage";
import { heartMatchesSearch } from "@/lib/memorize-search";
import {
  FROM_YOUR_HEARTS_LABEL,
  MEMORIZE_LABEL,
  memorizeTitleLabel,
} from "@/lib/memory-copy";
import { cn } from "@/lib/utils";
import { toPassageId } from "@/lib/verse-ref-utils";

/** Where "See all" goes: every heart not being memorized. */
const HEARTS_PAGE_HREF = "/memory/hearts";

/** Hearts shown before "See all": one row of four, or three in a column. */
const VISIBLE_HEARTS = { grid: 4, column: 3 } as const;

function heartHref(item: HeartItem): string {
  const params = new URLSearchParams({
    startVerse: String(item.startVerse),
    endVerse: String(item.endVerse),
  });
  return `/passage/${toPassageId(item.book, item.chapter)}?${params.toString()}`;
}

function HeartMark({ className }: { className?: string }) {
  return (
    <Heart
      aria-hidden
      className={cn(
        "size-3.5 shrink-0 fill-red-500 text-red-500 dark:fill-red-400 dark:text-red-400",
        className,
      )}
    />
  );
}

/**
 * Hearted verses the user is not memorizing, newest first, each with
 * Memorize. Filtered by the search text above it; absent when there are none.
 * A few show here; "See all" opens the hearts page. First run titles it
 * "Start with a verse you love".
 */
export function FromYourHearts({
  query,
  variant,
  layout = "grid",
  scrollRootRef,
}: {
  query: string;
  variant: "today" | "firstRun";
  /** `column` lists compact rows for a narrow rail. */
  layout?: "grid" | "column";
  scrollRootRef: RefObject<HTMLElement | null>;
}) {
  const hearts = useNotMemorizingHearts();
  const headingId = useId();
  const sheet = useMemorizeSheet();
  const reduceMotion = useReducedMotion() === true;

  if (!hearts || hearts.length === 0) return null;
  const matches = hearts.filter((item) =>
    heartMatchesSearch(heartSpan(item), query),
  );
  if (matches.length === 0) return null;
  const shown = matches.slice(0, VISIBLE_HEARTS[layout]);

  const seeAll =
    hearts.length > shown.length ? (
      <Button
        asChild
        variant="ghost"
        size="xs"
        className="-mr-2 shrink-0 text-muted-foreground max-sm:h-11 max-sm:px-3"
      >
        <InternalLink href={HEARTS_PAGE_HREF}>
          {/* Today reads at most the cap; the page has the true total. */}
          {hearts.length < NOT_MEMORIZING_MAX_LIMIT
            ? `See all (${hearts.length})`
            : "See all"}
          <ChevronRight aria-hidden />
        </InternalLink>
      </Button>
    ) : null;

  const memorize = (item: HeartItem) =>
    sheet.open({ kind: "spans", spans: [heartSpan(item)] });

  const heading =
    variant === "today" ? (
      <div className="mb-2.5">
        <div className="flex items-center justify-between gap-2">
          <h3
            id={headingId}
            className="flex items-center gap-2 text-sm font-semibold"
          >
            <HeartMark />
            {FROM_YOUR_HEARTS_LABEL}
          </h3>
          {seeAll}
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Verses you&apos;ve hearted. Memorize any of them.
        </p>
      </div>
    ) : (
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2
          id={headingId}
          className="flex items-center gap-2 text-[15px] font-semibold tracking-tight"
        >
          <HeartMark />
          Start with a verse you love
        </h2>
        {seeAll ?? (
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
      {layout === "column" ? (
        <ul className="divide-y overflow-hidden rounded-lg border bg-card">
          <AnimatePresence initial={false}>
            {shown.map((item) => (
              <HeartRow
                key={item.savedVerseId}
                item={item}
                scrollRootRef={scrollRootRef}
                reduceMotion={reduceMotion}
                onMemorize={() => memorize(item)}
              />
            ))}
          </AnimatePresence>
        </ul>
      ) : (
        <HeartGrid
          items={shown}
          scrollRootRef={scrollRootRef}
          className="sm:grid-cols-2 lg:grid-cols-4"
        />
      )}
    </section>
  );
}

/** Hearts as cards with Memorize, for Today's grid and the hearts page. */
export function HeartGrid({
  items,
  scrollRootRef,
  className,
}: {
  items: readonly HeartItem[];
  scrollRootRef: RefObject<HTMLElement | null>;
  className?: string;
}) {
  const sheet = useMemorizeSheet();
  const reduceMotion = useReducedMotion() === true;
  return (
    <ul className={cn("grid gap-2.5", className)}>
      <AnimatePresence initial={false}>
        {items.map((item) => (
          <HeartCard
            key={item.savedVerseId}
            item={item}
            scrollRootRef={scrollRootRef}
            reduceMotion={reduceMotion}
            onMemorize={() =>
              sheet.open({ kind: "spans", spans: [heartSpan(item)] })
            }
          />
        ))}
      </AnimatePresence>
    </ul>
  );
}

type HeartItemProps = {
  item: HeartItem;
  scrollRootRef: RefObject<HTMLElement | null>;
  reduceMotion: boolean;
  onMemorize: () => void;
};

function heartMotion(reduceMotion: boolean) {
  return {
    layout: !reduceMotion,
    exit: reduceMotion ? undefined : { opacity: 0, scale: 0.96 },
    transition: { duration: 0.2 },
  };
}

function HeartReference({ item, label }: { item: HeartItem; label: string }) {
  return (
    <InternalLink
      href={heartHref(item)}
      className="self-start rounded-sm text-sm font-semibold underline-offset-4 outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      {label}
    </InternalLink>
  );
}

function MemorizeHeartButton({
  label,
  onMemorize,
  className,
}: {
  label: string;
  onMemorize: () => void;
  className?: string;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="xs"
      className={cn("max-sm:h-11 max-sm:px-3", className)}
      aria-label={memorizeTitleLabel(label)}
      onClick={onMemorize}
    >
      <Brain aria-hidden />
      {MEMORIZE_LABEL}
    </Button>
  );
}

/** One line of text under the reference, Memorize at the end: for a rail. */
function HeartRow({
  item,
  scrollRootRef,
  reduceMotion,
  onMemorize,
}: HeartItemProps) {
  const rowRef = useRef<HTMLLIElement | null>(null);
  const nearViewport = useNearViewportVisible(rowRef, scrollRootRef);
  const label = heartListLabel(item);

  return (
    <motion.li
      ref={rowRef}
      {...heartMotion(reduceMotion)}
      className="flex min-w-0 items-center gap-3 px-3 py-2.5"
    >
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <HeartReference item={item} label={label} />
        <HeartText span={heartSpan(item)} enabled={nearViewport} lines={1} />
      </div>
      <MemorizeHeartButton
        label={label}
        onMemorize={onMemorize}
        className="shrink-0"
      />
    </motion.li>
  );
}

function HeartCard({
  item,
  scrollRootRef,
  reduceMotion,
  onMemorize,
}: HeartItemProps) {
  const rowRef = useRef<HTMLLIElement | null>(null);
  const nearViewport = useNearViewportVisible(rowRef, scrollRootRef);
  const label = heartListLabel(item);

  return (
    <motion.li
      ref={rowRef}
      {...heartMotion(reduceMotion)}
      className="flex min-w-0 flex-col gap-2 rounded-lg border bg-card p-3"
    >
      <HeartReference item={item} label={label} />
      <HeartText span={heartSpan(item)} enabled={nearViewport} lines={2} />
      <MemorizeHeartButton
        label={label}
        onMemorize={onMemorize}
        className="mt-auto self-start max-sm:self-end"
      />
    </motion.li>
  );
}

function HeartText({
  span,
  enabled,
  lines,
}: {
  span: VerseSpan;
  enabled: boolean;
  lines: 1 | 2;
}) {
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
        {lines === 2 ? (
          <div
            className={cn(
              "h-3.5 w-2/3 rounded bg-muted",
              loading && "animate-pulse",
            )}
          />
        ) : null}
      </div>
    );
  }
  if (error) return null;
  const text = data?.verses.map((verse) => verse.text.trim()).join(" ");
  if (!text) return null;
  return (
    <p
      className={cn(
        "font-serif leading-normal text-foreground/85",
        lines === 1 ? "truncate text-[13px]" : "line-clamp-2 text-sm",
      )}
    >
      {text}
    </p>
  );
}
