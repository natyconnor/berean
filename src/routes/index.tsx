import { createFileRoute } from "@tanstack/react-router";
import { IndexRedirect } from "@/components/routes/index-redirect";

export const Route = createFileRoute("/")({
  component: IndexRedirect,
});
