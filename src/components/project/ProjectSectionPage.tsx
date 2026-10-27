import { Link, notFound, useRouterState } from "@tanstack/react-router";
import { App, type AppPage } from "@/components/App";
import { useAuth } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/usePermission";

const sectionPages: Record<string, { page: AppPage; permission?: string }> = {
  "/project": { page: "project-dashboard", permission: "tickets.view" },
  "/project/dashboard": { page: "project-dashboard", permission: "tickets.view" },
  "/project/ticket": { page: "project-tickets", permission: "tickets.view" },
  "/admin/role": { page: "project-roles" },
  "/admin/payment": { page: "project-payment" },
};

export function ProjectSectionPage() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const auth = useAuth();
  const permissions = usePermissions();
  const section = sectionPages[pathname.replace(/\/+$/, "") || "/"];

  if (!section) {
    throw notFound();
  }

  if (!auth.ready || !auth.rolesReady || (section.permission && permissions.isLoading)) {
    return (
      <div className="grid min-h-screen place-items-center text-sm text-muted-foreground">
        Checking project access…
      </div>
    );
  }

  if (section.permission && permissions.error) {
    return (
      <div className="grid min-h-screen place-items-center p-6 text-center">
        <div>
          <h1 className="text-xl font-semibold">Could not check your permissions</h1>
          <p role="alert" className="mt-2 text-sm text-destructive">
            {permissions.error instanceof Error
              ? permissions.error.message
              : "Permission lookup failed."}
          </p>
          <button
            type="button"
            onClick={() => void permissions.refetch()}
            className="mt-4 text-sm text-primary underline"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!auth.isStaff || (section.permission && !permissions.can(section.permission))) {
    return (
      <div className="grid min-h-screen place-items-center p-6 text-center">
        <div>
          <h1 className="text-xl font-semibold">You don’t have access to this section</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Staff access and the required permission are needed.
          </p>
          <Link to="/" className="mt-4 inline-block text-sm text-primary underline">
            Back to marketplace
          </Link>
        </div>
      </div>
    );
  }

  return <App page={section.page} />;
}
