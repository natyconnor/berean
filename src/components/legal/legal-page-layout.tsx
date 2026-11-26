import { useCanGoBack, useNavigate } from "@tanstack/react-router";
import { useConvexAuth } from "convex/react";
import type { ReactNode } from "react";
import { loadTabs } from "@/lib/tab-context-internal";

export function LegalPageLayout({ children }: { children: ReactNode }) {
  const canGoBack = useCanGoBack();
  const navigate = useNavigate();
  const { isAuthenticated } = useConvexAuth();

  const handleBack = () => {
    if (canGoBack) {
      window.history.back();
      return;
    }
    // No history: signed in goes into the app, signed out to the home page.
    if (isAuthenticated) {
      void navigate({
        to: "/passage/$passageId",
        params: { passageId: loadTabs()[0].passageId },
      });
      return;
    }
    void navigate({ to: "/" });
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-3xl px-4 py-10 pb-16">
        <p className="mb-8">
          <button
            type="button"
            onClick={handleBack}
            className="cursor-pointer bg-transparent p-0 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            ← Back
          </button>
        </p>
        {children}
      </div>
    </div>
  );
}
