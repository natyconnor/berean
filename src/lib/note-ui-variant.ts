export type NoteUiVariantId = "classic" | "margin" | "manuscript";

export const NOTE_UI_VARIANT_STORAGE_KEY = "berean:note-ui-variant";

export const NOTE_UI_VARIANTS: readonly {
  id: NoteUiVariantId;
  label: string;
  description?: string;
}[] = [
  { id: "classic", label: "Classic", description: "Current UI" },
  { id: "margin", label: "Margin", description: "Warmer, less form-like" },
  {
    id: "manuscript",
    label: "Manuscript",
    description: "Paper page, ink cues, more personal",
  },
];

const DEFAULT_VARIANT: NoteUiVariantId = "classic";

function isNoteUiVariantId(value: string): value is NoteUiVariantId {
  return value === "classic" || value === "margin" || value === "manuscript";
}

export function readNoteUiVariant(): NoteUiVariantId {
  if (typeof localStorage === "undefined") {
    return DEFAULT_VARIANT;
  }
  try {
    const raw = localStorage.getItem(NOTE_UI_VARIANT_STORAGE_KEY);
    if (raw && isNoteUiVariantId(raw)) {
      return raw;
    }
  } catch {
    // ignore quota / private mode
  }
  return DEFAULT_VARIANT;
}

export function writeNoteUiVariant(id: NoteUiVariantId): void {
  if (typeof localStorage === "undefined") {
    return;
  }
  try {
    localStorage.setItem(NOTE_UI_VARIANT_STORAGE_KEY, id);
  } catch {
    // ignore
  }
}
