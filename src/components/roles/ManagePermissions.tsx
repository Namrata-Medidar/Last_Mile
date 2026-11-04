import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, LockKeyhole, Save, X } from "lucide-react";
import { AppRole, AppPermission, rolePermissionService } from "@/services/rolePermissionService";
import { usePermissions } from "@/hooks/usePermission";

type ManagePermissionsProps = {
  role: AppRole;
  onClose: () => void;
  onNotify?: (message: string, type?: "success" | "error") => void;
};

const VISIBLE_SIDEBAR_PERMISSION_CODES = new Set([
  "sidebar.my_orders.view",
  "sidebar.upcoming_features.view",
  "sidebar.field_engineer.view",
  "sidebar.project_team.dashboard.view",
  "sidebar.project_team.ticket.view",
  "sidebar.project_team.role_management.view",
]);

const PERMISSION_DISPLAY_NAMES: Record<string, string> = {
  "sidebar.my_orders.view": "My Orders",
  "sidebar.upcoming_features.view": "Upcoming Features",
  "sidebar.field_engineer.view": "Field Engineer Support",
  "sidebar.project_team.dashboard.view": "Project Team - Dashboard",
  "sidebar.project_team.ticket.view": "Project Team - Tickets",
  "sidebar.project_team.role_management.view": "Project Team - Role Management",
  "tickets.edit": "Edit Tickets",
  "ticket.addassignee": "Add Engineers to Tickets",
  "ticket.close": "Close Tickets",
  "roles.create": "Add Role button visibility",
  "roles.manage_permissions": "Manage Permissions",
  "roles.deactivate": "Delete Role (soft delete)",
  "roles.edit": "Edit Role",
  "roles.tab_view": "Role Management tab visibility",
  "users.delete": "Delete user (soft delete)",
  "users.approve_reject": "Approve/Reject user accounts",
  "users.engineer_dispatch": "Engineers & dispatch",
  "users.role_management": "Manage Roles",
  "users.tab_view": "User Management tab visibility",
};

const VISIBLE_USER_PERMISSION_CODES = new Set([
  "users.tab_view",
  "users.delete",
  "users.role_management",
  "users.approve_reject",
  "users.engineer_dispatch",
]);

function PermissionCheckbox({
  checked,
  indeterminate = false,
  onChange,
  label,
  disabled = false,
}: {
  checked: boolean;
  indeterminate?: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.indeterminate = indeterminate;
    }
  }, [indeterminate]);

  return (
    <label className="inline-flex cursor-pointer items-center justify-center">
      <input
        ref={inputRef}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 cursor-pointer rounded border-blue-600 accent-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        aria-label={label}
      />
    </label>
  );
}

type PermissionAction = "Add" | "View" | "Edit" | "Delete" | "Other";

const PERMISSION_ACTIONS: PermissionAction[] = ["View", "Add", "Edit", "Delete"];

function getPermissionAction(permission: AppPermission): PermissionAction {
  if (permission.code === "tickets.edit") return "Edit";
  if (permission.code === "ticket.addassignee" || permission.code === "ticket.close")
    return "Other";
  if (permission.code === "roles.create") return "Add";
  if (permission.code === "roles.tab_view") return "View";
  if (permission.code === "roles.edit") return "Edit";
  if (permission.code === "roles.deactivate") return "Delete";
  if (permission.code === "roles.manage_permissions") return "Other";
  if (permission.code === "users.tab_view") return "View";
  if (permission.code === "users.delete") return "Delete";

  const action = permission.code.split(".").at(-1)?.toLowerCase() ?? "";

  if (/(^|_)(create|add|insert)(_|$)/.test(action)) return "Add";
  if (/(^|_)(view|read|list|show|access)(_|$)/.test(action)) return "View";
  if (/(^|_)(delete|remove|destroy)(_|$)/.test(action)) return "Delete";
  if (
    /(^|_)(update|edit|manage|assign|revoke|addassignee|close|deactivate|activate|cancel|approve|reject)(_|$)/.test(
      action,
    )
  ) {
    return "Edit";
  }
  return "Other";
}

