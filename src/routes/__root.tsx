import { createRootRoute } from "@tanstack/react-router";
import { RootRouteError } from "@/components/error-fallbacks/root-route-error";
import { RootRouteComponent } from "@/components/routes/root-route-component";

export const Route = createRootRoute({
  component: RootRouteComponent,
  errorComponent: RootRouteError,
});
