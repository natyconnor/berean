import { useContext } from "react";
import {
  NoteUiVariantContext,
  type NoteUiVariantContextValue,
} from "./note-ui-variant-context";

export function useNoteUiVariant(): NoteUiVariantContextValue {
  const ctx = useContext(NoteUiVariantContext);
  if (!ctx) {
    throw new Error("useNoteUiVariant must be used within NoteUiVariantProvider");
  }
  return ctx;
}
