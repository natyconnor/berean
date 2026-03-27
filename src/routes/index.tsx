import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useConvexAuth } from "convex/react";
import { loadTabs } from "@/lib/tab-context-internal";

export const Route = createFileRoute("/")({
  component: IndexRedirect,
});

function IndexRedirect() {
  const { isAuthenticated, isLoading } = useConvexAuth();

  if (isLoading || !isAuthenticated) {
    return null;
  }

  const tabs = loadTabs();
  const passageId = tabs[0].passageId;

  return <Navigate to="/passage/$passageId" params={{ passageId }} replace />;
}
