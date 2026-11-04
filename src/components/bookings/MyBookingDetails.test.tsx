import { fireEvent, render, screen, waitFor, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  profile: { id: "engineer-1", status: "active" },
  jobAction: vi.fn(),
}));

vi.mock("@/services/engineerService", () => ({
  myEngineerQuery: (userId: string | null) => ({
    queryKey: ["engineer", "me"],
    enabled: Boolean(userId),
    queryFn: async () => mocks.profile,
  }),
  engineerService: { jobAction: mocks.jobAction },
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { TicketAcceptance } from "./MyBookingDetails";

function renderAcceptance(status: "Assigned" | "In Progress" = "Assigned") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <TicketAcceptance
        currentUserId="user-1"
        ticket={{ dbId: "booking-1", engineerId: "engineer-1", status }}
      />
    </QueryClientProvider>,
  );
  return client;
}

describe("Project ticket acceptance", () => {
  beforeEach(() => {
    mocks.profile = { id: "engineer-1", status: "active" };
    mocks.jobAction.mockReset();
    mocks.jobAction.mockResolvedValue(undefined);
  });
  afterEach(cleanup);

  it("lets the assigned engineer accept the specific ticket", async () => {
    renderAcceptance();
    fireEvent.click(await screen.findByRole("button", { name: "Accept ticket" }));
    await waitFor(() => expect(mocks.jobAction).toHaveBeenCalledWith("booking-1", "start"));
  });

  it("does not offer acceptance to another engineer", async () => {
    mocks.profile = { id: "engineer-2", status: "active" };
    const client = renderAcceptance();
    await waitFor(() => expect(client.getQueryState(["engineer", "me"])?.status).toBe("success"));
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(mocks.jobAction).not.toHaveBeenCalled();
  });

  it("disables acceptance for an inactive assigned engineer", async () => {
    mocks.profile.status = "inactive";
    renderAcceptance();
    expect(await screen.findByRole("button", { name: "Accept ticket" })).toBeDisabled();
  });

  it("does not offer acceptance once work is in progress", () => {
    renderAcceptance("In Progress");
    expect(screen.queryByRole("button", { name: "Accept ticket" })).not.toBeInTheDocument();
  });
});
