import { createFileRoute } from "@tanstack/react-router";
import { StudyNewPage } from "@/components/routes/study-new-page";

export const Route = createFileRoute("/study/new")({
  component: StudyNewPage,
});
