import { createFileRoute } from "@tanstack/react-router";
import { ThemeTestPage } from "@/components/theme-test/theme-test-page";

export const Route = createFileRoute("/theme-test")({
  component: ThemeTestPage,
});
