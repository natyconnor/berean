import { createFileRoute } from "@tanstack/react-router";
import { HeartsPage } from "@/components/memory/hearts/hearts-page";

export const Route = createFileRoute("/memory/hearts")({
  component: HeartsPage,
});
