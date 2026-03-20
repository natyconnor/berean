import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/settings/tags")({
  component: LegacyTagSettingsRedirect,
});

function LegacyTagSettingsRedirect() {
  return <Navigate to="/settings" replace />;
}
