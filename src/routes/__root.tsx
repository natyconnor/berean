import { createRootRoute, Navigate, Outlet, useLocation } from "@tanstack/react-router"
import { useConvexAuth } from "convex/react"
import { useQuery } from "convex-helpers/react/cache"
import { TabProvider } from "@/lib/tab-context"
import { ThemeProvider } from "@/lib/theme-provider"
import { TooltipProvider } from "@/components/ui/tooltip"
import { AppShell } from "@/components/layout/app-shell"
import { api } from "../../convex/_generated/api"

export const Route = createRootRoute({
  component: RootComponent,
})

function RootComponent() {
  const { isAuthenticated, isLoading } = useConvexAuth()
  const location = useLocation()
  const isLoginRoute = location.pathname === "/login"
  const isStarterTagsRoute = location.pathname.startsWith("/settings/tags")
  const starterTagsSetupStatus = useQuery(
    api.userSettings.getStarterTagsSetupStatus,
    isAuthenticated ? {} : "skip"
  )

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    )
  }

  if (!isAuthenticated && location.pathname !== "/login") {
    return <Navigate to="/login" replace />
  }

  if (isAuthenticated && !isLoginRoute && starterTagsSetupStatus === undefined) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    )
  }

  if (
    isAuthenticated &&
    !isLoginRoute &&
    !isStarterTagsRoute &&
    starterTagsSetupStatus?.needsStarterTagsSetup
  ) {
    return <Navigate to="/settings/tags" replace />
  }

  return (
    <ThemeProvider>
      <TabProvider>
        {isLoginRoute ? (
          <Outlet />
        ) : (
          <TooltipProvider>
            <AppShell>
              <Outlet />
            </AppShell>
          </TooltipProvider>
        )}
      </TabProvider>
    </ThemeProvider>
  )
}
