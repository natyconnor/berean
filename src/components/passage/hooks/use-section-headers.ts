import { useCallback, useState } from "react";

const SECTION_HEADERS_STORAGE_KEY = "bible-section-headers";

function resolveInitialSectionHeaders(): boolean {
  try {
    const saved = localStorage.getItem(SECTION_HEADERS_STORAGE_KEY);
    if (saved === "true") return true;
    if (saved === "false") return false;
  } catch {
    // localStorage unavailable
  }
  return false;
}

interface UseSectionHeadersResult {
  showSectionHeaders: boolean;
  toggleSectionHeaders: () => void;
}

export function useSectionHeaders(): UseSectionHeadersResult {
  const [showSectionHeaders, setShowSectionHeaders] = useState(
    resolveInitialSectionHeaders,
  );

  const toggleSectionHeaders = useCallback(() => {
    setShowSectionHeaders((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SECTION_HEADERS_STORAGE_KEY, String(next));
      } catch {
        // localStorage unavailable
      }
      return next;
    });
  }, []);

  return { showSectionHeaders, toggleSectionHeaders };
}
