// @ts-nocheck
import { useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { EngineerLogin } from "@/components/field-engineer/Login";
import { BookingForm } from "@/components/field-engineer/BookingForm";
import { EngineerPayment } from "@/components/field-engineer/Payment";
import { EngineerTracking } from "@/components/field-engineer/Tracking";
import { EngineerCompletion } from "@/components/field-engineer/Completion";
import { Marketplace } from "@/components/services/Marketplace";
import { ServiceModal } from "@/components/services/ServiceModal";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { bookingService, commentsQuery, ticketsQuery, useBookingsRealtime } from "@/services/bookingService";
import { notificationService, notificationsQuery, useNotificationsRealtime } from "@/services/notificationService";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { servicesQuery } from "@/services/catalogService";
import { MyBookings } from "@/components/bookings/MyBookings";
import { OrderConfirmationModal } from "@/components/common/OrderConfirmationModal";
import { ProjectSettings } from "@/components/project/ProjectSettings";

const titles = { marketplace: "Marketplace", login: "Sign in", booking: "Field Engineer Support", payment: "Booking & payment", tracking: "Booking tracking", completion: "Service completion", bookings: "My orders", project: "Project team" };
const sampleTickets = [
  { title: "Fiber link instability at Kochi branch", priority: "Urgent", city: "Kochi", customer: "Federal Bank", status: "Open", engineer: "Unassigned", progress: 8 },
  { title: "New store WiFi readiness survey", priority: "Medium", city: "Mysuru", customer: "Croma", status: "Open", engineer: "Unassigned", progress: 12 },
  { title: "Core switch replacement and testing", priority: "High", city: "Chennai", customer: "TVS Motors", status: "In Progress", engineer: "Neha Singh", progress: 55 },
  { title: "Structured cabling certification", priority: "Low", city: "Ahmedabad", customer: "Adani Retail", status: "Open", engineer: "Unassigned", progress: 8 },
];

export function App() {
  const [view, setView] = useState("marketplace");
  const [category, setCategory] = useState("All");
  const [modal, setModal] = useState(null);
  const [booking, setBooking] = useState(null);
  const [confirmedTicket, setConfirmedTicket] = useState(null);
  const [role, setRole] = useState("customer");
  const [projectSection, setProjectSection] = useState("dashboard");
  const auth = useAuth();
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
  const refreshTickets = () => qc.invalidateQueries({ queryKey: ["bookings", userId] });
  const services = servicesResult.data ?? [];
  const visibleServices = services.filter((service) => category === "All" || service.category === category);
  const goHome = () => setView("marketplace");
  const selectCategory = (nextCategory) => { setCategory(nextCategory); goHome(); };
  const selectRole = (nextRole) => { if (nextRole === "team" && !auth.isStaff) { toast.error("Project team access requires an operations or admin role."); return; } setRole(nextRole); setView(nextRole === "team" ? "project" : "marketplace"); setProjectSection(nextRole === "team" ? "dashboard" : "dashboard"); };
  const createSampleTicket = async () => {
    if (!userId) return;
    const sample = sampleTickets[customerTickets.length % sampleTickets.length];
    try { await bookingService.createSample(userId, sample); refreshTickets(); toast.success("New ticket created"); setProjectSection("tickets"); }
    catch { toast.error("Could not create the ticket. Please retry."); }
  };
  const createTicket = async (nextBooking) => {
    if (!userId) { navigate({ to: "/auth", search: { redirect: "/" } }); return; }
    try {
      const ticket = await bookingService.create(userId, nextBooking, auth.profile ?? {});
      setBooking({ ...nextBooking, ticketId: ticket.id });
      refreshTickets();
      setConfirmedTicket(ticket);
    } catch {
      toast.error("Your booking could not be saved. Please try again.");
    }
  };
  const updateTicket = async (ticketNo, update) => {
    const t = customerTickets.find((x) => x.id === ticketNo);
    if (!t) return;
    try { await bookingService.update(t.dbId, update); refreshTickets(); }
    catch { toast.error("Update failed — you may not have permission."); refreshTickets(); }
  };
  const addComment = async (ticketNo, visibility, text) => {
    const t = customerTickets.find((x) => x.id === ticketNo);
    if (!t) return;
    try {
      await bookingService.comment(t.dbId, visibility, text, { name: auth.profile?.full_name || auth.email || "User", role: auth.isStaff ? (visibility === "internal" ? "Service desk" : "Operations") : "Customer" });
      qc.invalidateQueries({ queryKey: ["booking-comments", userId] });
    } catch { toast.error("Message could not be sent."); }
  };
  const markNotificationsRead = async () => {
    if (!userId || !notifications.some((n) => !n.read)) return;
    try { await notificationService.markAllRead(userId); qc.invalidateQueries({ queryKey: ["notifications", userId] }); } catch { /* non-critical */ }
  };
  const dismissConfirmation = () => {
    setConfirmedTicket(null);
    setView("bookings");
  };
  const addNotification = (notification) => toast(notification.title, { description: notification.detail });
  return <AppShell canUseTeam={auth.isStaff} crumbs={["Home", titles[view]]} activeService={category} onServiceSelect={selectCategory} onBookingsSelect={() => setView("bookings")} role={role} onRoleChange={selectRole} projectSection={projectSection} onProjectSectionChange={setProjectSection} onCreateProjectTicket={createSampleTicket} notifications={notifications} onNotificationsOpen={markNotificationsRead} showServiceNav={view !== "bookings" && view !== "project"}>
    {view === "marketplace" && servicesResult.isError && <div role="alert" className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">Services could not be loaded. <button className="underline" onClick={() => servicesResult.refetch()}>Retry</button></div>}
    {view === "marketplace" && <Marketplace category={category} services={visibleServices} onDetails={setModal} onCategoryChange={selectCategory} />}
    {view === "login" && <EngineerLogin onBack={goHome} onVerified={() => setView("booking")} />}
    {view === "booking" && <BookingForm onBack={goHome} onSubmit={createTicket} />}
    {view === "payment" && <EngineerPayment booking={booking} onBack={() => setView("booking")} onConfirm={() => createTicket(booking)} />}
    {view === "tracking" && <EngineerTracking booking={booking} onComplete={() => setView("completion")} />}
    {view === "completion" && <EngineerCompletion booking={booking} onBack={goHome} />}
    {view === "bookings" && <MyBookings onBack={goHome} customerTickets={customerTickets} comments={commentsResult.data} onUpdateTicket={updateTicket} onComment={addComment} loading={ticketsResult.isLoading} mode="customer" onNotify={addNotification} />}
    {view === "project" && (projectSection === "dashboard" || projectSection === "tickets") && <MyBookings onBack={goHome} customerTickets={customerTickets} comments={commentsResult.data} onUpdateTicket={updateTicket} onComment={addComment} loading={ticketsResult.isLoading} mode="team" showDashboard={projectSection === "dashboard"} showTickets={projectSection === "tickets"} onNotify={addNotification} />}
    {view === "project" && (projectSection === "roles" || projectSection === "payment") && <ProjectSettings section={projectSection} onNotify={addNotification} />}
    {modal && <ServiceModal service={modal} onClose={() => setModal(null)} onBook={() => { setModal(null); if (!auth.userId) { toast("Sign in to book this service."); navigate({ to: "/auth", search: { redirect: "/" } }); return; } setView("booking"); }} />}
    {confirmedTicket && <OrderConfirmationModal ticket={confirmedTicket} onClose={dismissConfirmation} />}
  </AppShell>;
}