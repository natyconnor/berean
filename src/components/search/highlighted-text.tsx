import { Fragment, useMemo } from "react";
import { cn } from "@/lib/utils";

interface HighlightedTextProps {
  text: string;
  query: string;
  markClassName?: string;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function toTokens(query: string): string[] {
  const unique = new Set(
    query
      .trim()
      .split(/\s+/)
      .map((token) => token.trim())
      .filter((token) => token.length > 1),
  );
  return Array.from(unique).sort((a, b) => b.length - a.length);
}

export function HighlightedText({
  text,
  query,
  markClassName,
}: HighlightedTextProps) {
  const tokens = useMemo(() => toTokens(query), [query]);
  const tokenSet = useMemo(
    () => new Set(tokens.map((token) => token.toLowerCase())),
    [tokens],
  );

  const parts = useMemo(() => {
    if (tokens.length === 0) return [text];
    const pattern = tokens.map(escapeRegExp).join("|");
    const regex = new RegExp(`(${pattern})`, "gi");
    return text.split(regex);
  }, [text, tokens]);

  if (tokens.length === 0) {
    return <>{text}</>;
  }

  return (
    <>
      {parts.map((part, index) => {
        if (!part) return null;
        if (!tokenSet.has(part.toLowerCase())) {
          return <Fragment key={`plain-${index}`}>{part}</Fragment>;
        }
        return (
          <mark
            key={`match-${index}`}
            className={cn(
              "rounded-sm bg-amber-200/70 px-0.5 text-foreground dark:bg-amber-600/50",
              markClassName,
            )}
          >
            {part}
          </mark>
        );
      })}
    </>
  );
}
