import { createFileRoute } from "@tanstack/react-router";
import { SavedPage } from "@/components/routes/saved-page";

export const Route = createFileRoute("/saved")({
  component: SavedPage,
});
