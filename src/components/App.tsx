import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { BookingForm } from "@/components/field-engineer/BookingForm";
import { Marketplace } from "@/components/services/Marketplace";
import { ServiceModal } from "@/components/services/ServiceModal";
import {
  bookingService,
  commentsQuery,
  ticketsQuery,
  useBookingsRealtime,
  type NewBooking,
  type Ticket,
  type TicketUpdate,
} from "@/services/bookingService";
import {
  notificationService,
  notificationsQuery,
  useNotificationsRealtime,
  type AppNotification,
} from "@/services/notificationService";
import { useAuth } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/usePermission";
import { servicesQuery } from "@/services/catalogService";
import { MyBookings } from "@/components/bookings/MyBookings";
import { OrderConfirmationModal } from "@/components/common/OrderConfirmationModal";
import { ProjectSettings } from "@/components/project/ProjectSettings";
import type { CatalogService } from "@/services/catalogService";
import { authService } from "@/services/authService";
import { userService } from "@/services/userService";
import { attachmentService } from "@/services/attachmentService";
import {
  cancellationPolicyQuery,
  type CancellationPolicy,
} from "@/services/cancellationPolicyService";

export type AppPage =
  | "marketplace"
  | "booking"
  | "bookings"
  | "project"
  | "project-dashboard"
  | "project-tickets"
  | "project-roles";

type BookingFlow = {
  userId: string;
  booking: NewBooking;
  ticket: Ticket;
  confirmationPending: boolean;
};

const bookingFlowStorageKey = "last-mile-booking-flow";
const bookingRequestStorageKey = "last-mile-booking-request";
type PendingBookingRequest = {
  userId: string;
  fingerprint: string;
  id: string;
};

function readPendingBookingRequest(): PendingBookingRequest | null {
  try {
    const value = sessionStorage.getItem(bookingRequestStorageKey);
    if (!value) return null;
    const parsed: unknown = JSON.parse(value);
    if (
      isRecord(parsed) &&
      typeof parsed["userId"] === "string" &&
      typeof parsed["fingerprint"] === "string" &&
      typeof parsed["id"] === "string"
    ) {
      return {
        userId: parsed["userId"],
        fingerprint: parsed["fingerprint"],
        id: parsed["id"],
      };
    }
    console.error("Saved booking retry data is invalid; it was discarded.");
    sessionStorage.removeItem(bookingRequestStorageKey);
    return null;
  } catch (error) {
    console.error("Could not restore booking retry data.", error);
    return null;
  }
}

