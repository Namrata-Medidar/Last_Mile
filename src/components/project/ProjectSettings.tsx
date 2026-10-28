import { useEffect, useMemo, useState } from "react";
import { ShieldCheck, Users } from "lucide-react";
import { RolesTable } from "@/components/roles/RolesTable";
import { Button } from "@/components/ui/button";
import { UserRoleAssignment } from "@/components/roles/UserRoleAssignment";
import { usePermissions } from "@/hooks/usePermission";
type SettingsSection = "roles" | "permissions" | "assignments" | "payment";

type ProjectSettingsProps = {
  section?: SettingsSection;
  onNotify?: (notification: { title: string; detail: string }) => void;
};

const sections = [
  {
    id: "roles" as const,
    label: "Roles",
    description: "Create and manage project roles",
    icon: ShieldCheck,
    permission: "roles.tab_view",
  },

  {
    id: "assignments" as const,
    label: "User Assignments",
    description: "Manage roles assigned to users",
    icon: Users,
    permission: "users.tab_view",
  },
];

export function ProjectSettings({ section = "roles", onNotify }: ProjectSettingsProps) {
  const {
    permissions: permissionCodes,
    isLoading: permissionsLoading,
    error: permissionError,
    refetch: refetchPermissions,
  } = usePermissions();
  const canViewRoles =
    permissionCodes.includes("roles.tab_view") ||
    permissionCodes.includes("sidebar.project_team.role_management.view");
  const [activeSection, setActiveSection] = useState<SettingsSection>(section);
  const visibleSections = useMemo(
    () =>
      sections.filter((item) =>
        item.id === "roles"
          ? canViewRoles
          : !item.permission || permissionCodes.includes(item.permission),
      ),
    [canViewRoles, permissionCodes],
  );
  const activeSectionIsVisible = visibleSections.some((item) => item.id === activeSection);

  useEffect(() => {
    if (permissionsLoading) return;
    if (!activeSectionIsVisible && visibleSections[0]) {
      setActiveSection(visibleSections[0].id);
    }
  }, [activeSectionIsVisible, permissionsLoading, visibleSections]);

  return (
    <div className="w-full space-y-6">
      {permissionError && (
        <div
          role="alert"
          className="rounded-md border border-destructive/40 p-3 text-sm text-destructive"
        >
          Could not check role-tab permission.{" "}
          <Button type="button" variant="link" onClick={() => void refetchPermissions()}>
            Retry
          </Button>
        </div>
      )}

      {/* Settings navigation */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {visibleSections.map((item) => {
          const Icon = item.icon;
          const isActive = activeSection === item.id;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveSection(item.id)}
              className={`rounded-lg border p-4 text-left transition-colors ${
                isActive
                  ? "border-primary bg-primary/5"
                  : "border-border bg-background hover:bg-muted/50"
              }`}
            >
              <div className="flex items-center justify-between">
                <Icon
                  className={isActive ? "h-5 w-5 text-primary" : "h-5 w-5 text-muted-foreground"}
                />

                {isActive && (
                  <span className="text-[10px] font-semibold text-primary">SELECTED</span>
                )}
              </div>

              <h2 className="mt-3 text-sm font-semibold">{item.label}</h2>

              <p className="mt-1 text-xs text-muted-foreground">{item.description}</p>
            </button>
          );
        })}
      </div>

      {/* Selected section */}
      <section className="rounded-lg border border-border bg-background">
        <div className="p-6">
          {activeSectionIsVisible && activeSection === "roles" && <RolesTable />}
          {activeSectionIsVisible && activeSection === "assignments" && <UserRoleAssignment />}
        </div>
      </section>
    </div>
  );
}

function EmptySection({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action: string;
}) {
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center py-8 text-center">
      <div className="rounded-full bg-primary/10 p-3">
        <ShieldCheck className="h-6 w-6 text-primary" />
      </div>

      <h3 className="mt-4 text-base font-semibold">{title}</h3>

      <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>

      <Button
        className="mt-5"
        variant="outline"
        onClick={() => {
          // Connect this action to the relevant dialog in the next step.
        }}
      >
        {action}
      </Button>
    </div>
  );
}
