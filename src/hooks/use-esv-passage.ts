import { toEsvQuery } from "../../shared/esv-query";
import { useCachedEsvQuery } from "@/hooks/use-cached-esv-query";

export function useEsvPassage(book: string, chapter: number) {
  const query = toEsvQuery(book, chapter);
  return useCachedEsvQuery(query);
}
