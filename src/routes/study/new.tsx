import { createFileRoute } from "@tanstack/react-router";
import { StudyNewPage } from "@/components/routes/study-new-page";
import { StudyFeatureGate } from "@/components/routes/study-feature-gate";

export const Route = createFileRoute("/study/new")({
  component: () => (
    <StudyFeatureGate>
      <StudyNewPage />
    </StudyFeatureGate>
  ),
});
