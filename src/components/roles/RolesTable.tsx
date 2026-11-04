import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, Plus, Pencil, ShieldCheck, Trash2, Users } from "lucide-react";
import { ManagePermissions } from "./ManagePermissions";
import { RoleForm } from "./RoleForm";
import { usePermissions } from "@/hooks/usePermission";
import { supabase } from "@/integrations/supabase/client";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  const [roleToDelete, setRoleToDelete] = useState<AppRole | null>(null);
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

  const {
    data: assignedPeople = [],
    isLoading: isLoadingAssignedPeople,
    error: assignedPeopleError,
  } = useQuery({
    queryKey: ["role-assignment-people"],
    queryFn: async () => {
      const [
        { data: assignments, error: assignmentsError },
        { data: profiles, error: profilesError },
      ] = await Promise.all([
        supabase.from("user_roles").select("user_id, role_id, status"),
        supabase.from("profiles").select("id, full_name, email"),
      ]);

      if (assignmentsError) throw assignmentsError;
      if (profilesError) throw profilesError;

      const usersById = new Map(
        (profiles ?? []).map((profile) => [
          profile.id,
          profile.full_name?.trim() || profile.email || "Unnamed user",
        ]),
      );
      const peopleByRole = new Map<string, Map<string, string>>();

      for (const assignment of assignments ?? []) {
        if (assignment.status !== "active" || !assignment.role_id) continue;

        const users = peopleByRole.get(assignment.role_id) ?? new Map<string, string>();
        users.set(
          assignment.user_id,
          usersById.get(assignment.user_id) ?? `Unknown user (${assignment.user_id.slice(0, 8)})`,
        );
        peopleByRole.set(assignment.role_id, users);
      }

      return [...peopleByRole.entries()].map(([roleId, names]) => ({
        roleId,
        names: [...names.values()].sort((a, b) => a.localeCompare(b)),
      }));
    },
  });
  const assignedPeopleByRole = useMemo(
    () => new Map(assignedPeople.map(({ roleId, names }) => [roleId, names])),
    [assignedPeople],
  );

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

  const deleteMutation = useMutation({
    mutationFn: (roleId: string) => rolePermissionService.softDeleteRole(roleId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["roles"] }),
        queryClient.invalidateQueries({ queryKey: ["user-role-assignments"] }),
        queryClient.invalidateQueries({ queryKey: ["role-assignment-people"] }),
        queryClient.invalidateQueries({ queryKey: ["current-user-permissions"] }),
      ]);
      setRoleToDelete(null);
      setNoticeType("success");
      setNotice("Role deleted. Its users no longer receive its permissions.");
    },
  });

  const visibleRoles = useMemo(() => {
    const query = search.trim().toLowerCase();
    const activeRoles = roles.filter((role) => role.is_active);

    if (!query) return activeRoles;

    return activeRoles.filter((role) =>
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

  function handleDeleteRole(role: AppRole) {
    setNotice("");
    deleteMutation.reset();

    if (!permissions.can("roles.deactivate")) {
      setNoticeType("error");
      setNotice("Missing permission: roles.deactivate");
      return;
    }

    setRoleToDelete(role);
  }

  const actionError = saveMutation.error ?? deleteMutation.error;

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Role Management</h1>
          <p className="mt-1 text-sm text-slate-500">
            Create roles, manage permissions, and control role access.
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

      {assignedPeopleError && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          Unable to load users assigned to roles: {assignedPeopleError.message}
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

      <TooltipProvider>
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
                    <th className="px-5 py-3 font-medium">Type</th>
                    <th className="px-5 py-3 font-medium">People</th>
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
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              disabled={isLoadingAssignedPeople || Boolean(assignedPeopleError)}
                              className="inline-flex items-center gap-1 text-xs text-slate-600 hover:text-blue-700 disabled:cursor-default"
                              aria-label={
                                isLoadingAssignedPeople
                                  ? `Loading users assigned to ${role.name}`
                                  : `${assignedPeopleByRole.get(role.id)?.length ?? 0} users assigned to ${role.name}`
                              }
                            >
                              <Users size={13} />
                              {isLoadingAssignedPeople
                                ? "Loading..."
                                : `${assignedPeopleByRole.get(role.id)?.length ?? 0}`}
                            </button>
                          </TooltipTrigger>
                          {!isLoadingAssignedPeople && !assignedPeopleError && (
                            <TooltipContent className="max-w-72" side="right">
                              <div className="max-h-60 overflow-y-auto">
                                <p className="mb-1 font-semibold">People assigned to {role.name}</p>
                                {(assignedPeopleByRole.get(role.id) ?? []).length > 0 ? (
                                  <ul className="space-y-0.5">
                                    {(assignedPeopleByRole.get(role.id) ?? []).map((name) => (
                                      <li key={name}>{name}</li>
                                    ))}
                                  </ul>
                                ) : (
                                  <p>No people assigned.</p>
                                )}
                              </div>
                            </TooltipContent>
                          )}
                        </Tooltip>
                      </td>

                      <td className="px-5 py-4">
                        {permissions.can("roles.manage_permissions") && role.is_active && (
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
                              disabled={role.is_system || !role.is_active}
                              title={
                                role.is_system
                                  ? "System roles cannot be edited"
                                  : role.is_active
                                    ? "Edit role"
                                    : "Deleted roles cannot be edited"
                              }
                              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              <Pencil size={14} />
                              Edit
                            </button>
                          )}

                          {permissions.can("roles.deactivate") &&
                            (role.is_active ? (
                              <button
                                type="button"
                                onClick={() => void handleDeleteRole(role)}
                                disabled={role.is_system || deleteMutation.isPending}
                                title={
                                  role.is_system ? "System roles cannot be deleted" : "Delete role"
                                }
                                className="inline-flex items-center gap-1.5 rounded-lg border border-red-300 px-3 py-2 text-xs font-medium text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                <Trash2 size={14} />
                                Delete
                              </button>
                            ) : (
                              <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                                Deleted
                              </span>
                            ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </TooltipProvider>
      <Dialog
        open={roleToDelete !== null}
        onOpenChange={(open) => {
          if (!open && !deleteMutation.isPending) setRoleToDelete(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete role?</DialogTitle>
            <DialogDescription>
              Delete the &quot;{roleToDelete?.name}&quot; role? Assigned users will lose its
              permissions.
            </DialogDescription>
          </DialogHeader>
          {deleteMutation.error && (
            <p role="alert" className="text-sm text-red-700">
              {deleteMutation.error.message}
            </p>
          )}
          <DialogFooter>
            <button
              type="button"
              onClick={() => setRoleToDelete(null)}
              disabled={deleteMutation.isPending}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                if (roleToDelete) deleteMutation.mutate(roleToDelete.id);
              }}
              disabled={!roleToDelete || deleteMutation.isPending}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete role"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
