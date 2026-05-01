import { createFileRoute } from "@tanstack/react-router";
import { StudySessionPage } from "@/components/routes/study-session-page";

export const Route = createFileRoute("/study/$sessionId")({
  component: StudySessionPage,
});
