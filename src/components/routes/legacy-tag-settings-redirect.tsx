import { Navigate } from "@tanstack/react-router";

export function LegacyTagSettingsRedirect() {
  return <Navigate to="/settings" replace />;
}
