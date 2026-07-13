import type { ReactNode } from "react";
import { Navigate } from "@tanstack/react-router";

import { isFeatureEnabled } from "@/lib/feature-flags";

export function StudyFeatureGate({ children }: { children: ReactNode }) {
  if (!isFeatureEnabled("study")) {
    return <Navigate to="/memory" replace />;
  }

  return children;
}
