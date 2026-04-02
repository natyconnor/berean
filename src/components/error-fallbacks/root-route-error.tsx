import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { isStaleClientError } from "@/lib/app-version";

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return "An unexpected error occurred.";
}

export function RootRouteError({
  error,
  reset,
}: {
  error: unknown;
  reset?: () => void;
}) {
  const staleClientError = isStaleClientError(error);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background px-6 py-12 text-center">
      <div className="max-w-md space-y-2">
        <h1 className="text-lg font-semibold tracking-tight">
          {staleClientError ? "Refresh required" : "Something went wrong"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {staleClientError
            ? "This tab is running an older web build of Berean. Refresh the page to continue."
            : "You can try again from here, or reload the page if the problem continues."}
        </p>
        <p className="text-xs font-mono text-muted-foreground/80">
          {errorMessage(error)}
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        {reset && !staleClientError ? (
          <Button type="button" variant="default" onClick={() => reset()}>
            Try again
          </Button>
        ) : null}
        <Button
          type="button"
          variant={reset && !staleClientError ? "outline" : "default"}
          onClick={() => window.location.reload()}
        >
          Refresh now
        </Button>
        <Button type="button" variant="outline" asChild>
          <Link to="/">Home</Link>
        </Button>
      </div>
    </div>
  );
}
