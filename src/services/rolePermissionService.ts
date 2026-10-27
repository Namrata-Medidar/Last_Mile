import { supabase } from "@/integrations/supabase/client";

export type AppRole = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  is_system: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type AppPermission = {
  id: string;
  code: string;
  module: string;
  description: string | null;
  created_at: string;
};

export type RolePermission = {
  id: string;
  role_id: string;
  permission_id: string;
  created_at: string;
};

export type UserRoleAssignment = {
  id: string;
  user_id: string;
  role_id: string;
  status: string;
  created_at: string;
  updated_at: string;
};

export type CreateRoleInput = {
  name: string;
  slug: string;
  description?: string | null;
};

export type CreatePermissionInput = {
  code: string;
  module: string;
  description?: string | null;
};

const normalizeError = (error: unknown): Error => {
  if (error instanceof Error) return error;
  return new Error("An unexpected database error occurred.");
};

const validateSlug = (slug: string) => {
  if (!/^[a-z][a-z0-9_]*$/.test(slug)) {
    throw new Error(
      "Role slug must start with a lowercase letter and contain only lowercase letters, numbers, and underscores.",
    );
  }
};

const validatePermissionCode = (code: string) => {
  if (!/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/.test(code)) {
    throw new Error("Permission code must use dot-separated lowercase names, e.g. tickets.view.");
  }
};

