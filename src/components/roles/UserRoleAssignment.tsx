import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { HardHat, Search, Users, ShieldCheck, UserRoundX, UserPlus, Trash2, X } from "lucide-react";
import { usePermissions } from "@/hooks/usePermission";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { rolePermissionService, type AppRole } from "@/services/rolePermissionService";
import { BulkUserUpload } from "@/components/roles/BulkUserUpload";
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
  email: string | null;
  status: string;
};

type UserAssignment = {
  id: string;
  user_id: string;
  role_id: string | null;
  role: string | null;
  status: string;
  created_at: string;
};

type FilterRole = "All Users" | string;

function assignmentMatchesRole(assignment: UserAssignment, role: AppRole): boolean {
  return assignment.role_id === role.id;
}

export function UserRoleAssignment() {
  const queryClient = useQueryClient();
  const permissions = usePermissions();
  const auth = useAuth();
  const canManageUserRoles = permissions.can("users.role_management");
  const canAssignRoles = canManageUserRoles;
  const canRevokeRoles = canManageUserRoles;
  const canDeleteUsers = permissions.can("users.delete");
  const canApproveUsers = permissions.can("users.approve_reject");
  const canViewEngineerDispatch = permissions.can("users.engineer_dispatch");
  const [selectedRole, setSelectedRole] = useState<FilterRole>("All Users");
  const [search, setSearch] = useState("");
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [roleDialogUserIds, setRoleDialogUserIds] = useState<string[]>([]);
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<UserProfile | null>(null);
  const [notice, setNotice] = useState("");

  const {
    data: roles = [],
    isLoading: rolesLoading,
    error: rolesQueryError,
    refetch: refetchRoles,
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
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email, status");

      if (error) throw error;

      return (data ?? []).filter((profile) => profile.status !== "deleted") as UserProfile[];
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      if (!canDeleteUsers) {
        throw new Error("Missing permission: users.delete");
      }
      const { error } = await supabase.rpc("soft_delete_user", { _user_id: userId });
      if (error) throw error;
    },
    onSuccess: async (_result, deletedUserId) => {
      setUserToDelete(null);
      setSelectedUserIds((current) => current.filter((userId) => userId !== deletedUserId));
      setNotice("User account soft-deleted successfully.");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["user-profiles"] }),
        queryClient.invalidateQueries({ queryKey: ["user-role-assignments"] }),
        queryClient.invalidateQueries({ queryKey: ["role-assignment-people"] }),
        queryClient.invalidateQueries({ queryKey: ["engineers"] }),
      ]);
    },
    onError: (error: Error) => setNotice(error.message),
  });

  const approvalMutation = useMutation({
    mutationFn: async ({ userId, status }: { userId: string; status: "active" | "rejected" }) => {
      if (!canApproveUsers) {
        throw new Error("Missing permission: users.approve_reject");
      }
      const { error } = await supabase.rpc("set_user_account_approval", {
        _user_id: userId,
        _status: status,
      });
      if (error) throw error;
    },
    onSuccess: async (_result, variables) => {
      setNotice(variables.status === "active" ? "User approved." : "User rejected.");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["user-profiles"] }),
        queryClient.invalidateQueries({ queryKey: ["user-role-assignments"] }),
        queryClient.invalidateQueries({ queryKey: ["users-table"] }),
      ]);
    },
    onError: (error: Error) => setNotice(error.message),
  });

  const {
    data: assignments = [],
    isLoading: assignmentsLoading,
    error: assignmentsQueryError,
    refetch: refetchAssignments,
  } = useQuery({
    queryKey: ["user-role-assignments"],
    enabled: permissions.can("users.tab_view"),
    queryFn: async (): Promise<UserAssignment[]> => {
      console.log("%c📡 [useQuery] Fetching user_roles from database...", "color: #0066ff; font-weight: bold");
      const { data, error } = await supabase
        .from("user_roles")
        .select("id, user_id, role_id, status, created_at");

      if (error) {
        console.error("%c❌ [useQuery] Error fetching user_roles:", "color: #ff0000; font-weight: bold", error);
        throw error;
      }
      
      console.log("%c✅ [useQuery] Fetched user_roles data:", "color: #00cc00; font-weight: bold");
      console.table(data);
      return (data ?? []) as UserAssignment[];
    },
  });

  const activeRoles = roles.filter((role) => role.is_active);

  const userRoleMap = useMemo(() => {
    console.log("%c📊 [userRoleMap] Building role map...", "color: #9900ff; font-weight: bold");
    console.log("%c📊 [userRoleMap] Active roles count:", "color: #9900ff", activeRoles.length);
    console.table(activeRoles);
    console.log("%c📊 [userRoleMap] Assignments count:", "color: #9900ff", assignments.length);
    console.table(assignments);
    
    const map = new Map<string, AppRole[]>();

    for (const assignment of assignments) {
      if (assignment.status !== "active") continue;

      const role = activeRoles.find((item) => assignmentMatchesRole(assignment, item));
      
      if (!role) {
        console.warn("%c⚠️ [userRoleMap] NO MATCHING ROLE FOUND for assignment:", "color: #ff9900; font-weight: bold");
        console.log("Assignment:", assignment);
        console.log("Looking for role_id:", assignment.role_id);
        console.log("Available role IDs:", activeRoles.map(r => r.id));
        continue;
      }

      const existing = map.get(assignment.user_id) ?? [];
      if (!existing.some((item) => item.id === role.id)) {
        map.set(assignment.user_id, [...existing, role]);
      }
    }

    console.log("%c✅ [userRoleMap] Final role map built:", "color: #00cc00; font-weight: bold");
    console.log(map);
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

  const saveRolesMutation = useMutation({
    mutationFn: async ({ userIds, roleIds }: { userIds: string[]; roleIds: string[] }) => {
      console.log("%c🟢 [saveRolesMutation] STARTING MUTATION", "color: #00cc00; font-weight: bold; font-size: 14px");
      console.table({
        "Users to update": userIds.length,
        "User IDs": userIds.join(", "),
        "Roles selected": roleIds.length,
        "Role IDs": roleIds.join(", "),
      });

      if (userIds.length === 0) {
        console.error("%c❌ [saveRolesMutation] ERROR: No users selected", "color: #ff0000; font-weight: bold");
        throw new Error("Select at least one user.");
      }

      const currentAssignments = assignments.filter(
        (assignment) => userIds.includes(assignment.user_id) && assignment.status === "active",
      );
      console.log("%c🟢 [saveRolesMutation] Current role assignments", "color: #00cc00");
      console.table(
        currentAssignments.length > 0
          ? currentAssignments.map((a) => ({
              "User ID": a.user_id,
              "Role ID": a.role_id,
              Status: a.status,
            }))
          : [{ "Current Assignments": "None" }],
      );

      const addedRoleIds = roleIds.filter(
        (roleId) =>
          !userIds.every((userId) =>
            currentAssignments.some(
              (assignment) => assignment.user_id === userId && assignment.role_id === roleId,
            ),
          ),
      );
      console.log("%c🟢 [saveRolesMutation] Roles to ADD", "color: #00cc00; font-weight: bold");
      console.table(
        addedRoleIds.length > 0
          ? addedRoleIds.map((r) => ({ "Role ID": r }))
          : [{ "Roles to add": "None" }],
      );

      const removedAssignments = currentAssignments.filter(
        (assignment) => assignment.role_id && !roleIds.includes(assignment.role_id),
      );
      console.log("%c🟢 [saveRolesMutation] Roles to REMOVE", "color: #ff9900; font-weight: bold");
      console.table(
        removedAssignments.length > 0
          ? removedAssignments.map((a) => ({
              "Assignment ID": a.id,
              "User ID": a.user_id,
              "Role ID": a.role_id,
            }))
          : [{ "Roles to remove": "None" }],
      );

      if (addedRoleIds.length > 0 && !canAssignRoles) {
        console.error("%c❌ [saveRolesMutation] ERROR: Missing permission to ADD roles", "color: #ff0000; font-weight: bold");
        throw new Error("Missing permission: users.role_management");
      }
      if (removedAssignments.length > 0 && !canRevokeRoles) {
        console.error("%c❌ [saveRolesMutation] ERROR: Missing permission to REMOVE roles", "color: #ff0000; font-weight: bold");
        throw new Error("Missing permission: users.role_management");
      }

      console.log("%c🟢 [saveRolesMutation] Permissions OK - Proceeding with assignment", "color: #00cc00");

      for (const roleId of addedRoleIds) {
        const usersToAssign = userIds.filter(
          (userId) =>
            !currentAssignments.some(
              (assignment) => assignment.user_id === userId && assignment.role_id === roleId,
            ),
        );
        if (usersToAssign.length > 0) {
          console.log(`%c🟢 [saveRolesMutation] ASSIGNING role to ${usersToAssign.length} user(s)`, "color: #00cc00; font-weight: bold");
          console.table({
            "Role ID": roleId,
            "Users to assign": usersToAssign.length,
            "User IDs": usersToAssign.join(", "),
          });
          await rolePermissionService.assignRoleToUsers(usersToAssign, roleId);
        }
      }

      if (removedAssignments.length > 0) {
        console.log(`%c🟢 [saveRolesMutation] REMOVING ${removedAssignments.length} role assignment(s)`, "color: #ff9900; font-weight: bold");
        await rolePermissionService.revokeUserRoles(
          removedAssignments.map((assignment) => assignment.id),
        );
      }

      console.log("%c✅ [saveRolesMutation] ALL ROLE UPDATES COMPLETED SUCCESSFULLY!", "color: #00aa00; font-weight: bold; font-size: 14px");
    },
    onSuccess: async () => {
      console.log("%c✅ [saveRolesMutation] SUCCESS: Role changes saved", "color: #00aa00; font-weight: bold; font-size: 14px");
      
      // Clear cache and force refetch
      console.log("%c🔄 [saveRolesMutation] Starting cache invalidation and refetch...", "color: #ff6600; font-weight: bold; font-size: 12px");
      
      await queryClient.invalidateQueries({ queryKey: ["user-role-names"] });
      await queryClient.invalidateQueries({
        queryKey: ["user-role-assignments"],
      });
      await queryClient.invalidateQueries({ queryKey: ["role-assignment-people"] });
      await queryClient.invalidateQueries({ queryKey: ["engineers"] });
      await queryClient.invalidateQueries({ queryKey: ["user-profiles"] });
      
      // Force immediate refetch with await
      console.log("%c🔄 [saveRolesMutation] Calling refetchAssignments()...", "color: #ff6600; font-weight: bold");
      const assignmentsResult = await refetchAssignments();
      console.log("%c✅ [saveRolesMutation] refetchAssignments() result:", "color: #00cc00; font-weight: bold");
      console.log("Fetched assignments:", assignmentsResult.data);
      
      // IMPORTANT: Log which user/role combinations came back
      if (assignmentsResult.data) {
        const roleDialogUserAssignments = assignmentsResult.data.filter(a => 
          roleDialogUserIds.includes(a.user_id) && a.status === 'active'
        );
        console.log("%c🔍 [saveRolesMutation] Assignments for the user we just updated:", "color: #ff00ff; font-weight: bold; font-size: 14px");
        console.table(roleDialogUserAssignments.length > 0 
          ? roleDialogUserAssignments.map(a => ({
              "User ID": a.user_id,
              "Role ID": a.role_id,
              "Status": a.status,
              "Created At": a.created_at
            }))
          : [{ "Note": "No active assignments found for this user!" }]
        );
      }
      
      console.log("%c🔄 [saveRolesMutation] Calling refetchRoles()...", "color: #ff6600; font-weight: bold");
      const rolesResult = await refetchRoles();
      console.log("%c✅ [saveRolesMutation] refetchRoles() result:", "color: #00cc00; font-weight: bold");
      console.log(rolesResult.data);
      
      // Small delay to ensure React has processed the state updates
      await new Promise(resolve => setTimeout(resolve, 100));
      
      console.log("%c🔄 [saveRolesMutation] Clearing dialog state...", "color: #ff6600; font-weight: bold");
      setSelectedUserIds((current) =>
        current.filter((userId) => !roleDialogUserIds.includes(userId)),
      );
      setRoleDialogUserIds([]);
      setSelectedRoleIds([]);
      setRoleDialogOpen(false);
      setNotice("User roles updated successfully.");
    },
    onError: (error: Error) => {
      console.error("%c❌ [saveRolesMutation] FAILED: Error during role update", "color: #ff0000; font-weight: bold; font-size: 14px");
      console.error("Error message:", error.message);
      console.error("Stack trace:", error.stack);
      setNotice(error.message);
      void queryClient.invalidateQueries({ queryKey: ["user-role-assignments"] });
    },
  });

  const isLoading = permissions.isLoading || rolesLoading || usersLoading || assignmentsLoading;
  const visibleAssignableUserIds = filteredUsers
    .filter((user) => user.status === "active")
    .map((user) => user.id);
  const allVisibleUsersSelected =
    visibleAssignableUserIds.length > 0 &&
    visibleAssignableUserIds.every((id) => selectedUserIds.includes(id));

  const toggleUserSelection = (userId: string) => {
    setSelectedUserIds((current) =>
      current.includes(userId) ? current.filter((id) => id !== userId) : [...current, userId],
    );
  };

  const openRoleDialog = (userIds: string[] = selectedUserIds) => {
    if (!canAssignRoles && !canRevokeRoles) return;
    if (userIds.length === 0) return;
    setRoleDialogUserIds(userIds);
    setRoleDialogOpen(true);
    const assignedRoleIds = activeRoles
      .filter((role) =>
        userIds.every((userId) =>
          assignments.some(
            (assignment) =>
              assignment.user_id === userId &&
              assignmentMatchesRole(assignment, role) &&
              assignment.status === "active",
          ),
        ),
      )
      .map((role) => role.id);
    setSelectedRoleIds(assignedRoleIds);
    setNotice("");
  };

  const toggleRoleSelection = (roleId: string) => {
    setSelectedRoleIds((current) =>
      current.includes(roleId) ? current.filter((id) => id !== roleId) : [...current, roleId],
    );
  };

  const closeRoleDialog = () => {
    setRoleDialogOpen(false);
    setRoleDialogUserIds([]);
    setSelectedRoleIds([]);
  };

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
        </div>
        {canAssignRoles && (
          <BulkUserUpload
            roles={activeRoles}
            onComplete={async () => {
              await Promise.all([
                queryClient.invalidateQueries({ queryKey: ["user-profiles"] }),
                queryClient.invalidateQueries({ queryKey: ["user-role-assignments"] }),
                queryClient.invalidateQueries({ queryKey: ["role-assignment-people"] }),
                queryClient.invalidateQueries({ queryKey: ["engineers"] }),
              ]);
            }}
          />
        )}
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
                {selectedUserIds.length > 0 && (canAssignRoles || canRevokeRoles) && (
                  <button
                    type="button"
                    disabled={saveRolesMutation.isPending}
                    onClick={() => openRoleDialog()}
                    className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    <UserPlus size={15} />
                    Manage Roles ({selectedUserIds.length})
                  </button>
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
                          disabled={saveRolesMutation.isPending || approvalMutation.isPending}
                          onChange={() =>
                            setSelectedUserIds((current) =>
                              allVisibleUsersSelected
                                ? current.filter((id) => !visibleAssignableUserIds.includes(id))
                                : [...new Set([...current, ...visibleAssignableUserIds])],
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
                    if (assignedRoles.length > 0) {
                      console.log(`%c📍 User: ${user.email}`, "color: #0066ff; font-weight: bold");
                      console.log(`Assigned roles:`, assignedRoles);
                    }
                    return (
                      <tr key={user.id} className="hover:bg-gray-50">
                        <td className="px-3 py-4">
                          {(canAssignRoles || canRevokeRoles) && (
                            <input
                              type="checkbox"
                              aria-label={`Select ${user.full_name || user.email || "user"}`}
                              checked={selectedUserIds.includes(user.id)}
                              onChange={() => toggleUserSelection(user.id)}
                              disabled={
                                user.status !== "active" ||
                                saveRolesMutation.isPending ||
                                approvalMutation.isPending
                              }
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
                              user.status === "active"
                                ? "bg-green-50 text-green-700"
                                : user.status === "pending"
                                  ? "bg-amber-50 text-amber-700"
                                  : "bg-gray-100 text-gray-600"
                            }`}
                          >
                            {user.status}
                          </span>
                        </td>

                        <td className="px-5 py-4">
                          <div className="flex justify-end gap-2">
                            {canViewEngineerDispatch &&
                              assignedRoles.some((role) => role.slug === "engineer") && (
                                <Link
                                  to="/admin"
                                  search={{ tab: "engineers" }}
                                  aria-label={`Open Engineers & dispatch for ${user.full_name || user.email || "engineer"}`}
                                  title="Open Engineers & dispatch"
                                  className="inline-flex items-center gap-1 rounded-lg border border-blue-200 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-50"
                                >
                                  <HardHat size={14} />
                                  Engineers &amp; dispatch
                                </Link>
                              )}
                            {canDeleteUsers && user.id !== auth.userId && (
                              <button
                                type="button"
                                aria-label={`Delete ${user.full_name || user.email || "user"}`}
                                title="Soft-delete user account"
                                disabled={deleteUserMutation.isPending}
                                onClick={() => {
                                  setNotice("");
                                  deleteUserMutation.reset();
                                  setUserToDelete(user);
                                }}
                                className="inline-flex items-center justify-center rounded-lg border border-red-200 p-1.5 text-red-600 hover:bg-red-50 disabled:opacity-50"
                              >
                                <Trash2 size={15} />
                              </button>
                            )}
                            {canApproveUsers &&
                              (user.status === "pending" || user.status === "rejected") && (
                                <>
                                  <button
                                    type="button"
                                    disabled={approvalMutation.isPending}
                                    onClick={() =>
                                      approvalMutation.mutate({
                                        userId: user.id,
                                        status: "active",
                                      })
                                    }
                                    className="rounded-lg border border-green-300 px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-50 disabled:opacity-50"
                                  >
                                    Approve
                                  </button>
                                  {user.status === "pending" && (
                                    <button
                                      type="button"
                                      disabled={approvalMutation.isPending}
                                      onClick={() =>
                                        approvalMutation.mutate({
                                          userId: user.id,
                                          status: "rejected",
                                        })
                                      }
                                      className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                                    >
                                      Reject
                                    </button>
                                  )}
                                </>
                              )}
                            {(canAssignRoles || canRevokeRoles) && user.status === "active" && (
                              <button
                                type="button"
                                disabled={saveRolesMutation.isPending}
                                onClick={() => openRoleDialog([user.id])}
                                className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                              >
                                Manage Roles
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
        open={roleDialogOpen}
        onOpenChange={(open) => {
          if (!open) closeRoleDialog();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Manage user roles</DialogTitle>
            <DialogDescription>
              Check roles to assign or leave unchecked to remove them from{" "}
              {roleDialogUserIds.length} selected user(s).
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-72 space-y-2 overflow-y-auto py-1">
            {activeRoles.map((role) => {
              const isSelected = selectedRoleIds.includes(role.id);

              return (
                <label
                  key={role.id}
                  className="flex cursor-pointer items-center gap-3 rounded-md border p-3 text-sm hover:bg-muted/50"
                >
                  <Checkbox
                    checked={isSelected}
                    disabled={
                      saveRolesMutation.isPending ||
                      (isSelected ? !canRevokeRoles : !canAssignRoles)
                    }
                    onCheckedChange={() => toggleRoleSelection(role.id)}
                  />
                  <span>{role.name}</span>
                </label>
              );
            })}
          </div>

          <DialogFooter>
            <button
              type="button"
              onClick={closeRoleDialog}
              disabled={saveRolesMutation.isPending}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={saveRolesMutation.isPending}
              onClick={() => {
                console.log("%c🔴 ════════════════════════════════════════", "color: #ff0000; font-weight: bold; font-size: 12px");
                console.log("%c🔴 [SAVE BUTTON CLICKED] - Initiating role assignment", "color: #ff0000; font-weight: bold; font-size: 14px");
                console.log("%c🔴 ════════════════════════════════════════", "color: #ff0000; font-weight: bold; font-size: 12px");
                console.table({
                  "Button State": saveRolesMutation.isPending ? "LOADING" : "READY",
                  "Users selected": roleDialogUserIds.length,
                  "User IDs": roleDialogUserIds.join(", "),
                  "Roles selected": selectedRoleIds.length,
                  "Role IDs": selectedRoleIds.join(", "),
                });
                console.log("%c🔴 Sending mutation request...", "color: #ff0000; font-weight: bold");
                saveRolesMutation.mutate({
                  userIds: roleDialogUserIds,
                  roleIds: selectedRoleIds,
                });
              }}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saveRolesMutation.isPending ? "Saving..." : "Save roles"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={userToDelete !== null}
        onOpenChange={(open) => {
          if (!open && !deleteUserMutation.isPending) setUserToDelete(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete user account?</DialogTitle>
            <DialogDescription>
              Soft-delete the account for{" "}
              <span className="font-medium text-foreground">
                {userToDelete?.full_name || userToDelete?.email || "this user"}
              </span>
              ? The account will lose access and its role assignments will be deactivated.
            </DialogDescription>
          </DialogHeader>
          {deleteUserMutation.error && (
            <p role="alert" className="text-sm text-red-700">
              {deleteUserMutation.error.message}
            </p>
          )}
          <DialogFooter>
            <button
              type="button"
              onClick={() => setUserToDelete(null)}
              disabled={deleteUserMutation.isPending}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!userToDelete || deleteUserMutation.isPending}
              onClick={() => {
                if (userToDelete) deleteUserMutation.mutate(userToDelete.id);
              }}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {deleteUserMutation.isPending ? "Deleting..." : "Delete user"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
