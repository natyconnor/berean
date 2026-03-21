import { useCallback, useMemo, useState, type ReactNode } from "react";
import {
  type NoteUiVariantId,
  readNoteUiVariant,
  writeNoteUiVariant,
} from "@/lib/note-ui-variant";
import { NoteUiVariantContext } from "./note-ui-variant-context";

function initialNoteUiVariant(): NoteUiVariantId {
  if (typeof window === "undefined") {
    return "classic";
  }
  return readNoteUiVariant();
}

export function NoteUiVariantProvider({ children }: { children: ReactNode }) {
  const [variant, setVariantState] = useState<NoteUiVariantId>(
    initialNoteUiVariant,
  );

  const setVariant = useCallback((id: NoteUiVariantId) => {
    writeNoteUiVariant(id);
    setVariantState(id);
  }, []);

  const value = useMemo(
    () => ({ variant, setVariant }),
    [variant, setVariant],
  );

  return (
    <NoteUiVariantContext.Provider value={value}>
      {children}
    </NoteUiVariantContext.Provider>
  );
}
