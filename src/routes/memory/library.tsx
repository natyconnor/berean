import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/memory/library")({
  beforeLoad: () => {
    redirect({ to: "/memory/verses", replace: true, throw: true });
  },
});
