import { createRootRoute, redirect } from "@tanstack/react-router";
import { RootRouteError } from "@/components/error-fallbacks/root-route-error";
import { RootRouteComponent } from "@/components/routes/root-route-component";
import { canonicalRedirectHref } from "../../shared/http-routes";

export const Route = createRootRoute({
  beforeLoad: ({ location }) => {
    const href = canonicalRedirectHref(
      location.pathname,
      location.searchStr,
      location.hash,
    );
    if (href) {
      redirect({ href, replace: true, throw: true });
    }
  },
  component: RootRouteComponent,
  errorComponent: RootRouteError,
});
