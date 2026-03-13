import { useState, useCallback } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TooltipButton } from "@/components/ui/tooltip-button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import type { VerseRef } from "@/lib/verse-ref-utils";
import { formatVerseRef, parseVerseRef } from "@/lib/verse-ref-utils";

interface VerseLinkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sourceRef: VerseRef;
}

export function VerseLinkDialog({
  open,
  onOpenChange,
  sourceRef,
}: VerseLinkDialogProps) {
  const [targetInput, setTargetInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const findOrCreateRef = useMutation(api.verseRefs.findOrCreate);
  const createLink = useMutation(api.verseLinks.create);

  const handleCreate = useCallback(async () => {
    const target = parseVerseRef(targetInput.trim());
    if (!target) {
      setError('Enter a valid reference like "Romans 8:28" or "John 3:16-18"');
      return;
    }

    try {
      const sourceRefId = await findOrCreateRef({
        book: sourceRef.book,
        chapter: sourceRef.chapter,
        startVerse: sourceRef.startVerse,
        endVerse: sourceRef.endVerse,
      });
      const targetRefId = await findOrCreateRef({
        book: target.book,
        chapter: target.chapter,
        startVerse: target.startVerse,
        endVerse: target.endVerse,
      });
      await createLink({
        verseRefId1: sourceRefId,
        verseRefId2: targetRefId,
      });
      onOpenChange(false);
      setTargetInput("");
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create link");
    }
  }, [targetInput, sourceRef, findOrCreateRef, createLink, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Link Verse</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <span className="text-sm text-muted-foreground">From: </span>
            <Badge variant="secondary">{formatVerseRef(sourceRef)}</Badge>
          </div>
          <div className="space-y-2">
            <Input
              placeholder='Target verse (e.g. "Romans 8:28")'
              value={targetInput}
              onChange={(e) => {
                setTargetInput(e.target.value);
                setError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  void handleCreate();
                }
              }}
              autoFocus
            />
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
          <div className="flex justify-end gap-2">
            <TooltipButton
              variant="ghost"
              onClick={() => onOpenChange(false)}
              tooltip="Cancel"
            >
              Cancel
            </TooltipButton>
            <TooltipButton onClick={handleCreate} tooltip="Create verse link">
              Create Link
            </TooltipButton>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
