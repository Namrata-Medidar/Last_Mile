import type { ReactNode } from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NewBooking } from "@/services/bookingService";

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  upload: vi.fn(),
  error: vi.fn(),
  invalidateQueries: vi.fn(),
  submit: null as null | ((booking: NewBooking & { attachments?: File[] }) => Promise<void>),
}));

vi.mock("@tanstack/react-router", () => ({ useNavigate: () => vi.fn() }));
vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({ data: undefined }),
  useQueryClient: () => ({ invalidateQueries: mocks.invalidateQueries }),
}));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { error: mocks.error }) }));
vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({
    userId: "customer-id",
    ready: true,
    profileReady: true,
    profile: { status: "active" },
    hasRole: () => true,
  }),
}));
vi.mock("@/hooks/usePermission", () => ({ usePermissions: () => ({ can: () => true }) }));
vi.mock("@/services/bookingService", () => ({
  bookingService: { create: mocks.create },
  ticketsQuery: vi.fn(),
  commentsQuery: vi.fn(),
  useBookingsRealtime: vi.fn(),
}));
vi.mock("@/services/attachmentService", () => ({ attachmentService: { upload: mocks.upload } }));
vi.mock("@/services/notificationService", () => ({
  notificationService: {},
  notificationsQuery: vi.fn(),
  useNotificationsRealtime: vi.fn(),
}));
vi.mock("@/services/catalogService", () => ({ servicesQuery: {} }));
vi.mock("@/services/cancellationPolicyService", () => ({ cancellationPolicyQuery: vi.fn() }));
vi.mock("@/services/authService", () => ({ authService: {} }));
vi.mock("@/services/userService", () => ({ userService: {} }));
vi.mock("@/components/layout/AppShell", () => ({
  AppShell: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("@/components/field-engineer/BookingForm", () => ({
  BookingForm: ({ onSubmit }: { onSubmit: NonNullable<typeof mocks.submit> }) => {
    mocks.submit = onSubmit;
    return null;
  },
}));
vi.mock("@/components/services/Marketplace", () => ({ Marketplace: () => null }));
vi.mock("@/components/services/ServiceModal", () => ({ ServiceModal: () => null }));
vi.mock("@/components/bookings/MyBookings", () => ({ MyBookings: () => null }));
vi.mock("@/components/project/ProjectSettings", () => ({ ProjectSettings: () => null }));
vi.mock("@/components/common/OrderConfirmationModal", () => ({
  OrderConfirmationModal: () => <div>Booking saved</div>,
}));

import { App } from "./App";

const booking: NewBooking = { level: "L2", count: 1, priority: "P1", total: 15000 };
const ticket = { dbId: "booking-uuid", id: "BK-123" };

describe("booking attachment submission", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    mocks.create.mockResolvedValue(ticket);
    mocks.upload.mockResolvedValue({ id: "attachment-id" });
  });
  afterEach(cleanup);

  it("uploads every selected file against the created booking, outside the booking JSON", async () => {
    const files = [new File(["first"], "first.txt"), new File(["second"], "second.txt")];
    render(<App page="booking" />);

    await act(async () => {
      await mocks.submit!({ ...booking, attachments: files });
    });

    expect(mocks.create).toHaveBeenCalledWith("customer-id", expect.objectContaining(booking), {
      status: "active",
    });
    expect(mocks.create.mock.calls[0][1]).not.toHaveProperty("attachments");
    expect(mocks.upload).toHaveBeenCalledTimes(2);
    expect(mocks.upload).toHaveBeenNthCalledWith(1, ticket.dbId, files[0]);
    expect(mocks.upload).toHaveBeenNthCalledWith(2, ticket.dbId, files[1]);
    expect(screen.getByText("Booking saved")).toBeInTheDocument();
    expect(sessionStorage.getItem("last-mile-booking-flow")).not.toContain('"attachments"');
    expect(mocks.error).not.toHaveBeenCalled();
  });

  it("keeps the booking and reports a failed file while allowing other uploads", async () => {
    mocks.upload.mockRejectedValueOnce(new Error("Storage denied the upload"));
    render(<App page="booking" />);

    await act(async () => {
      await mocks.submit!({
        ...booking,
        attachments: [new File(["bad"], "failed.txt"), new File(["ok"], "ok.txt")],
      });
    });

    expect(mocks.create).toHaveBeenCalledTimes(1);
    expect(mocks.upload).toHaveBeenCalledTimes(2);
    expect(mocks.error).toHaveBeenCalledWith(
      expect.stringContaining("failed.txt: Storage denied the upload"),
    );
    expect(screen.getByText("Booking saved")).toBeInTheDocument();
    expect(sessionStorage.getItem("last-mile-booking-request")).toBeNull();
  });

  it("supports bookings without attachments", async () => {
    render(<App page="booking" />);

    await act(async () => {
      await mocks.submit!(booking);
    });

    expect(mocks.upload).not.toHaveBeenCalled();
    expect(screen.getByText("Booking saved")).toBeInTheDocument();
  });

  it("does not upload files when booking creation fails", async () => {
    mocks.create.mockRejectedValueOnce(new Error("Booking failed"));
    render(<App page="booking" />);

    await act(async () => {
      await mocks.submit!({ ...booking, attachments: [new File(["test"], "note.txt")] });
    });

    expect(mocks.upload).not.toHaveBeenCalled();
    expect(screen.queryByText("Booking saved")).not.toBeInTheDocument();
    expect(mocks.error).toHaveBeenCalledWith("Your booking could not be saved. Please try again.");
  });
});
