import { createFileRoute } from "@tanstack/react-router";
import { LegacyTagSettingsRedirect } from "@/components/routes/legacy-tag-settings-redirect";

export const Route = createFileRoute("/settings/tags")({
  component: LegacyTagSettingsRedirect,
});
