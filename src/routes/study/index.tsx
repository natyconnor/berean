import { createFileRoute } from "@tanstack/react-router";
import { StudyHubPage } from "@/components/routes/study-hub-page";

export const Route = createFileRoute("/study/")({
  component: StudyHubPage,
});
