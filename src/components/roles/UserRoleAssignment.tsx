import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, Users, ShieldCheck, UserRoundX, UserPlus, X } from "lucide-react";
import { usePermissions } from "@/hooks/usePermission";
import { supabase } from "@/integrations/supabase/client";
import { rolePermissionService, type AppRole } from "@/services/rolePermissionService";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type UserProfile = {
  id: string;
  full_name: string | null;
  is_active?: boolean;
  email: string | null;
};

type UserAssignment = {
  id: string;
  user_id: string;
  role_id: string;
  status: string;
  created_at: string;
};

type FilterRole = "All Users" | string;
type RoleDialogAction = "assign" | "revoke" | null;

export function UserRoleAssignment() {
  const queryClient = useQueryClient();
  const permissions = usePermissions();
  const canAssignRoles = permissions.can("users.assign_role");
  const canRevokeRoles = permissions.can("users.revoke_role");
  const [selectedRole, setSelectedRole] = useState<FilterRole>("All Users");
  const [search, setSearch] = useState("");
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [roleDialogUserIds, setRoleDialogUserIds] = useState<string[]>([]);
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);
  const [initialRoleIds, setInitialRoleIds] = useState<string[]>([]);
  const [roleDialogAction, setRoleDialogAction] = useState<RoleDialogAction>(null);
  const [notice, setNotice] = useState("");

  const {
    data: roles = [],
    isLoading: rolesLoading,
    error: rolesQueryError,
  } = useQuery({
    queryKey: ["roles"],
    queryFn: () => rolePermissionService.getRoles(),
    enabled: permissions.can("users.tab_view"),
  });

  const {
    data: users = [],
    isLoading: usersLoading,
    error: usersQueryError,
  } = useQuery<UserProfile[]>({
    queryKey: ["user-profiles"],
    enabled: permissions.can("users.tab_view"),
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, full_name, email");

      if (error) throw error;

      return (data ?? []) as UserProfile[];
    },
  });

  const {
    data: assignments = [],
    isLoading: assignmentsLoading,
    error: assignmentsQueryError,
  } = useQuery({
    queryKey: ["user-role-assignments"],
    enabled: permissions.can("users.tab_view"),
    queryFn: async (): Promise<UserAssignment[]> => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("id, user_id, role_id, status, created_at");

      if (error) throw error;
      return (data ?? []) as UserAssignment[];
    },
  });

  const activeRoles = roles.filter((role) => role.is_active);

  const userRoleMap = useMemo(() => {
    const map = new Map<string, AppRole[]>();

    for (const assignment of assignments) {
      if (assignment.status !== "active") continue;

      const role = activeRoles.find((item) => item.id === assignment.role_id);
      if (!role) continue;

      const existing = map.get(assignment.user_id) ?? [];
      if (!existing.some((item) => item.id === role.id)) {
        map.set(assignment.user_id, [...existing, role]);
      }
    }

    return map;
  }, [assignments, activeRoles]);

  const rolesWithCounts = activeRoles.map((role) => ({
    ...role,
    count: users.filter((user) =>
      (userRoleMap.get(user.id) ?? []).some((assignedRole) => assignedRole.id === role.id),
    ).length,
  }));

  const filteredUsers = users.filter((user) => {
    const assignedRoles = userRoleMap.get(user.id) ?? [];
    const matchesRole =
      selectedRole === "All Users"
        ? true
        : selectedRole === "Unassigned"
          ? assignedRoles.length === 0
          : assignedRoles.some((role) => role.id === selectedRole);

    const matchesSearch = `${user.full_name ?? ""} ${user.email ?? ""}`
      .toLowerCase()
      .includes(search.toLowerCase());

    return matchesRole && matchesSearch;
  });

  const assignMutation = useMutation({
    mutationFn: async ({ userIds, roleIds }: { userIds: string[]; roleIds: string[] }) => {
      if (!canAssignRoles) {
        throw new Error("Missing permission: users.assign_role");
      }
      if (userIds.length === 0 || roleIds.length === 0) {
        throw new Error("Select at least one user and one role.");
      }

      for (const [index, roleId] of roleIds.entries()) {
        try {
          await rolePermissionService.assignRoleToUsers(userIds, roleId);
        } catch (error) {
          const roleName = activeRoles.find((role) => role.id === roleId)?.name ?? "role";
          const detail = error instanceof Error ? error.message : "Unexpected error.";
          const partialMessage =
            index > 0 ? `${index} role(s) were processed before this failure. ` : "";
          throw new Error(`${partialMessage}Could not assign ${roleName}: ${detail}`);
        }
      }
    },
    onSuccess: async () => {
      setSelectedUserIds((current) =>
        current.filter((userId) => !roleDialogUserIds.includes(userId)),
      );
      setRoleDialogUserIds([]);
      setSelectedRoleIds([]);
      setInitialRoleIds([]);
      setRoleDialogAction(null);
      setNotice("Selected role(s) assigned successfully.");
      await queryClient.invalidateQueries({
        queryKey: ["user-role-assignments"],
      });
    },
    onError: (error: Error) => {
      setNotice(error.message);
      void queryClient.invalidateQueries({ queryKey: ["user-role-assignments"] });
    },
  });

  const revokeMutation = useMutation({
    mutationFn: async (roleIds: string[]) => {
      if (!canRevokeRoles) {
        throw new Error("Missing permission: users.revoke_role");
      }
      const assignmentIds = assignments
        .filter(
          (assignment) =>
            roleDialogUserIds.includes(assignment.user_id) &&
            assignment.status === "active" &&
            roleIds.includes(assignment.role_id),
        )
        .map((assignment) => assignment.id);
      if (assignmentIds.length === 0) {
        throw new Error("The selected users do not have any of the selected roles.");
      }
      await rolePermissionService.revokeUserRoles(assignmentIds);
    },
    onSuccess: async () => {
      setSelectedUserIds((current) =>
        current.filter((userId) => !roleDialogUserIds.includes(userId)),
      );
      setRoleDialogUserIds([]);
      setSelectedRoleIds([]);
      setInitialRoleIds([]);
      setRoleDialogAction(null);
      setNotice("Selected role(s) revoked successfully.");
      await queryClient.invalidateQueries({
        queryKey: ["user-role-assignments"],
      });
    },
    onError: (error: Error) => {
      setNotice(error.message);
      void queryClient.invalidateQueries({ queryKey: ["user-role-assignments"] });
    },
  });

  const isLoading = permissions.isLoading || rolesLoading || usersLoading || assignmentsLoading;
  const visibleUserIds = filteredUsers.map((user) => user.id);
  const allVisibleUsersSelected =
    visibleUserIds.length > 0 && visibleUserIds.every((id) => selectedUserIds.includes(id));

  const toggleUserSelection = (userId: string) => {
    setSelectedUserIds((current) =>
      current.includes(userId) ? current.filter((id) => id !== userId) : [...current, userId],
    );
  };

  const openRoleDialog = (
    action: Exclude<RoleDialogAction, null>,
    userIds: string[] = selectedUserIds,
  ) => {
    if (action === "assign" && !canAssignRoles) return;
    if (action === "revoke" && !canRevokeRoles) return;
    if (userIds.length === 0) return;
    setRoleDialogUserIds(userIds);
    setRoleDialogAction(action);
    const assignedRoleIds =
      action === "revoke"
        ? activeRoles
            .filter((role) =>
              assignments.some(
                (assignment) =>
                  userIds.includes(assignment.user_id) &&
                  assignment.role_id === role.id &&
                  assignment.status === "active",
              ),
            )
            .map((role) => role.id)
        : activeRoles
            .filter((role) =>
              userIds.every((userId) =>
                assignments.some(
                  (assignment) =>
                    assignment.user_id === userId &&
                    assignment.role_id === role.id &&
                    assignment.status === "active",
                ),
              ),
            )
            .map((role) => role.id);
    setInitialRoleIds(assignedRoleIds);
    setSelectedRoleIds(assignedRoleIds);
    setNotice("");
  };

  const toggleRoleSelection = (roleId: string) => {
    setSelectedRoleIds((current) =>
      current.includes(roleId) ? current.filter((id) => id !== roleId) : [...current, roleId],
    );
  };

  const closeRoleDialog = () => {
    setRoleDialogAction(null);
    setRoleDialogUserIds([]);
    setSelectedRoleIds([]);
    setInitialRoleIds([]);
  };

  const roleIdsToRevoke = initialRoleIds.filter((roleId) => !selectedRoleIds.includes(roleId));

  const rolesAvailableToRevoke = activeRoles.filter((role) =>
    assignments.some(
      (assignment) =>
        roleDialogUserIds.includes(assignment.user_id) &&
        assignment.role_id === role.id &&
        assignment.status === "active",
    ),
  );

  if (permissions.isLoading) {
    return <div className="p-8 text-center text-sm text-gray-500">Checking user permissions…</div>;
  }

  if (permissions.error) {
    return (
      <div className="p-8 text-center text-sm text-red-700">
        Could not check user assignment permissions.{" "}
        <button type="button" className="underline" onClick={() => void permissions.refetch()}>
          Retry
        </button>
      </div>
    );
  }

  if (!permissions.can("users.tab_view")) {
    return (
      <div className="p-8 text-center text-sm text-gray-500">
        You do not have permission to view user assignments.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">User Role Assignments</h2>
          <p className="mt-1 text-sm text-gray-500">View users and manage their assigned roles.</p>
        </div>
      </div>

      {notice && (
        <div className="flex items-center justify-between rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          <span>{notice}</span>
          <button type="button" aria-label="Dismiss message" onClick={() => setNotice("")}>
            <X size={16} />
          </button>
        </div>
      )}
      {(rolesQueryError || usersQueryError || assignmentsQueryError) && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          Could not load user assignments:{" "}
          {(rolesQueryError ?? usersQueryError ?? assignmentsQueryError)?.message}
        </div>
      )}

      {isLoading ? (
        <div className="rounded-xl border border-gray-200 p-8 text-center text-sm text-gray-500">
          Loading users and roles...
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <button
              type="button"
              onClick={() => setSelectedRole("All Users")}
              className={`rounded-xl border p-4 text-left transition ${
                selectedRole === "All Users"
                  ? "border-blue-500 bg-blue-50 ring-1 ring-blue-500"
                  : "border-gray-200 bg-white hover:border-blue-300"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">All Users</span>
                <Users size={19} className="text-gray-500" />
              </div>
              <p className="mt-3 text-2xl font-semibold text-gray-900">{users.length}</p>
              <p className="mt-1 text-xs text-gray-500">Total users in the directory</p>
            </button>

            {rolesWithCounts.map((role) => (
              <button
                type="button"
                key={role.id}
                onClick={() => setSelectedRole(role.id)}
                className={`rounded-xl border p-4 text-left transition ${
                  selectedRole === role.id
                    ? "border-blue-500 bg-blue-50 ring-1 ring-blue-500"
                    : "border-gray-200 bg-white hover:border-blue-300"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm text-gray-500">{role.name}</span>
                  <ShieldCheck size={19} className="shrink-0 text-blue-600" />
                </div>
                <p className="mt-3 text-2xl font-semibold text-gray-900">{role.count}</p>
                <p className="mt-1 text-xs text-gray-500">Users assigned to this role</p>
              </button>
            ))}

            <button
              type="button"
              onClick={() => setSelectedRole("Unassigned")}
              className={`rounded-xl border p-4 text-left transition ${
                selectedRole === "Unassigned"
                  ? "border-amber-500 bg-amber-50 ring-1 ring-amber-500"
                  : "border-gray-200 bg-white hover:border-amber-300"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Unassigned</span>
                <UserRoundX size={19} className="text-amber-600" />
              </div>
              <p className="mt-3 text-2xl font-semibold text-gray-900">
                {users.filter((user) => (userRoleMap.get(user.id) ?? []).length === 0).length}
              </p>
              <p className="mt-1 text-xs text-gray-500">Users without an active role</p>
            </button>
          </div>

          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
            <div className="flex flex-col gap-3 border-b border-gray-200 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="font-semibold text-gray-900">
                  {selectedRole === "All Users"
                    ? "All Users"
                    : selectedRole === "Unassigned"
                      ? "Unassigned Users"
                      : (activeRoles.find((role) => role.id === selectedRole)?.name ?? "Users")}
                </h3>
                <p className="mt-1 text-xs text-gray-500">
                  {filteredUsers.length} user
                  {filteredUsers.length === 1 ? "" : "s"} found
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                {selectedUserIds.length > 0 && (
                  <>
                    {canAssignRoles && (
                      <button
                        type="button"
                        disabled={assignMutation.isPending}
                        onClick={() => openRoleDialog("assign")}
                        className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                      >
                        <UserPlus size={15} />
                        Assign Role ({selectedUserIds.length})
                      </button>
                    )}
                    {canRevokeRoles && (
                      <button
                        type="button"
                        disabled={revokeMutation.isPending}
                        onClick={() => openRoleDialog("revoke")}
                        className="shrink-0 rounded-lg border border-red-200 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                      >
                        Revoke Role ({selectedUserIds.length})
                      </button>
                    )}
                  </>
                )}

                <div className="relative w-full sm:max-w-xs">
                  <Search
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                  />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search name or email..."
                    className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                  <tr>
                    <th className="w-10 px-3 py-3">
                      {(canAssignRoles || canRevokeRoles) && (
                        <input
                          type="checkbox"
                          aria-label="Select all filtered users"
                          checked={allVisibleUsersSelected}
                          disabled={assignMutation.isPending || revokeMutation.isPending}
                          onChange={() =>
                            setSelectedUserIds((current) =>
                              allVisibleUsersSelected
                                ? current.filter((id) => !visibleUserIds.includes(id))
                                : [...new Set([...current, ...visibleUserIds])],
                            )
                          }
                        />
                      )}
                    </th>
                    <th className="px-5 py-3 font-medium">User</th>
                    <th className="px-5 py-3 font-medium">Assigned Role(s)</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                    <th className="px-5 py-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-100">
                  {filteredUsers.map((user) => {
                    const assignedRoles = userRoleMap.get(user.id) ?? [];
                    return (
                      <tr key={user.id} className="hover:bg-gray-50">
                        <td className="px-3 py-4">
                          {(canAssignRoles || canRevokeRoles) && (
                            <input
                              type="checkbox"
                              aria-label={`Select ${user.full_name || user.email || "user"}`}
                              checked={selectedUserIds.includes(user.id)}
                              onChange={() => toggleUserSelection(user.id)}
                              disabled={assignMutation.isPending || revokeMutation.isPending}
                            />
                          )}
                        </td>
                        <td className="px-5 py-4">
                          <div className="font-medium text-gray-900">
                            {user.full_name || "Unnamed user"}
                          </div>
                          <div className="mt-1 text-xs text-gray-500">{user.email || user.id}</div>
                        </td>

                        <td className="px-5 py-4">
                          {assignedRoles.length ? (
                            <span className="text-sm text-gray-700">
                              {assignedRoles.map((role) => role.name).join(", ")}
                            </span>
                          ) : (
                            <span className="text-xs text-amber-700">No active role</span>
                          )}
                        </td>

                        <td className="px-5 py-4">
                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                              user.is_active === false
                                ? "bg-gray-100 text-gray-600"
                                : "bg-green-50 text-green-700"
                            }`}
                          >
                            {user.is_active === false ? "Inactive" : "Active"}
                          </span>
                        </td>

                        <td className="px-5 py-4">
                          <div className="flex justify-end gap-2">
                            {canAssignRoles && (
                              <button
                                type="button"
                                disabled={assignMutation.isPending || revokeMutation.isPending}
                                onClick={() => openRoleDialog("assign", [user.id])}
                                className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                              >
                                Assign
                              </button>
                            )}
                            {canRevokeRoles && assignedRoles.length > 0 && (
                              <button
                                type="button"
                                disabled={assignMutation.isPending || revokeMutation.isPending}
                                onClick={() => openRoleDialog("revoke", [user.id])}
                                className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                              >
                                Revoke
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                  {filteredUsers.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-5 py-12 text-center text-sm text-gray-500">
                        No users match this filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      <Dialog
        open={roleDialogAction !== null}
        onOpenChange={(open) => {
          if (!open) closeRoleDialog();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {roleDialogAction === "assign" ? "Assign roles" : "Revoke roles"}
            </DialogTitle>
            <DialogDescription>
              {roleDialogAction === "assign"
                ? `Select roles to assign to ${roleDialogUserIds.length} selected user(s). Already assigned roles are checked.`
                : `Uncheck roles to revoke from ${roleDialogUserIds.length} selected user(s).`}
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-72 space-y-2 overflow-y-auto py-1">
            {(roleDialogAction === "revoke" ? rolesAvailableToRevoke : activeRoles).map((role) => (
              <label
                key={role.id}
                className="flex cursor-pointer items-center gap-3 rounded-md border p-3 text-sm hover:bg-muted/50"
              >
                <Checkbox
                  checked={selectedRoleIds.includes(role.id)}
                  disabled={assignMutation.isPending || revokeMutation.isPending}
                  onCheckedChange={() => toggleRoleSelection(role.id)}
                />
                <span>{role.name}</span>
              </label>
            ))}
            {roleDialogAction === "revoke" && rolesAvailableToRevoke.length === 0 && (
              <p className="py-4 text-sm text-muted-foreground">
                The selected users have no active roles to revoke.
              </p>
            )}
          </div>

          <DialogFooter>
            <button
              type="button"
              onClick={closeRoleDialog}
              disabled={assignMutation.isPending || revokeMutation.isPending}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
            {roleDialogAction === "assign" && (
              <button
                type="button"
                disabled={!selectedRoleIds.length || assignMutation.isPending}
                onClick={() =>
                  assignMutation.mutate({ userIds: roleDialogUserIds, roleIds: selectedRoleIds })
                }
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {assignMutation.isPending ? "Assigning..." : "Assign selected"}
              </button>
            )}
            {roleDialogAction === "revoke" && (
              <button
                type="button"
                disabled={
                  !roleIdsToRevoke.length ||
                  revokeMutation.isPending ||
                  !rolesAvailableToRevoke.length
                }
                onClick={() => revokeMutation.mutate(roleIdsToRevoke)}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {revokeMutation.isPending
                  ? "Revoking..."
                  : `Revoke unchecked (${roleIdsToRevoke.length})`}
              </button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