function savePendingBookingRequest(request: PendingBookingRequest | null): void {
  try {
    if (request) {
      sessionStorage.setItem(bookingRequestStorageKey, JSON.stringify(request));
    } else {
      sessionStorage.removeItem(bookingRequestStorageKey);
    }
  } catch (error) {
    console.error("Could not save booking retry data in this browser session.", error);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

function isBookingFlow(value: unknown): value is BookingFlow {
  if (!isRecord(value) || !isRecord(value["booking"]) || !isRecord(value["ticket"])) {
    return false;
  }
  return (
    typeof value["userId"] === "string" &&
    typeof value["booking"]["level"] === "string" &&
    typeof value["booking"]["total"] === "number" &&
    typeof value["ticket"]["id"] === "string" &&
    typeof value["confirmationPending"] === "boolean"
  );
}

function readBookingFlow(): BookingFlow | null {
  try {
    const value = sessionStorage.getItem(bookingFlowStorageKey);
    if (!value) return null;
    const parsed: unknown = JSON.parse(value);
    if (isBookingFlow(parsed)) return parsed;
    console.error("Saved booking flow has an invalid shape; it was discarded.");
    sessionStorage.removeItem(bookingFlowStorageKey);
    return null;
  } catch (error) {
    console.error("Could not restore the saved booking flow.", error);
    return null;
  }
}

function saveBookingFlow(flow: BookingFlow | null): void {
  try {
    if (flow) sessionStorage.setItem(bookingFlowStorageKey, JSON.stringify(flow));
    else sessionStorage.removeItem(bookingFlowStorageKey);
  } catch (error) {
    console.error("Could not save the booking flow in this browser session.", error);
  }
}

function makeRequestId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

const pageTitles: Record<AppPage, string> = {
  marketplace: "Marketplace",
  booking: "Field Engineer Support",
  bookings: "My orders",
  project: "Project dashboard",
  "project-dashboard": "Project dashboard",
  "project-tickets": "Tickets",
  "project-roles": "Role management",
};

export function App({
  page,
  targetTicketId,
}: {
  page: AppPage;
  targetTicketId?: string | undefined;
}) {
  const [category, setCategory] = useState("All");
  const [modal, setModal] = useState<CatalogService | null>(null);
  const [bookingFlow, setBookingFlow] = useState<BookingFlow | null>(null);
  const [flowReady, setFlowReady] = useState(false);
  const [isCheckingApproval, setIsCheckingApproval] = useState(false);
  const requestRef = useRef<PendingBookingRequest | null>(null);
  const createInProgress = useRef(false);
  const auth = useAuth();
  const permissions = usePermissions();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const userId = auth.userId;
  const servicesResult = useQuery(servicesQuery);
  const cancellationPolicyResult = useQuery(cancellationPolicyQuery(userId));
  const ticketsResult = useQuery(ticketsQuery(userId));
  const customerTickets = userId ? (ticketsResult.data ?? []) : [];
  const commentsResult = useQuery(commentsQuery(userId));
  const notifications = useQuery(notificationsQuery(userId)).data ?? [];

  useBookingsRealtime(userId);
  useNotificationsRealtime(userId);

  useEffect(() => {
    setBookingFlow(readBookingFlow());
    setFlowReady(true);
  }, []);

  useEffect(() => {
    if (!flowReady || !auth.ready || !bookingFlow) return;
    if (bookingFlow.userId !== userId) {
      setBookingFlow(null);
      saveBookingFlow(null);
    }
  }, [auth.ready, bookingFlow, flowReady, userId]);

  useEffect(() => {
    if (!flowReady || !auth.ready) return;
    const pendingRequest = readPendingBookingRequest();
    if (pendingRequest && pendingRequest.userId !== userId) {
      requestRef.current = null;
      savePendingBookingRequest(null);
    }
  }, [auth.ready, flowReady, userId]);

  const activeFlow = auth.ready && bookingFlow?.userId === userId ? bookingFlow : null;
  const services = servicesResult.data ?? [];
  const visibleServices = services.filter(
    (service) => category === "All" || service.category === category,
  );
  const isProjectPage = page.startsWith("project");
  const canEditTickets = !isProjectPage || permissions.can("tickets.edit");
  const role = isProjectPage ? "team" : "customer";
  const projectSection =
    page === "project-tickets" ? "tickets" : page === "project-roles" ? "roles" : "dashboard";
  const refreshTickets = () => qc.invalidateQueries({ queryKey: ["bookings", userId] });

  const goHome = () => navigate({ to: "/" });
  const openBookings = () => navigate({ to: "/bookings" });
  const selectCategory = (nextCategory: string) => {
    if (nextCategory === "Field Engineer") {
      setCategory(nextCategory);
      void navigate({ to: "/booking" });
      return;
    }
    setCategory(nextCategory);
    void navigate({ to: "/" });
  };
  const selectRole = (nextRole: string) => {
    if (nextRole === "team") {
      const teamRoute = permissions.can("sidebar.project_team.dashboard.view")
        ? "project/dashboard"
        : permissions.can("sidebar.project_team.ticket.view")
          ? "project/ticket"
          : permissions.can("sidebar.project_team.role_management.view")
            ? "admin/role"
            : null;
      if (!teamRoute) {
        toast.error("You don’t have permission to access the Project Team workspace.");
        return;
      }
      void navigate({ to: "/$", params: { _splat: teamRoute } });
      return;
    }
    void navigate({ to: "/" });
  };

  const createTicket = async ({
    attachments = [],
    ...nextBooking
  }: NewBooking & { attachments?: File[] }) => {
    if (!userId) {
      void navigate({ to: "/auth", search: { redirect: "/booking" } });
      return;
    }
    if (createInProgress.current) return;
    const fingerprint = JSON.stringify(nextBooking);
    if (requestRef.current?.fingerprint !== fingerprint || requestRef.current.userId !== userId) {
      const savedRequest = readPendingBookingRequest();
      requestRef.current =
        savedRequest?.userId === userId && savedRequest.fingerprint === fingerprint
          ? savedRequest
          : { userId, fingerprint, id: makeRequestId() };
    }
    savePendingBookingRequest(requestRef.current);

    createInProgress.current = true;
    try {
      const requestId = requestRef.current.id;
      const ticket = await bookingService.create(
        userId,
        { ...nextBooking, clientRequestId: requestId },
        auth.profile ?? {},
      );
      const uploads = await Promise.allSettled(
        attachments.map((file) => attachmentService.upload(ticket.dbId, file)),
      );
      const failedUploads = uploads.flatMap((result, index) =>
        result.status === "rejected"
          ? [
              `${attachments[index].name}: ${result.reason instanceof Error ? result.reason.message : "Upload failed"}`,
            ]
          : [],
      );
      if (failedUploads.length > 0) {
        toast.error(
          `Booking ${ticket.id} was saved, but some attachments could not be uploaded. Retry these files from My Orders. ${failedUploads.join("; ")}`,
        );
      }
      const nextFlow: BookingFlow = {
        userId,
        booking: nextBooking,
        ticket,
        confirmationPending: true,
      };
      setBookingFlow(nextFlow);
      saveBookingFlow(nextFlow);
      requestRef.current = null;
      savePendingBookingRequest(null);
      void refreshTickets();
    } catch {
      toast.error("Your booking could not be saved. Please try again.");
    } finally {
      createInProgress.current = false;
    }
  };

  const updateTicket = async (
    ticketNo: string,
    update: TicketUpdate,
    action: "edit" | "assignee" | "close" = "edit",
  ): Promise<boolean> => {
    const requiredPermission = {
      edit: "tickets.edit",
      assignee: "ticket.addassignee",
      close: "ticket.close",
    }[action];
    if (isProjectPage && !permissions.can(requiredPermission)) {
      toast.error(`You don’t have permission: ${requiredPermission}.`);
      return false;
    }
    const ticket = customerTickets.find((item) => item.id === ticketNo);
    if (!ticket) return false;
    try {
      if (action === "assignee") {
        await bookingService.assign(ticket.dbId, update.engineerId ?? null);
      } else if (action === "close") {
        await bookingService.close(ticket.dbId);
      } else {
        await bookingService.update(ticket.dbId, update);
      }
      refreshTickets();
      return true;
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Unexpected database error.";
      toast.error(
        action === "assignee"
          ? `Engineer assignment failed: ${detail}`
          : `Ticket update failed: ${detail}`,
      );
      refreshTickets();
      return false;
    }
  };

  const cancelTicket = async (ticketId: string, message: string): Promise<string | null> => {
    const ticket = customerTickets.find((item) => item.id === ticketId);
    if (!ticket?.dbId)
      throw new Error("Could not find this booking. Refresh My Orders and try again.");
    await bookingService.cancel(ticket.dbId);
    let messageError: string | null = null;
    if (message) {
      try {
        await bookingService.comment(ticket.dbId, "public", `Cancellation message: ${message}`, {
          name: auth.profile?.full_name || auth.email || "Customer",
          role: "Customer",
        });
      } catch (error) {
        messageError =
          error instanceof Error ? error.message : "The cancellation message could not be saved.";
      }
    }
    await Promise.all([
      refreshTickets(),
      qc.invalidateQueries({ queryKey: ["booking-comments", userId] }),
    ]);
    return messageError;
  };

  const addComment = async (ticketNo: string, visibility: "public" | "internal", text: string) => {
    if (isProjectPage && !permissions.can("tickets.edit")) {
      toast.error("You don’t have permission to update tickets.");
      return;
    }
    const ticket = customerTickets.find((item) => item.id === ticketNo);
    if (!ticket) return;
    try {
      const roleNames = await userService.getRoleNames(userId!);
      if (!roleNames.length) {
        throw new Error("No active role is assigned to your account.");
      }
      await bookingService.comment(ticket.dbId, visibility, text, {
        name: auth.profile?.full_name || auth.email || "User",
        role: roleNames.join(", "),
      });
      qc.invalidateQueries({ queryKey: ["booking-comments", userId] });
    } catch (error) {
      console.error("Could not send ticket message.", error);
      toast.error(error instanceof Error ? error.message : "Message could not be sent.");
    }
  };

  const markNotificationsRead = async () => {
    if (!userId || !notifications.some((notification) => !notification.read)) return;
    try {
      await notificationService.markAllRead(userId);
      qc.invalidateQueries({ queryKey: ["notifications", userId] });
    } catch {
      // Notification read state is non-critical.
    }
  };

  const openNotification = (notification: AppNotification) => {
    if (notification.bookingId) {
      void navigate({
        to: "/bookings",
        search: { ticket: notification.bookingId },
      });
      return;
    }
    void navigate({ to: "/bookings" });
  };

  const confirmOrder = async () => {
    if (!activeFlow) return;
    setBookingFlow(null);
    saveBookingFlow(null);
    await qc.invalidateQueries({ queryKey: ["bookings", userId] });
    await navigate({ to: "/bookings" });
  };

  const addNotification = (notification: { title: string; detail: string }): void => {
    toast(notification.title, { description: notification.detail });
  };

  if (userId && !auth.profileReady) {
    return (
      <div className="grid min-h-screen place-items-center p-6 text-sm text-muted-foreground">
        Loading your account status…
      </div>
    );
  }

  if (userId && (auth.profileError || !auth.profile)) {
    return (
      <div className="grid min-h-screen place-items-center p-6 text-center">
        <div className="space-y-3">
          <p role="alert" className="text-sm text-destructive">
            {auth.profileError
              ? "Your account status could not be verified."
              : "Your account profile could not be found."}{" "}
            Retry the lookup or sign out and contact support.
          </p>
          <button
            type="button"
            className="mr-4 underline"
            disabled={isCheckingApproval}
            onClick={async () => {
              setIsCheckingApproval(true);
              try {
                await qc.refetchQueries(
                  {
                    queryKey: ["profile", userId],
                  },
                  {
                    throwOnError: true,
                  },
                );
              } catch (error) {
                toast.error(
                  `Could not check account status: ${error instanceof Error ? error.message : "Unknown error"}`,
                );
              } finally {
                setIsCheckingApproval(false);
              }
            }}
          >
            {isCheckingApproval ? "Checking…" : "Retry"}
          </button>
          <button
            type="button"
            className="underline"
            onClick={async () => {
              const { error } = await authService.signOut();
              if (error) toast.error(`Could not sign out: ${error.message}`);
            }}
          >
            Sign out
          </button>
        </div>
      </div>
    );
  }

  if (userId && auth.profile?.status !== "active") {
    const isRejected = auth.profile?.status === "rejected";
    const isDeleted = auth.profile?.status === "deleted";
    return (
      <div className="grid min-h-screen place-items-center p-6 text-center">
        <div className="max-w-md space-y-3 rounded-lg border border-border bg-card p-6">
          <h1 className="text-xl font-semibold">
            {isDeleted
              ? "Account deleted"
              : isRejected
                ? "Account access rejected"
                : "Account pending approval"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isDeleted
              ? "This account has been deleted. Contact the super administrator if you believe this is incorrect."
              : isRejected
                ? "Your account was not approved. Contact the super administrator if you believe this is incorrect."
                : "A super administrator must approve your account before you can access bookings or account permissions."}
          </p>
          <div className="flex justify-center gap-4">
            {!isDeleted && (
              <button
                type="button"
                className="text-sm underline"
                disabled={isCheckingApproval}
                onClick={async () => {
                  setIsCheckingApproval(true);
                  try {
                    await Promise.all([
                      qc.refetchQueries(
                        {
                          queryKey: ["profile", userId],
                        },
                        {
                          throwOnError: true,
                        },
                      ),
                      qc.refetchQueries(
                        {
                          queryKey: ["roles", userId],
                        },
                        {
                          throwOnError: true,
                        },
                      ),
                    ]);
                  } catch (error) {
                    toast.error(
                      `Could not check approval status: ${error instanceof Error ? error.message : "Unknown error"}`,
                    );
                  } finally {
                    setIsCheckingApproval(false);
                  }
                }}
              >
                {isCheckingApproval ? "Checking…" : "Check approval status"}
              </button>
            )}
            <button
              type="button"
              className="text-sm underline"
              onClick={async () => {
                const { error } = await authService.signOut();
                if (error) toast.error(`Could not sign out: ${error.message}`);
              }}
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    );
  }

  const cancellationPolicy: CancellationPolicy | null = cancellationPolicyResult.data ?? null;
  const activeService =
    page === "booking" || category === "Field Engineer" ? "Field Engineer Support" : category;
  const showServiceNav = page !== "bookings" && !isProjectPage;
  return (
    <AppShell
      canUseTeam={
        permissions.can("sidebar.project_team.dashboard.view") ||
        permissions.can("sidebar.project_team.ticket.view") ||
        permissions.can("sidebar.project_team.role_management.view")
      }
      canViewFieldEngineer={permissions.can("sidebar.field_engineer.view")}
      canViewUpcomingFeatures={permissions.can("sidebar.upcoming_features.view")}
      canViewCustomerPortal={auth.hasRole("customer")}
      canViewMyOrders={permissions.can("sidebar.my_orders.view")}
      crumbs={["Home", pageTitles[page]]}
      activeService={activeService}
      onServiceSelect={selectCategory}
      onBookingsSelect={openBookings}
      role={role}
      onRoleChange={selectRole}
      projectSection={projectSection}
      canViewDashboard={permissions.can("sidebar.project_team.dashboard.view")}
      canViewTickets={permissions.can("sidebar.project_team.ticket.view")}
      canViewRoles={permissions.can("sidebar.project_team.role_management.view")}
      notifications={notifications}
      onNotificationsOpen={markNotificationsRead}
      onNotificationSelect={openNotification}
      showServiceNav={showServiceNav}
    >
      {userId && permissions.error && (
        <div
          role="alert"
          className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
        >
          Navigation permissions could not be loaded: {permissions.error.message}.{" "}
          <button className="underline" onClick={() => void permissions.refetch()}>
            Retry
          </button>
        </div>
      )}
      {page === "marketplace" && servicesResult.isError && (
        <div
          role="alert"
          className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
        >
          Services could not be loaded: {servicesResult.error.message}.{" "}
          <button className="underline" onClick={() => servicesResult.refetch()}>
            Retry
          </button>
        </div>
      )}
      {page === "marketplace" && (
        <Marketplace category={category} services={visibleServices} onDetails={setModal} />
      )}
      {page === "booking" && (
        <BookingForm
          onBack={goHome}
          onSubmit={createTicket}
          cancellationPolicy={cancellationPolicy}
          cancellationPolicyLoading={cancellationPolicyResult.isLoading}
          cancellationPolicyError={
            cancellationPolicyResult.error instanceof Error
              ? cancellationPolicyResult.error.message
              : null
          }
          onRetryCancellationPolicy={() => void cancellationPolicyResult.refetch()}
        />
      )}
      {page === "bookings" && (
        <MyBookings
          onBack={goHome}
          currentUserId={userId}
          customerTickets={customerTickets}
          comments={commentsResult.data}
          commentsError={commentsResult.error?.message ?? null}
          onUpdateTicket={updateTicket}
          onCancelTicket={cancelTicket}
          cancellationPolicy={cancellationPolicy}
          cancellationPolicyLoading={cancellationPolicyResult.isLoading}
          cancellationPolicyError={
            cancellationPolicyResult.error instanceof Error
              ? cancellationPolicyResult.error.message
              : null
          }
          onComment={addComment}
          loading={ticketsResult.isLoading}
          mode="customer"
          onNotify={addNotification}
          targetTicketId={targetTicketId}
        />
      )}
      {isProjectPage && (projectSection === "dashboard" || projectSection === "tickets") && (
        <MyBookings
          onBack={goHome}
          currentUserId={userId}
          customerTickets={customerTickets}
          comments={commentsResult.data}
          commentsError={commentsResult.error?.message ?? null}
          onUpdateTicket={updateTicket}
          onComment={addComment}
          loading={ticketsResult.isLoading}
          mode="team"
          canEditTickets={canEditTickets}
          canAddAssignee={permissions.can("ticket.addassignee")}
          canCloseTicket={permissions.can("ticket.close")}
          showDashboard={projectSection === "dashboard"}
          showTickets={projectSection === "tickets"}
          onNotify={addNotification}
        />
      )}
      {isProjectPage && projectSection === "roles" && (
        <ProjectSettings section={projectSection} onNotify={addNotification} />
      )}
      {modal && (
        <ServiceModal
          service={modal}
          onClose={() => setModal(null)}
          onBook={() => {
            setModal(null);
            if (!auth.userId) {
              toast("Sign in to book this service.");
              void navigate({ to: "/auth", search: { redirect: "/booking" } });
              return;
            }
            void navigate({ to: "/booking" });
          }}
        />
      )}
      {page === "booking" && activeFlow?.confirmationPending && (
        <OrderConfirmationModal ticket={activeFlow.ticket} onConfirm={confirmOrder} />
      )}
    </AppShell>
  );
}
