import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, Plus, Pencil, ShieldCheck, ShieldAlert, RefreshCw } from "lucide-react";
import { ManagePermissions } from "./ManagePermissions";
import { RoleForm } from "./RoleForm";
import { usePermissions } from "@/hooks/usePermission";
import {
  rolePermissionService,
  type AppRole,
  type CreateRoleInput,
} from "@/services/rolePermissionService";

export function RolesTable() {
  const queryClient = useQueryClient();
  const permissions = usePermissions();
  const [permissionRole, setPermissionRole] = useState<AppRole | null>(null);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingRole, setEditingRole] = useState<AppRole | null>(null);
  const [notice, setNotice] = useState("");
  const [noticeType, setNoticeType] = useState<"success" | "error">("success");

  const {
    data: roles = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["roles"],
    queryFn: () => rolePermissionService.getRoles(),
  });

  const saveMutation = useMutation({
    mutationFn: async (input: CreateRoleInput) => {
      if (editingRole) {
        return rolePermissionService.updateRole(editingRole.id, input);
      }

      return rolePermissionService.createRole(input);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["roles"] });
      setShowForm(false);
      setEditingRole(null);
      setNoticeType("success");
      setNotice(editingRole ? "Role updated successfully." : "Role created successfully.");
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({ roleId, isActive }: { roleId: string; isActive: boolean }) =>
      rolePermissionService.setRoleActive(roleId, isActive),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["roles"] });
      setNoticeType("success");
      setNotice("Role status updated successfully.");
    },
  });

  const visibleRoles = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return roles;

    return roles.filter((role) =>
      [role.name, role.slug, role.description ?? ""].join(" ").toLowerCase().includes(query),
    );
  }, [roles, search]);

  function openCreateForm() {
    setEditingRole(null);
    setShowForm(true);
    setNotice("");
    setNoticeType("success");
    saveMutation.reset();
  }

  function openEditForm(role: AppRole) {
    setEditingRole(role);
    setShowForm(true);
    setNotice("");
    setNoticeType("success");
    saveMutation.reset();
  }

  function cancelForm() {
    setShowForm(false);
    setEditingRole(null);
    saveMutation.reset();
  }

  async function handleSave(input: CreateRoleInput) {
    setNotice("");
    const requiredPermission = editingRole ? "roles.edit" : "roles.create";
    if (!permissions.can(requiredPermission)) {
      throw new Error(`Missing permission: ${requiredPermission}`);
    }
    await saveMutation.mutateAsync(input);
  }

  async function handleToggleStatus(role: AppRole) {
    setNotice("");
    statusMutation.reset();

    try {
      const requiredPermission = role.is_active ? "roles.deactivate" : "roles.edit";
      if (!permissions.can(requiredPermission)) {
        throw new Error(`Missing permission: ${requiredPermission}`);
      }
      await statusMutation.mutateAsync({
        roleId: role.id,
        isActive: !role.is_active,
      });
    } catch {
      // The service error is displayed below.
    }
  }

  const actionError = saveMutation.error ?? statusMutation.error;

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Role Management</h1>
          <p className="mt-1 text-sm text-slate-500">
            Create roles and control their active status.
          </p>
        </div>

        {permissions.can("roles.create") && (
          <button
            type="button"
            onClick={openCreateForm}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700"
          >
            <Plus size={17} />
            Add Role
          </button>
        )}
      </div>

      {notice && (
        <div
          role={noticeType === "error" ? "alert" : "status"}
          className={`rounded-lg border px-4 py-3 text-sm ${
            noticeType === "error"
              ? "border-red-200 bg-red-50 text-red-700"
              : "border-green-200 bg-green-50 text-green-800"
          }`}
        >
          {notice}
        </div>
      )}

      {actionError && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {actionError instanceof Error
            ? actionError.message
            : "The operation failed. Please try again."}
        </div>
      )}

      {showForm && (
        <RoleForm
          role={editingRole}
          isSaving={saveMutation.isPending}
          onSubmit={handleSave}
          onCancel={cancelForm}
        />
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-semibold text-slate-900">Roles</h2>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative w-full sm:w-72">
              <Search
                size={17}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search roles..."
                aria-label="Search roles"
                className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="p-10 text-center text-sm text-slate-500">Loading roles...</div>
        ) : error ? (
          <div className="p-6 text-sm text-red-700">
            Unable to load roles: {error.message}
            <button
              type="button"
              onClick={() => void refetch()}
              className="ml-2 font-medium underline"
            >
              Retry
            </button>
          </div>
        ) : visibleRoles.length === 0 ? (
          <div className="p-10 text-center">
            <ShieldCheck size={30} className="mx-auto mb-3 text-slate-400" />
            <p className="font-medium text-slate-800">
              {search ? "No matching roles" : "No roles found"}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              {search ? "Try a different search term." : "Create a role to get started."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-medium">Role</th>
                  <th className="px-5 py-3 font-medium">Slug</th>
                  <th className="px-5 py-3 font-medium">Type</th>
                  <th className="px-5 py-3 font-medium">Permissions</th>
                  <th className="px-5 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {visibleRoles.map((role) => (
                  <tr key={role.id} className="transition hover:bg-slate-50/70">
                    <td className="px-5 py-4">
                      <p className="font-medium text-slate-900">{role.name}</p>
                      <p className="mt-1 max-w-xs truncate text-xs text-slate-500">
                        {role.description || "No description"}
                      </p>
                    </td>

                    <td className="px-5 py-4">
                      <code className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-700">
                        {role.slug}
                      </code>
                    </td>

                    <td className="px-5 py-4">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                          role.is_system
                            ? "bg-purple-50 text-purple-700"
                            : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {role.is_system ? "System" : "Custom"}
                      </span>
                    </td>

                    <td className="px-5 py-4">
                      {permissions.can("roles.manage_permissions") && (
                        <button
                          type="button"
                          onClick={() => {
                            if (permissions.can("roles.manage_permissions"))
                              setPermissionRole(role);
                          }}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-blue-300 px-3 py-2 text-xs font-medium text-blue-700 hover:bg-blue-50"
                        >
                          <ShieldCheck size={14} />
                          Manage Permissions
                        </button>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex justify-end gap-2">
                        {permissions.can("roles.edit") && (
                          <button
                            type="button"
                            onClick={() => openEditForm(role)}
                            disabled={role.is_system}
                            title={role.is_system ? "System roles cannot be edited" : "Edit role"}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <Pencil size={14} />
                            Edit
                          </button>
                        )}

                        {permissions.can(role.is_active ? "roles.deactivate" : "roles.edit") && (
                          <button
                            type="button"
                            onClick={() => void handleToggleStatus(role)}
                            disabled={role.is_system || statusMutation.isPending}
                            title={
                              role.is_system
                                ? "System roles cannot be deactivated"
                                : role.is_active
                                  ? "Deactivate role"
                                  : "Activate role"
                            }
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            {role.is_active ? <ShieldAlert size={14} /> : <ShieldCheck size={14} />}
                            {role.is_active ? "Deactivate" : "Activate"}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {permissionRole && (
        <ManagePermissions
          role={permissionRole}
          onClose={() => setPermissionRole(null)}
          onNotify={(message, type) => {
            setNoticeType(type ?? "success");
            setNotice(message);
          }}
        />
      )}
    </div>
  );
}