export function ManagePermissions({ role, onClose, onNotify }: ManagePermissionsProps) {
  const queryClient = useQueryClient();
  const permissions = usePermissions();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [expandedModules, setExpandedModules] = useState<string[]>([]);
  const hasUserEditedPermissions = useRef(false);
  const initializedRoleId = useRef<string | null>(null);

  const permissionsQuery = useQuery({
    queryKey: ["permissions"],
    queryFn: () => rolePermissionService.getPermissions(),
    enabled: permissions.can("roles.manage_permissions"),
  });

  const rolePermissionsQuery = useQuery({
    queryKey: ["role-permissions", role.id],
    queryFn: () => rolePermissionService.getRolePermissions(role.id),
    enabled: permissions.can("roles.manage_permissions"),
  });
  useEffect(() => {
    if (initializedRoleId.current !== role.id) {
      initializedRoleId.current = role.id;
      hasUserEditedPermissions.current = false;
    }
    if (
      !permissionsQuery.isSuccess ||
      !rolePermissionsQuery.isSuccess ||
      hasUserEditedPermissions.current
    ) {
      return;
    }

    setSelectedIds(rolePermissionsQuery.data ?? []);
  }, [
    role.id,
    permissionsQuery.isSuccess,
    permissionsQuery.data,
    rolePermissionsQuery.isSuccess,
    rolePermissionsQuery.data,
  ]);

  const allPermissions = useMemo(
    () =>
      (permissionsQuery.data ?? []).filter(
        (permission) =>
          (!permission.code.startsWith("sidebar.") ||
            VISIBLE_SIDEBAR_PERMISSION_CODES.has(permission.code)) &&
          (!permission.code.startsWith("users.") ||
            VISIBLE_USER_PERMISSION_CODES.has(permission.code)) &&
          permission.code !== "tickets.delete",
      ),
    [permissionsQuery.data],
  );
  const groupedPermissions = useMemo(() => {
    const groups = new Map<string, AppPermission[]>();
    for (const permission of allPermissions) {
      const moduleName = permission.module || "Other";
      const existing = groups.get(moduleName) ?? [];
      existing.push(permission);
      groups.set(moduleName, existing);
    }
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [allPermissions]);
  const allIds = allPermissions.map((permission) => permission.id);
  const allIdSet = new Set(allIds);
  const selectedSet = new Set(selectedIds);
  const selectedPermissionCount = allPermissions.filter((permission) =>
    selectedSet.has(permission.id),
  ).length;
  const allSelected = allIds.length > 0 && allIds.every((id) => selectedSet.has(id));
  const someSelected = allIds.some((id) => selectedSet.has(id));

  const saveMutation = useMutation({
    mutationFn: () => {
      if (!permissions.can("roles.manage_permissions")) {
        throw new Error("Missing permission: roles.manage_permissions");
      }
      return rolePermissionService.saveRolePermissions(role.id, selectedIds);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["role-permissions", role.id],
      });
      await queryClient.invalidateQueries({
        queryKey: ["current-user-permissions"],
      });
      onNotify?.("Permissions saved successfully.", "success");
      onClose();
    },
    onError: (error: Error) => {
      onNotify?.(error.message || "Failed to save permissions.", "error");
    },
  });

  const togglePermissionGroup = (permissions: AppPermission[], checked: boolean) => {
    hasUserEditedPermissions.current = true;
    const ids = permissions.map((permission) => permission.id);
    setSelectedIds((current) => {
      if (checked) return [...new Set([...current, ...ids])];
      const removeIds = new Set(ids);
      return current.filter((id) => !removeIds.has(id));
    });
  };

  const togglePermission = (permissionId: string, checked: boolean) => {
    hasUserEditedPermissions.current = true;
    setSelectedIds((current) =>
      checked
        ? [...new Set([...current, permissionId])]
        : current.filter((id) => id !== permissionId),
    );
  };

  const toggleAll = (checked: boolean) => {
    hasUserEditedPermissions.current = true;
    setSelectedIds((current) =>
      checked ? [...new Set([...current, ...allIds])] : current.filter((id) => !allIdSet.has(id)),
    );
  };

  const isLoading = permissionsQuery.isLoading || rolePermissionsQuery.isLoading;
  const queryError = permissionsQuery.error || rolePermissionsQuery.error;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-6"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !saveMutation.isPending) {
          onClose();
        }
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="manage-permissions-title"
        className="flex max-h-[88vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-slate-50 shadow-2xl"
      >
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-violet-600">
              <LockKeyhole className="h-5 w-5" />
            </div>
            <div>
              <h2 id="manage-permissions-title" className="text-lg font-semibold text-slate-900">
                {role.name} - Permissions
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Configure View, Add, Edit, and Delete permissions for each module.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saveMutation.isPending}
            aria-label="Close permissions dialog"
            className="rounded-md p-2 text-slate-500 hover:bg-slate-200 hover:text-slate-900 disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-auto px-5 py-4 sm:px-6">
          <div className="mb-4 flex items-center gap-2 text-sm text-slate-600">
            <span>Permissions selected:</span>
            <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700">
              {selectedPermissionCount} of {allPermissions.length}
            </span>
            <span className="ml-1 text-xs text-slate-500">
              across{" "}
              {
                groupedPermissions.filter(([, items]) =>
                  items.some((item) => selectedSet.has(item.id)),
                ).length
              }{" "}
              of {groupedPermissions.length} modules
            </span>
          </div>

          {isLoading && (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500">
              <Loader2 className="h-5 w-5 animate-spin" />
              Loading permissions...
            </div>
          )}

          {!isLoading && queryError && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {(queryError as Error).message ||
                "Could not load permissions. Check your Supabase access policies."}
            </div>
          )}

          {!isLoading && !queryError && allPermissions.length === 0 && (
            <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center">
              <p className="font-medium text-slate-900">No permissions found</p>
              <p className="mt-1 text-sm text-slate-500">
                Add predefined permission records to the permissions table first.
              </p>
            </div>
          )}

          {!isLoading && !queryError && allPermissions.length > 0 && (
            <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
              <table className="w-full min-w-[640px] border-collapse text-left text-sm">
                <thead className="sticky top-0 z-10 bg-slate-50 text-slate-700">
                  <tr>
                    <th scope="col" className="border-b border-slate-200 px-3 py-2.5 font-semibold">
                      Module
                    </th>
                    <th
                      scope="col"
                      className="w-16 border-b border-slate-200 px-2 py-2.5 text-center font-medium"
                    >
                      <span className="sr-only">Select all module permissions</span>
                      All
                    </th>
                    {PERMISSION_ACTIONS.map((action) => (
                      <th
                        key={action}
                        scope="col"
                        className="w-20 border-b border-slate-200 px-2 py-2.5 text-center font-medium"
                      >
                        {action}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {groupedPermissions.map(([moduleName, modulePermissions]) => {
                    const selectedModulePermissions = modulePermissions.filter((permission) =>
                      selectedSet.has(permission.id),
                    );
                    const moduleAllSelected =
                      selectedModulePermissions.length === modulePermissions.length;
                    const moduleSomeSelected = selectedModulePermissions.length > 0;
                    const isExpanded = expandedModules.includes(moduleName);

                    return (
                      <Fragment key={moduleName}>
                        <tr className="hover:bg-slate-50/70">
                          <th
                            scope="row"
                            className="border-b border-slate-200 px-3 py-2.5 font-medium text-slate-900"
                          >
                            <button
                              type="button"
                              aria-expanded={isExpanded}
                              onClick={() =>
                                setExpandedModules((current) =>
                                  current.includes(moduleName)
                                    ? current.filter((name) => name !== moduleName)
                                    : [...current, moduleName],
                                )
                              }
                              className="text-left hover:text-blue-700 hover:underline"
                            >
                              {moduleName}
                            </button>
                            <span className="ml-2 text-xs font-normal text-slate-500">
                              {selectedModulePermissions.length}/{modulePermissions.length}
                            </span>
                          </th>
                          <td className="border-b border-slate-200 px-2 py-2.5 text-center">
                            <PermissionCheckbox
                              label={`All permissions for ${moduleName}`}
                              checked={moduleAllSelected}
                              indeterminate={moduleSomeSelected && !moduleAllSelected}
                              onChange={(checked) =>
                                togglePermissionGroup(modulePermissions, checked)
                              }
                            />
                          </td>
                          {PERMISSION_ACTIONS.map((action) => {
                            const actionPermissions = modulePermissions.filter(
                              (permission) => getPermissionAction(permission) === action,
                            );
                            const selectedActionPermissions = actionPermissions.filter(
                              (permission) => selectedSet.has(permission.id),
                            );
                            const actionSelected =
                              actionPermissions.length > 0 &&
                              selectedActionPermissions.length === actionPermissions.length;
                            const actionPartial =
                              selectedActionPermissions.length > 0 && !actionSelected;

                            return (
                              <td
                                key={action}
                                className="border-b border-slate-200 px-2 py-2.5 text-center"
                              >
                                {moduleName === "Users" &&
                                (action === "Add" || action === "Edit") ? (
                                  <PermissionCheckbox
                                    label={`${action} permissions are unavailable for Users`}
                                    checked={false}
                                    disabled
                                    onChange={() => undefined}
                                  />
                                ) : actionPermissions.length > 0 &&
                                  !(moduleName === "Sidebar" && action === "View") ? (
                                  <span
                                    title={actionPermissions
                                      .map(
                                        (permission) =>
                                          `${PERMISSION_DISPLAY_NAMES[permission.code] ?? permission.code} (${permission.code})`,
                                      )
                                      .join("\n")}
                                  >
                                    <PermissionCheckbox
                                      label={`${action} permissions for ${moduleName}`}
                                      checked={actionSelected}
                                      indeterminate={actionPartial}
                                      onChange={(checked) =>
                                        togglePermissionGroup(actionPermissions, checked)
                                      }
                                    />
                                  </span>
                                ) : null}
                              </td>
                            );
                          })}
                        </tr>
                        {isExpanded && (
                          <tr>
                            <td
                              colSpan={PERMISSION_ACTIONS.length + 2}
                              className="border-b border-slate-200 bg-slate-50 px-4 py-3"
                            >
                              <ul className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
                                {modulePermissions
                                  .filter((permission) =>
                                    moduleName === "Users"
                                      ? [
                                          "users.role_management",
                                          "users.approve_reject",
                                          "users.engineer_dispatch",
                                        ].includes(permission.code)
                                      : permission.code !== "tickets.edit" &&
                                        (!permission.code.startsWith("roles.") ||
                                          permission.code === "roles.manage_permissions"),
                                  )
                                  .map((permission) =>
                                    (() => {
                                      const isRoleAssignment =
                                        permission.code === "users.role_management";

                                      return (
                                        <li key={permission.id} className="flex items-start gap-2">
                                          <PermissionCheckbox
                                            label={
                                              isRoleAssignment
                                                ? "Manage Roles"
                                                : `Permission ${PERMISSION_DISPLAY_NAMES[permission.code] ?? permission.code}`
                                            }
                                            checked={selectedSet.has(permission.id)}
                                            onChange={(checked) =>
                                              togglePermission(permission.id, checked)
                                            }
                                          />
                                          <span className="min-w-0">
                                            <span className="block text-sm font-medium text-slate-900">
                                              {PERMISSION_DISPLAY_NAMES[permission.code] ??
                                                permission.code}
                                            </span>
                                            <span className="block break-all font-mono text-[11px] text-slate-500">
                                              {permission.code}
                                            </span>
                                            {permission.description &&
                                              !PERMISSION_DISPLAY_NAMES[permission.code] &&
                                              !isRoleAssignment && (
                                                <span className="block text-xs text-slate-500">
                                                  {permission.description}
                                                </span>
                                              )}
                                            {permission.code === "sidebar.field_engineer.view" && (
                                              <span className="block text-xs text-slate-500">
                                                Show the Field Engineer Support booking entry.
                                              </span>
                                            )}
                                          </span>
                                        </li>
                                      );
                                    })(),
                                  )}
                              </ul>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
                <tfoot className="bg-slate-50">
                  <tr>
                    <th
                      scope="row"
                      className="border-t border-slate-200 px-3 py-2.5 font-medium text-slate-700"
                    >
                      All modules
                    </th>
                    <td className="border-t border-slate-200 px-2 py-2.5 text-center">
                      <PermissionCheckbox
                        label="Select all permissions"
                        checked={allSelected}
                        indeterminate={someSelected && !allSelected}
                        onChange={toggleAll}
                        disabled={allIds.length === 0}
                      />
                    </td>
                    {PERMISSION_ACTIONS.map((action) => {
                      const actionPermissions = allPermissions.filter(
                        (permission) => getPermissionAction(permission) === action,
                      );
                      const selectedActionPermissions = actionPermissions.filter((permission) =>
                        selectedSet.has(permission.id),
                      );
                      const checked =
                        actionPermissions.length > 0 &&
                        selectedActionPermissions.length === actionPermissions.length;
                      return (
                        <td
                          key={action}
                          className="border-t border-slate-200 px-2 py-2.5 text-center"
                        >
                          {actionPermissions.length > 0 && (
                            <PermissionCheckbox
                              label={`Select all ${action.toLowerCase()} permissions`}
                              checked={checked}
                              indeterminate={selectedActionPermissions.length > 0 && !checked}
                              onChange={(nextChecked) =>
                                togglePermissionGroup(actionPermissions, nextChecked)
                              }
                            />
                          )}
                        </td>
                      );
                    })}
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>

        <footer className="flex flex-col-reverse gap-3 border-t border-slate-200 bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p className="text-xs text-muted-foreground">
            Changes are applied when you save. You can return to edit them later.
          </p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saveMutation.isPending}
              className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => saveMutation.mutate()}
              disabled={
                !permissions.can("roles.manage_permissions") ||
                isLoading ||
                Boolean(queryError) ||
                saveMutation.isPending ||
                allPermissions.length === 0
              }
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saveMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : saveMutation.isSuccess ? (
                <Check className="h-4 w-4" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {saveMutation.isPending ? "Saving..." : "Save Permissions"}
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}
