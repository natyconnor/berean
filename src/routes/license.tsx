import { createFileRoute } from "@tanstack/react-router";
import { LicensePage } from "@/components/routes/license-page";

export const Route = createFileRoute("/license")({
  component: LicensePage,
});
