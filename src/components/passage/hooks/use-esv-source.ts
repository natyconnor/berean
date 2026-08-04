import { useCallback, useState } from "react";
import {
  type EsvSource,
  resolveEsvSource,
  setEsvSource,
} from "@/lib/esv-source";

interface UseEsvSourceResult {
  esvSource: EsvSource;
  /** Persist preference and sync React state. Caller should retry the passage load. */
  setSource: (source: EsvSource) => void;
  toggleEsvHtml: () => EsvSource;
}

export function useEsvSource(): UseEsvSourceResult {
  const [esvSource, setEsvSourceState] = useState(resolveEsvSource);

  const setSource = useCallback((source: EsvSource) => {
    setEsvSource(source);
    setEsvSourceState(source);
  }, []);

  const toggleEsvHtml = useCallback((): EsvSource => {
    const next: EsvSource = esvSource === "html" ? "text" : "html";
    setEsvSource(next);
    setEsvSourceState(next);
    return next;
  }, [esvSource]);

  return { esvSource, setSource, toggleEsvHtml };
}
