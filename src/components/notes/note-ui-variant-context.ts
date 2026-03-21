import { createContext } from "react";
import type { NoteUiVariantId } from "@/lib/note-ui-variant";

export type NoteUiVariantContextValue = {
  variant: NoteUiVariantId;
  setVariant: (id: NoteUiVariantId) => void;
};

export const NoteUiVariantContext =
  createContext<NoteUiVariantContextValue | null>(null);
