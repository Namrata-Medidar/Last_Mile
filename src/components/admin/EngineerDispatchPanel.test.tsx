import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ updateProfile: vi.fn() }));
vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ isStaff: true, ready: true, roles: ["super_admin"] }),
}));
vi.mock("@/hooks/usePermission", () => ({
  usePermissions: () => ({ isLoading: false, can: () => true }),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/services/engineerService", () => ({
  allEngineersQuery: {
    queryKey: ["engineers", "all"],
    queryFn: async () => [
      {
        id: "engineer-1",
        full_name: "Naina",
        phone: "1234567890",
        grade: "L1",
        city: "Pune",
        status: "active",
      },
    ],
  },
  engineerWorkloadQuery: () => ({
    queryKey: ["engineers", "workload"],
    queryFn: async () => ({}),
  }),
  useEngineerRealtime: () => undefined,
  engineerService: { updateProfile: mocks.updateProfile },
}));

import { EngineerDispatchPanel } from "./EngineerDispatchPanel";

describe("Engineer level editing", () => {
  beforeEach(() => {
    mocks.updateProfile.mockReset();
    mocks.updateProfile.mockResolvedValue(undefined);
  });
  afterEach(cleanup);

  it("saves L2 immediately without requiring blur", async () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <EngineerDispatchPanel />
      </QueryClientProvider>,
    );
    fireEvent.mouseEnter(await screen.findByText("L1", { selector: "div" }));
    fireEvent.change(screen.getByRole("combobox", { name: "Engineer grade" }), {
      target: { value: "L2" },
    });
    await waitFor(() =>
      expect(mocks.updateProfile).toHaveBeenCalledWith("engineer-1", { grade: "L2" }),
    );
    expect(mocks.updateProfile).toHaveBeenCalledTimes(1);
  });

  it("does not replace the level editor when another cell is hovered", async () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <EngineerDispatchPanel />
      </QueryClientProvider>,
    );
    fireEvent.mouseEnter(await screen.findByText("L1", { selector: "div" }));
    fireEvent.mouseEnter(screen.getByText("Pune"));
    expect(screen.getByRole("combobox", { name: "Engineer grade" })).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Engineer city" })).not.toBeInTheDocument();
  });
});
