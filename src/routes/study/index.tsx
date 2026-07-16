import { createFileRoute } from "@tanstack/react-router";
import { StudyHubPage } from "@/components/routes/study-hub-page";
import { StudyFeatureGate } from "@/components/routes/study-feature-gate";

export const Route = createFileRoute("/study/")({
  component: () => (
    <StudyFeatureGate>
      <StudyHubPage />
    </StudyFeatureGate>
  ),
});
