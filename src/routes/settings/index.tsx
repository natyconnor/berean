import { createFileRoute } from "@tanstack/react-router";

import { SettingsPage } from "./tags";

export const Route = createFileRoute("/settings/")({
  component: SettingsPage,
});
