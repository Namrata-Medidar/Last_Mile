import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: mocks.from } }));

import { rolePermissionService } from "./rolePermissionService";
import { userService } from "./userService";

function query(data: unknown[]) {
  const result = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    then: (resolve: (value: { data: unknown[]; error: null }) => unknown) =>
      Promise.resolve({ data, error: null }).then(resolve),
  };
  return result;
}

const roleId = "a3f63186-76bb-4af8-9539-5a1c2c974884";

describe("Role lookups with unlinked legacy assignments", () => {
  beforeEach(() => mocks.from.mockReset());

  it("loads sidebar permissions without sending null role IDs", async () => {
    const assignments = query([{ role_id: roleId }, { role_id: null }, { role_id: roleId }]);
    const roles = query([{ id: roleId }]);
    mocks.from
      .mockReturnValueOnce(assignments)
      .mockReturnValueOnce(roles)
      .mockReturnValueOnce(query([{ permission_id: "permission-1" }]))
      .mockReturnValueOnce(query([{ code: "sidebar.project_team.ticket.view" }]));

    expect(await rolePermissionService.getUserPermissions("user-1")).toEqual([
      "sidebar.project_team.ticket.view",
    ]);
    expect(assignments.not).toHaveBeenCalledWith("role_id", "is", null);
    expect(roles.in).toHaveBeenCalledWith("id", [roleId]);
  });

  it("loads profile role names without sending null role IDs", async () => {
    const roles = query([{ name: "Admin" }]);
    mocks.from
      .mockReturnValueOnce(query([{ role_id: null }, { role_id: roleId }]))
      .mockReturnValueOnce(roles);

    expect(await userService.getRoleNames("user-1")).toEqual(["Admin"]);
    expect(roles.in).toHaveBeenCalledWith("id", [roleId]);
  });

  it("does not query the role catalog when all assignments are unlinked", async () => {
    mocks.from.mockReturnValue(query([{ role_id: null }]));
    expect(await rolePermissionService.getUserPermissions("user-1")).toEqual([]);
    expect(mocks.from).toHaveBeenCalledTimes(1);
  });

  it("combines multiple roles while ignoring null links and duplicate permissions", async () => {
    const secondRoleId = "b3f63186-76bb-4af8-9539-5a1c2c974884";
    const roles = query([{ id: roleId }, { id: secondRoleId }]);
    const permissions = query([
      { code: "sidebar.project_team.ticket.view" },
      { code: "sidebar.my_orders.view" },
      { code: "sidebar.project_team.ticket.view" },
    ]);
    mocks.from
      .mockReturnValueOnce(
        query([{ role_id: roleId }, { role_id: null }, { role_id: secondRoleId }]),
      )
      .mockReturnValueOnce(roles)
      .mockReturnValueOnce(
        query([
          { permission_id: "permission-1" },
          { permission_id: "permission-2" },
          { permission_id: "permission-1" },
        ]),
      )
      .mockReturnValueOnce(permissions);

    expect(await rolePermissionService.getUserPermissions("user-1")).toEqual([
      "sidebar.project_team.ticket.view",
      "sidebar.my_orders.view",
    ]);
    expect(roles.in).toHaveBeenCalledWith("id", [roleId, secondRoleId]);
    expect(permissions.in).toHaveBeenCalledWith("id", ["permission-1", "permission-2"]);
  });
});