export const rolePermissionService = {
  // -------------------------
  // Roles
  // -------------------------

  async getRoles(): Promise<AppRole[]> {
    const { data, error } = await supabase
      .from("roles")
      .select("id, slug, name, description, is_system, is_active, created_at, updated_at")
      .order("name");

    if (error) throw normalizeError(error);
    return (data ?? []) as AppRole[];
  },

  async createRole(input: CreateRoleInput): Promise<AppRole> {
    const name = input.name.trim();
    const slug = input.slug.trim().toLowerCase();

    if (!name) throw new Error("Role name is required.");
    validateSlug(slug);

    const { data, error } = await supabase
      .from("roles")
      .insert({
        name,
        slug,
        description: input.description?.trim() || null,
        is_system: false,
        is_active: true,
      })
      .select("id, slug, name, description, is_system, is_active, created_at, updated_at")
      .single();

    if (error) throw normalizeError(error);
    return data as AppRole;
  },

  async updateRole(roleId: string, input: Partial<CreateRoleInput>): Promise<AppRole> {
    const { data: existing, error: fetchError } = await supabase
      .from("roles")
      .select("id, is_system")
      .eq("id", roleId)
      .single();

    if (fetchError) throw normalizeError(fetchError);
    if (existing.is_system) {
      throw new Error("System roles cannot be edited through this action.");
    }

    const updates: Record<string, string | null> = {};

    if (input.name !== undefined) {
      const name = input.name.trim();
      if (!name) throw new Error("Role name is required.");
      updates["name"] = name;
    }

    if (input.slug !== undefined) {
      const slug = input.slug.trim().toLowerCase();
      validateSlug(slug);
      updates["slug"] = slug;
    }

    if (input.description !== undefined) {
      updates["description"] = input.description?.trim() || null;
    }

    const { data, error } = await supabase
      .from("roles")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", roleId)
      .select("id, slug, name, description, is_system, is_active, created_at, updated_at")
      .single();

    if (error) throw normalizeError(error);
    return data as AppRole;
  },

  async setRoleActive(roleId: string, isActive: boolean): Promise<AppRole> {
    const { data: existing, error: fetchError } = await supabase
      .from("roles")
      .select("id, is_system")
      .eq("id", roleId)
      .single();

    if (fetchError) throw normalizeError(fetchError);
    if (existing.is_system) {
      throw new Error("System roles cannot be deactivated.");
    }

    const { error } = await supabase.rpc("set_role_active", {
      _role_id: roleId,
      _is_active: isActive,
    });

    if (error) throw normalizeError(error);

    const { data, error: readError } = await supabase
      .from("roles")
      .select("id, slug, name, description, is_system, is_active, created_at, updated_at")
      .eq("id", roleId)
      .single();

    if (readError) throw normalizeError(readError);
    return data as AppRole;
  },

  // -------------------------
  // Permission definitions
  // -------------------------

  async getPermissions(): Promise<AppPermission[]> {
    const { data, error } = await supabase
      .from("permissions")
      .select("id, code, module, description, created_at")
      .order("module")
      .order("code");

    if (error) throw normalizeError(error);
    return (data ?? []) as AppPermission[];
  },

  async createPermission(input: CreatePermissionInput): Promise<AppPermission> {
    const code = input.code.trim().toLowerCase();
    const module = input.module.trim();

    validatePermissionCode(code);
    if (!module) throw new Error("Permission module is required.");

    const { data, error } = await supabase
      .from("permissions")
      .insert({
        code,
        module,
        description: input.description?.trim() || null,
      })
      .select("id, code, module, description, created_at")
      .single();

    if (error) throw normalizeError(error);
    return data as AppPermission;
  },

  // -------------------------
  // Role-permission mappings
  // -------------------------

  async getRolePermissions(roleId: string): Promise<string[]> {
    const { data, error } = await supabase
      .from("role_permissions")
      .select("permission_id")
      .eq("role_id", roleId);

    if (error) throw normalizeError(error);
    return (data ?? []).map((item) => item.permission_id);
  },

  async saveRolePermissions(roleId: string, permissionIds: string[]): Promise<void> {
    const uniqueIds = [...new Set(permissionIds)];
    const { error } = await supabase.rpc("save_role_permissions", {
      _role_id: roleId,
      _permission_ids: uniqueIds,
    });

    if (error) throw normalizeError(error);

    const { data: savedMappings, error: verifyError } = await supabase
      .from("role_permissions")
      .select("permission_id")
      .eq("role_id", roleId);

    if (verifyError) throw normalizeError(verifyError);

    const expectedIds = [...uniqueIds].sort();
    const savedIds = [
      ...new Set((savedMappings ?? []).map((mapping) => mapping.permission_id)),
    ].sort();
    if (
      expectedIds.length !== savedIds.length ||
      expectedIds.some((permissionId, index) => permissionId !== savedIds[index])
    ) {
      throw new Error(
        "The database did not save the selected permissions. Refresh the role and try again.",
      );
    }
  },

  // -------------------------
  // User role assignments
  // -------------------------

  async getUserPermissions(userId: string): Promise<string[]> {
    const { data, error } = await supabase
      .from("user_roles")
      .select("role_id")
      .eq("user_id", userId)
      .eq("status", "active");

    if (error) throw normalizeError(error);

    const assignedRoleIds = [...new Set((data ?? []).map((item) => item.role_id))];
    if (assignedRoleIds.length === 0) return [];

    const { data: activeRoles, error: activeRolesError } = await supabase
      .from("roles")
      .select("id")
      .in("id", assignedRoleIds)
      .eq("is_active", true);

    if (activeRolesError) throw normalizeError(activeRolesError);
    const roleIds = (activeRoles ?? []).map((role) => role.id);
    if (roleIds.length === 0) return [];

    const { data: mappings, error: mappingsError } = await supabase
      .from("role_permissions")
      .select("permission_id")
      .in("role_id", roleIds);

    if (mappingsError) throw normalizeError(mappingsError);

    const permissionIds = [...new Set((mappings ?? []).map((item) => item.permission_id))];

    if (permissionIds.length === 0) return [];

    const { data: permissions, error: permissionsError } = await supabase
      .from("permissions")
      .select("code")
      .in("id", permissionIds);

    if (permissionsError) throw normalizeError(permissionsError);

    return [...new Set((permissions ?? []).map((item) => item.code))];
  },

  async getUserRoles(userId: string): Promise<UserRoleAssignment[]> {
    const { data, error } = await supabase
      .from("user_roles")
      .select("id, user_id, role_id, status, created_at, updated_at")
      .eq("user_id", userId)
      .order("created_at");

    if (error) throw normalizeError(error);
    return (data ?? []) as UserRoleAssignment[];
  },

  async assignRoleToUser(userId: string, roleId: string): Promise<void> {
    return this.assignRoleToUsers([userId], roleId);
  },

  async assignRoleToUsers(userIds: string[], roleId: string): Promise<void> {
    const uniqueUserIds = [...new Set(userIds)];
    if (uniqueUserIds.length === 0) {
      throw new Error("Select at least one user.");
    }

    const { data: role, error: roleError } = await supabase
      .from("roles")
      .select("id, slug, is_active")
      .eq("id", roleId)
      .single();

    if (roleError) throw normalizeError(roleError);

    if (!role.is_active) {
      throw new Error("Cannot assign an inactive role.");
    }

    const validRoles = ["super_admin", "admin", "ops_manager", "engineer", "customer"] as const;

    if (!validRoles.includes(role.slug as (typeof validRoles)[number])) {
      throw new Error(
        `Role "${role.slug}" cannot be assigned because it does not match an app_role value.`,
      );
    }

    const { error } = await supabase.rpc("assign_user_role", {
      _user_ids: uniqueUserIds,
      _role_id: role.id,
    });

    if (error) throw normalizeError(error);
  },

  async revokeRoleFromUser(assignmentId: string): Promise<void> {
    return this.revokeUserRoles([assignmentId]);
  },

  async revokeUserRoles(assignmentIds: string[]): Promise<void> {
    const uniqueAssignmentIds = [...new Set(assignmentIds)];
    if (uniqueAssignmentIds.length === 0) {
      throw new Error("Select at least one role assignment.");
    }

    const { error } = await supabase.rpc("revoke_user_roles", {
      _assignment_ids: uniqueAssignmentIds,
    });
    if (error) throw normalizeError(error);
  },
};
