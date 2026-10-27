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
} from "@/services/notificationService";
import { useAuth } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/usePermission";
import { servicesQuery } from "@/services/catalogService";
import { MyBookings } from "@/components/bookings/MyBookings";
import { OrderConfirmationModal } from "@/components/common/OrderConfirmationModal";
import { ProjectSettings } from "@/components/project/ProjectSettings";
import type { CatalogService } from "@/services/catalogService";

export type AppPage =
  | "marketplace"
  | "booking"
  | "bookings"
  | "project"
  | "project-dashboard"
  | "project-tickets"
  | "project-roles"
  | "project-payment";

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

const sampleTickets = [
  {
    title: "Fiber link instability at Kochi branch",
    priority: "Urgent",
    city: "Kochi",
    customer: "Federal Bank",
    status: "Open",
    engineer: "Unassigned",
    progress: 8,
  },
  {
    title: "New store WiFi readiness survey",
    priority: "Medium",
    city: "Mysuru",
    customer: "Croma",
    status: "Open",
    engineer: "Unassigned",
    progress: 12,
  },
  {
    title: "Core switch replacement and testing",
    priority: "High",
    city: "Chennai",
    customer: "TVS Motors",
    status: "In Progress",
    engineer: "Neha Singh",
    progress: 55,
  },
  {
    title: "Structured cabling certification",
    priority: "Low",
    city: "Ahmedabad",
    customer: "Adani Retail",
    status: "Open",
    engineer: "Unassigned",
    progress: 8,
  },
];

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
  "project-payment": "Payment",
};

export function App({ page }: { page: AppPage }) {
  const [category, setCategory] = useState("All");
  const [modal, setModal] = useState<CatalogService | null>(null);
  const [bookingFlow, setBookingFlow] = useState<BookingFlow | null>(null);
  const [flowReady, setFlowReady] = useState(false);
  const requestRef = useRef<PendingBookingRequest | null>(null);
  const createInProgress = useRef(false);
  const auth = useAuth();
  const permissions = usePermissions();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const userId = auth.userId;
  const servicesResult = useQuery(servicesQuery);
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
  const canCreateTickets = isProjectPage && permissions.can("tickets.create");
  const role = isProjectPage ? "team" : "customer";
  const projectSection =
    page === "project-tickets"
      ? "tickets"
      : page === "project-roles"
        ? "roles"
        : page === "project-payment"
          ? "payment"
          : "dashboard";
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
      if (!auth.isStaff) {
        toast.error("Project team access requires an operations or admin role.");
        return;
      }
      void navigate({ to: "/$", params: { _splat: "project/dashboard" } });
      return;
    }
    void navigate({ to: "/" });
  };

  const createSampleTicket = async () => {
    if (!permissions.can("tickets.create")) {
      toast.error("You don’t have permission to create tickets.");
      return;
    }
    if (!userId) return;
    const sample = sampleTickets[customerTickets.length % sampleTickets.length];
    if (!sample) throw new Error("No sample ticket is configured.");
    try {
      await bookingService.createSample(userId, sample);
      refreshTickets();
      toast.success("New ticket created");
      void navigate({ to: "/$", params: { _splat: "project/ticket" } });
    } catch {
      toast.error("Could not create the ticket. Please retry.");
    }
  };

  const createTicket = async (nextBooking: NewBooking) => {
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
        await bookingService.assign(ticket.dbId, {
          engineer: update.engineer ?? ticket.engineer,
          assigneePhone: update.assigneePhone ?? ticket.assigneePhone,
        });
      } else if (action === "close") {
        await bookingService.close(ticket.dbId);
      } else {
        await bookingService.update(ticket.dbId, update);
      }
      refreshTickets();
      return true;
    } catch {
      toast.error("Update failed — you may not have permission.");
      refreshTickets();
      return false;
    }
  };

  const addComment = async (ticketNo: string, visibility: "public" | "internal", text: string) => {
    if (isProjectPage && !permissions.can("tickets.edit")) {
      toast.error("You don’t have permission to update tickets.");
      return;
    }
    const ticket = customerTickets.find((item) => item.id === ticketNo);
    if (!ticket) return;
    try {
      await bookingService.comment(ticket.dbId, visibility, text, {
        name: auth.profile?.full_name || auth.email || "User",
        role: auth.isStaff
          ? visibility === "internal"
            ? "Service desk"
            : "Operations"
          : "Customer",
      });
      qc.invalidateQueries({ queryKey: ["booking-comments", userId] });
    } catch {
      toast.error("Message could not be sent.");
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
  const activeService =
    page === "booking" || category === "Field Engineer" ? "Field Engineer Support" : category;
  const showServiceNav = page !== "bookings" && !isProjectPage;
  return (
    <AppShell
      canUseTeam={auth.isStaff && permissions.can("sidebar.project_team.portal.view")}
      canViewFieldEngineer={permissions.can("sidebar.field_engineer.view")}
      canViewUpcomingFeatures={permissions.can("sidebar.upcoming_features.view")}
      canViewCustomerPortal={permissions.can("sidebar.customer_portal.view")}
      canViewProjectTeamPortal={permissions.can("sidebar.project_team.portal.view")}
      crumbs={["Home", pageTitles[page]]}
      activeService={activeService}
      onServiceSelect={selectCategory}
      onBookingsSelect={openBookings}
      role={role}
      onRoleChange={selectRole}
      projectSection={projectSection}
      onCreateProjectTicket={createSampleTicket}
      canViewDashboard={
        permissions.can("sidebar.project_team.dashboard.view") && permissions.can("tickets.view")
      }
      canViewTickets={permissions.can("sidebar.project_team.ticket.view")}
      canViewRoles={permissions.can("sidebar.project_team.role_management.view")}
      canViewPayment={permissions.can("sidebar.project_team.finance.view")}
      canCreateTickets={canCreateTickets}
      notifications={notifications}
      onNotificationsOpen={markNotificationsRead}
      showServiceNav={showServiceNav}
    >
      {page === "marketplace" && servicesResult.isError && (
        <div
          role="alert"
          className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
        >
          Services could not be loaded.{" "}
          <button className="underline" onClick={() => servicesResult.refetch()}>
            Retry
          </button>
        </div>
      )}
      {page === "marketplace" && (
        <Marketplace category={category} services={visibleServices} onDetails={setModal} />
      )}
      {page === "booking" && <BookingForm onBack={goHome} onSubmit={createTicket} />}
      {page === "bookings" && (
        <MyBookings
          onBack={goHome}
          customerTickets={customerTickets}
          comments={commentsResult.data}
          onUpdateTicket={updateTicket}
          onComment={addComment}
          loading={ticketsResult.isLoading}
          mode="customer"
          onNotify={addNotification}
        />
      )}
      {isProjectPage && (projectSection === "dashboard" || projectSection === "tickets") && (
        <MyBookings
          onBack={goHome}
          customerTickets={customerTickets}
          comments={commentsResult.data}
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
      {isProjectPage && (projectSection === "roles" || projectSection === "payment") && (
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
