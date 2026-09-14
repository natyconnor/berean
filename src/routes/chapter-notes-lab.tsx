import { createFileRoute } from "@tanstack/react-router";
import { ChapterNotesLabPage } from "@/components/chapter-notes-lab/chapter-notes-lab-page";

export const Route = createFileRoute("/chapter-notes-lab")({
  component: ChapterNotesLabPage,
});
