// @ts-nocheck
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Download,
  FileText,
  LockKeyhole,
  MapPin,
  MessageSquare,
  Paperclip,
  Phone,
  Plus,
  ReceiptText,
  Search,
  Send,
  UserRound,
  Users,
} from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { panel } from "@/components/common/ui";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { attachmentService } from "@/services/attachmentService";
import { allEngineersQuery } from "@/services/engineerService";
import { toast } from "sonner";
import { RateJob } from "./RateJob";
import type { CommentsByTicket, Ticket, TicketUpdate } from "@/services/bookingService";
import {
  cancellationFeeApplies,
  cancellationWindowDescription,
  type CancellationPolicy,
} from "@/services/cancellationPolicyService";

const statuses = [
  { label: "Open", icon: Clock3, style: "border-warning/20 bg-warning/10 text-warning" },
  { label: "In Progress", icon: Activity, style: "border-primary/20 bg-primary/10 text-primary" },
  { label: "Closed", icon: CheckCircle2, style: "border-success/20 bg-success/10 text-success" },
];
const orderStages = ["Pending", "Assigned", "In progress", "Completed"];
const priorities = ["Urgent", "High", "Medium", "Low"];
const priorityRank = { Urgent: 0, High: 1, Medium: 2, Low: 3 };

function getCancellationErrorMessage(error) {
  if (error && typeof error === "object" && "message" in error) {
    const message = error.message;
    if (typeof message === "string" && message.trim()) return message;
  }
  if (typeof error === "string" && error.trim()) return error;
  return "Please refresh My Orders and try again.";
}

const tabs = [
  { id: "public", label: "Public reply", icon: Users },
  { id: "attachments", label: "Attachments", icon: Paperclip },
  { id: "internal", label: "Internal note", icon: LockKeyhole },
];

function TicketTabs({ activeTab, setActiveTab, attachments, isTeam }) {
  return (
    <div className="flex gap-1 overflow-x-auto" role="tablist" aria-label="Ticket workspace">
      {tabs
        .filter((tab) => isTeam || tab.id !== "internal")
        .map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={activeTab === id}
            onClick={() => setActiveTab(id)}
            className={`flex h-8 shrink-0 items-center gap-1.5 rounded px-2 text-[10px] font-semibold ${activeTab === id ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-surface hover:text-foreground"}`}
          >
            <Icon className="h-3 w-3" />
            {label}
            {id === "attachments" && (
              <span className="rounded bg-surface px-1 text-[9px]">{attachments.length}</span>
            )}
          </button>
        ))}
    </div>
  );
}

function Conversation({
  channel,
  messages,
  draft,
  setDraft,
  onSend,
  onAttach,
  activeTab,
  setActiveTab,
  attachments,
  isTeam,
  canEdit = true,
}) {
  const internal = channel === "internal";
  return (
    <div className="p-4">
      <div className="h-[470px] space-y-3 overflow-y-auto rounded-md border border-border bg-surface/35 p-4">
        {messages.map((message, index) => (
          <div
            key={`${message.time}-${index}`}
            className={message.sender === "You" ? "text-right" : ""}
          >
            <p className="text-[10px] text-muted-foreground">
              {message.sender} · {message.role} · {message.time}
            </p>
            <p
              className={`mt-1 inline-block max-w-[85%] rounded-md px-3 py-2 text-left text-xs leading-5 ${message.sender === "You" ? "bg-primary text-primary-foreground" : "bg-surface"}`}
            >
              {message.text}
            </p>
          </div>
        ))}
      </div>
      <div className="mt-3 border-t border-border pt-2">
        <TicketTabs
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          attachments={attachments}
          isTeam={isTeam}
        />
        <div className="mt-2 flex gap-2">
          {canEdit ? (
            <>
              <Button size="icon" variant="outline" onClick={onAttach} aria-label="Attach file">
                <Paperclip />
              </Button>
              <input
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => event.key === "Enter" && onSend()}
                placeholder={internal ? "Add a private note" : "Reply to customer and engineer"}
                className="h-10 min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-xs outline-none focus:border-ring"
              />
              <Button size="icon" onClick={onSend} aria-label="Send message">
                <Send />
              </Button>
            </>
          ) : (
            <p className="py-2 text-xs text-muted-foreground">
              You have view-only access to this ticket.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function OrderMetric({ icon: Icon, label, value, valueClassName = "" }) {
  return (
    <div className="rounded-md border border-border bg-surface/50 p-3">
      <Icon className="h-4 w-4 text-primary" />
      <p className={`mt-2 text-xs font-semibold ${valueClassName}`}>{value}</p>
      <p className="mt-1 text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}

function DashboardMetric({ icon: Icon, label, value, detail, tone = "text-primary" }) {
  return (
    <section
      className={`${panel} p-4 transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-md`}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-[10px] font-semibold uppercase text-muted-foreground">{label}</p>
        <span className={`grid h-8 w-8 place-items-center rounded-md bg-surface ${tone}`}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className="mt-4 text-2xl font-semibold tracking-tight">{value}</p>
      <p className="mt-1 text-[11px] text-muted-foreground">{detail}</p>
    </section>
  );
}

function ProjectDashboard({ allTickets }) {
  const openTickets = allTickets.filter((ticket) => ticket.status === "Open").length;
  const activeTickets = allTickets.filter((ticket) => ticket.status === "In Progress").length;
  const completedTickets = allTickets.filter((ticket) => ticket.status === "Closed").length;
  const priorityData = priorities.map((priority) => ({
    priority,
    tickets: allTickets.filter((ticket) => ticket.priority === priority).length,
  }));
  const statusData = [...new Set(allTickets.map((ticket) => ticket.status))].map((status) => ({
    status,
    tickets: allTickets.filter((ticket) => ticket.status === status).length,
  }));
  return (
    <section className="mb-5 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="mb-4">
        <p className="text-[10px] font-bold uppercase text-primary">Operations overview</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Project dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Current ticket counts by status and priority.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <DashboardMetric
          icon={ReceiptText}
          label="Total tickets"
          value={allTickets.length}
          detail="Tickets currently loaded"
        />
        <DashboardMetric
          icon={Clock3}
          label="Open"
          value={openTickets}
          detail="Awaiting assignment"
          tone="text-warning"
        />
        <DashboardMetric
          icon={Activity}
          label="In progress"
          value={activeTickets}
          detail="Currently being handled"
        />
        <DashboardMetric
          icon={CheckCircle2}
          label="Closed"
          value={completedTickets}
          detail="Completed tickets"
          tone="text-success"
        />
      </div>
      <div className="mt-3 grid gap-3 xl:grid-cols-2">
        <section className={`${panel} p-4`}>
          <h2 className="text-sm font-semibold">Tickets by priority</h2>
          <div className="mt-4 h-44">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={priorityData} margin={{ top: 6, right: 2, left: -22, bottom: 0 }}>
                <CartesianGrid
                  vertical={false}
                  stroke="var(--color-border)"
                  strokeDasharray="3 3"
                />
                <XAxis
                  dataKey="priority"
                  tick={{ fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: 6,
                    borderColor: "var(--color-border)",
                    fontSize: 11,
                  }}
                />
                <Bar dataKey="tickets" radius={[4, 4, 0, 0]} fill="var(--color-primary)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
        <section className={`${panel} p-4`}>
          <h2 className="text-sm font-semibold">Tickets by status</h2>
          <div className="mt-4 h-44">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={statusData} margin={{ top: 6, right: 2, left: -22, bottom: 0 }}>
                <CartesianGrid
                  vertical={false}
                  stroke="var(--color-border)"
                  strokeDasharray="3 3"
                />
                <XAxis dataKey="status" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: 6,
                    borderColor: "var(--color-border)",
                    fontSize: 11,
                  }}
                />
                <Bar dataKey="tickets" radius={[4, 4, 0, 0]} fill="var(--color-primary)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>
    </section>
  );
}

export function MyBookings({
  onBack,
  customerTickets = [],
  mode = "customer",
  showDashboard = false,
  showTickets = true,
  onNotify,
  onUpdateTicket,
  onCancelTicket,
  cancellationPolicy,
  cancellationPolicyLoading = false,
  cancellationPolicyError,
  onComment,
  canEditTickets = true,
  canAddAssignee = false,
  canCloseTicket = false,
  comments,
  loading = false,
  targetTicketId,
}: {
  onBack: () => void;
  customerTickets?: Ticket[];
  mode?: "customer" | "team";
  showDashboard?: boolean;
  showTickets?: boolean;
  onNotify?: (notification: { title: string; detail: string }) => void;
  onUpdateTicket?: (
    ticketNo: string,
    update: TicketUpdate,
    action?: "edit" | "assignee" | "close",
  ) => Promise<boolean> | boolean | void;
  onCancelTicket?: (ticketId: string, message: string) => Promise<void>;
  cancellationPolicy?: CancellationPolicy | null;
  cancellationPolicyLoading?: boolean;
  cancellationPolicyError?: string | null;
  onComment?: (ticketNo: string, visibility: "public" | "internal", text: string) => void;
  canAddAssignee?: boolean;
  canCloseTicket?: boolean;
  canEditTickets?: boolean;
  comments?: CommentsByTicket | undefined;
  loading?: boolean;
  targetTicketId?: string | undefined;
}) {
  const isTeam = mode === "team";
  const allTickets = customerTickets;
  const queryClient = useQueryClient();
  const [selectedRaw, setSelected] = useState(null);
  const selected = allTickets.find((t) => t.id === selectedRaw?.id) ?? allTickets[0];
  const selectedBookingId = selected?.dbId ?? null;
  const attachmentsQuery = useQuery({
    queryKey: ["booking-attachments", selectedBookingId],
    enabled: Boolean(selectedBookingId),
    queryFn: () =>
      selectedBookingId ? attachmentService.list(selectedBookingId) : Promise.resolve([]),
  });
  const engineersQuery = useQuery({
    ...allEngineersQuery,
    enabled: isTeam && canAddAssignee,
  });
  const assignableEngineers = useMemo(
    () =>
      (engineersQuery.data ?? []).filter(
        (engineer) => engineer.approval_status === "approved" && engineer.status === "active",
      ),
    [engineersQuery.data],
  );
  const attachments = attachmentsQuery.data ?? [];
  const [readTicketIds, setReadTicketIds] = useState([]);
  const [ticketUpdates, setTicketUpdates] = useState({});
  const [statusFilter, setStatusFilter] = useState("All");
  const [priorityFilter, setPriorityFilter] = useState("All");
  const [customerFilter, setCustomerFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("public");
  const [assigneeEngineerId, setAssigneeEngineerId] = useState(undefined);
  const [draft, setDraft] = useState("");
  const [isUploadingAttachments, setIsUploadingAttachments] = useState(false);
  const [downloadingAttachmentId, setDownloadingAttachmentId] = useState(null);
  const [attachmentActionError, setAttachmentActionError] = useState("");
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelError, setCancelError] = useState("");
  const [cancellationMessage, setCancellationMessage] = useState("");
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!targetTicketId) return;
    const targetTicket = allTickets.find(
      (ticket) => ticket.dbId === targetTicketId || ticket.id === targetTicketId,
    );
    if (!targetTicket) return;
    setSelected(targetTicket);
    setStatusFilter("All");
    setPriorityFilter("All");
    setCustomerFilter("All");
    setSearch("");
  }, [allTickets, targetTicketId]);

  const counts = useMemo(
    () =>
      Object.fromEntries(
        statuses.map(({ label }) => [
          label,
          allTickets.filter((ticket) => ticket.status === label).length,
        ]),
      ),
    [allTickets],
  );
  const priorityCounts = useMemo(
    () =>
      Object.fromEntries(
        priorities.map((priority) => [
          priority,
          allTickets.filter((ticket) => ticket.priority === priority).length,
        ]),
      ),
    [allTickets],
  );
  const customerOptions = useMemo(
    () => ["All", ...new Set(allTickets.map((ticket) => ticket.customer))],
    [allTickets],
  );
  const visibleTickets = useMemo(
    () =>
      allTickets
        .filter((ticket) => {
          const query = search.toLowerCase();
          return (
            (statusFilter === "All" || ticket.status === statusFilter) &&
            (priorityFilter === "All" || ticket.priority === priorityFilter) &&
            (customerFilter === "All" || ticket.customer === customerFilter) &&
            `${ticket.id} ${ticket.title} ${ticket.customer}`.toLowerCase().includes(query)
          );
        })
        .sort(
          (firstTicket, secondTicket) =>
            priorityRank[firstTicket.priority] - priorityRank[secondTicket.priority],
        ),
    [allTickets, customerFilter, priorityFilter, search, statusFilter],
  );

  if (!selected)
    return (
      <div className="w-full">
        {isTeam && showDashboard && <ProjectDashboard allTickets={allTickets} />}
        {showTickets && (
          <div className={`${panel} grid place-items-center py-16 text-center`}>
            {loading ? (
              <div className="w-full max-w-md space-y-3">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-10 animate-pulse rounded-md bg-surface" />
                ))}
              </div>
            ) : (
              <div>
                <p className="text-sm font-semibold">No orders yet</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {isTeam
                    ? "Tickets created by customers will appear here."
                    : "Book a service from the marketplace to see it here."}
                </p>
                <Button className="mt-4" variant="outline" onClick={onBack}>
                  Browse services
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  const selectedTicket = { ...selected, ...ticketUpdates[selected.id] };
  const cancellationFeeDue = Boolean(
    cancellationPolicy &&
    cancellationFeeApplies(cancellationPolicy, {
      createdAt: selectedTicket.createdAt,
      visitDate: selectedTicket.visitDate,
      visitTime: selectedTicket.visitTime,
    }),
  );
  const selectedEngineerId =
    assigneeEngineerId !== undefined
      ? assigneeEngineerId
      : (selectedTicket.engineerId ??
        assignableEngineers.find((engineer) => engineer.full_name === selectedTicket.engineer)
          ?.id ??
        "");
  const selectedEngineer = assignableEngineers.find(
    (engineer) => engineer.id === selectedEngineerId,
  );
  const assigneePhone =
    selectedEngineer?.phone ?? (selectedEngineerId ? selectedTicket.assigneePhone : "");
  const ticketLocation = selectedTicket.city || selectedTicket.siteLocation || "";
  const isAssigned = Boolean(selectedTicket.engineer && selectedTicket.engineer !== "Unassigned");
  const currentStage =
    selectedTicket.status === "Closed"
      ? 3
      : selectedTicket.status === "In Progress"
        ? 2
        : isAssigned
          ? 1
          : 0;
  const visitDate =
    selectedTicket.priority === "Urgent"
      ? "Immediate"
      : selectedTicket.visitDate
        ? new Date(`${selectedTicket.visitDate}T00:00:00`).toLocaleDateString("en-IN", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })
        : "Not scheduled";
  const visitTime =
    selectedTicket.priority === "Urgent"
      ? "On dispatch"
      : selectedTicket.visitTime
        ? new Date(`1970-01-01T${selectedTicket.visitTime}:00`).toLocaleTimeString("en-IN", {
            hour: "numeric",
            minute: "2-digit",
          })
        : "Not scheduled";
  const selectedMessages = comments?.[selected.id] ?? { public: [], internal: [] };
  const unreadComments =
    selected.unreadComments && !readTicketIds.includes(selected.id) ? selected.unreadComments : 0;
  const selectTicket = (ticket) => {
    setSelected(ticket);
    setAttachmentActionError("");
    setAssigneeEngineerId(undefined);
    setReadTicketIds((current) =>
      current.includes(ticket.id) ? current : [...current, ticket.id],
    );
  };
  const updateTicket = async (update, action = "edit") => {
    if (
      isTeam &&
      ((action === "edit" && !canEditTickets) ||
        (action === "assignee" && !canAddAssignee) ||
        (action === "close" && !canCloseTicket))
    )
      return false;
    setTicketUpdates((current) => ({
      ...current,
      [selected.id]: { ...current[selected.id], ...update },
    }));
    const saved = await onUpdateTicket?.(selected.id, update, action);
    return saved !== false;
  };
  const recordCall = () => {
    updateTicket({ lastContact: "Customer contact attempt recorded" });
    onComment?.(selected.id, "public", "Customer contact attempt recorded.");
    onNotify?.({ title: "Ticket updated", detail: `${selected.id} · Customer call recorded` });
  };
  const send = () => {
    if (isTeam && !canEditTickets) return;
    if (!draft.trim()) return;
    onComment?.(selected.id, isTeam ? activeTab : "public", draft.trim());
    onNotify?.({
      title: activeTab === "internal" ? "Internal note added" : "New public reply",
      detail: `${selected.id} · ${draft.trim()}`,
    });
    setDraft("");
  };
  const addFiles = async (event) => {
    if (isTeam && !canEditTickets) return;
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!files.length) return;
    if (!selectedTicket.dbId) {
      const message = "Attachments can only be uploaded to a saved booking ticket.";
      setAttachmentActionError(message);
      toast.error(message);
      return;
    }

    const bookingId = selectedTicket.dbId;
    setIsUploadingAttachments(true);
    setAttachmentActionError("");
    try {
      const results = await Promise.allSettled(
        files.map((file) => attachmentService.upload(bookingId, file)),
      );
      await queryClient.invalidateQueries({ queryKey: ["booking-attachments", bookingId] });
      const failures = results.filter((result) => result.status === "rejected");
      if (failures.length) {
        const details = failures
          .map((result) =>
            result.reason instanceof Error ? result.reason.message : String(result.reason),
          )
          .join(" ");
        const message = `${failures.length} of ${files.length} file(s) could not be uploaded. ${details}`;
        setAttachmentActionError(message);
        toast.error(message);
      } else {
        toast.success(files.length === 1 ? "Attachment uploaded." : "Attachments uploaded.");
      }
    } finally {
      setIsUploadingAttachments(false);
    }
  };
  const downloadAttachment = async (file) => {
    setDownloadingAttachmentId(file.id);
    setAttachmentActionError("");
    try {
      const blob = await attachmentService.download(file);
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = file.file_name;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not download this attachment.";
      setAttachmentActionError(message);
      toast.error(message);
    } finally {
      setDownloadingAttachmentId(null);
    }
  };

  return (
    <div className="w-full">
      {isTeam && showDashboard && <ProjectDashboard allTickets={allTickets} />}
      {showTickets && (
        <div className="grid gap-3 lg:grid-cols-[275px_minmax(0,1fr)]">
          <aside
            className={`${panel} h-fit max-h-[720px] overflow-hidden p-0 lg:sticky lg:top-20 lg:flex lg:h-[calc(100vh-6rem)] lg:max-h-none lg:flex-col`}
          >
            <div className="border-b border-border p-4">
              <div>
                <p className="text-sm font-semibold">{isTeam ? "Project queue" : "My orders"}</p>
                <p className="mt-0.5 text-[10px] text-muted-foreground">
                  {visibleTickets.length} visible {isTeam ? "tickets" : "orders"}
                </p>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-1">
                {statuses.map(({ label, style }) => {
                  const active = statusFilter === label;
                  return (
                    <button
                      key={label}
                      type="button"
                      onClick={() => setStatusFilter(active ? "All" : label)}
                      className={`rounded-md border px-1 py-2 text-center text-[9px] font-semibold transition-colors ${style} ${active ? "ring-1 ring-current" : "hover:bg-surface"}`}
                    >
                      <span className="block text-sm text-foreground">{counts[label]}</span>
                      {label === "In Progress" ? "Pending" : label}
                    </button>
                  );
                })}
              </div>
              {isTeam && (
                <div className="mt-3 border-t border-border pt-3">
                  <p className="mb-2 text-[9px] font-semibold uppercase text-muted-foreground">
                    Customer
                  </p>
                  <select
                    value={customerFilter}
                    onChange={(event) => setCustomerFilter(event.target.value)}
                    className="mb-3 h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
                  >
                    {customerOptions.map((customer) => (
                      <option key={customer}>{customer}</option>
                    ))}
                  </select>
                  <p className="mb-2 text-[9px] font-semibold uppercase text-muted-foreground">
                    Priority
                  </p>
                  <div className="grid grid-cols-2 gap-1">
                    {priorities.map((priority) => {
                      const active = priorityFilter === priority;
                      const style =
                        priority === "Urgent"
                          ? "border-destructive/30 bg-destructive/10 text-destructive"
                          : priority === "High"
                            ? "border-warning/30 bg-warning/10 text-warning"
                            : priority === "Medium"
                              ? "border-primary/30 bg-primary/10 text-primary"
                              : "border-success/30 bg-success/10 text-success";
                      return (
                        <button
                          key={priority}
                          type="button"
                          onClick={() => setPriorityFilter(active ? "All" : priority)}
                          className={`rounded-md border px-2 py-1.5 text-left text-[10px] font-semibold ${style} ${active ? "ring-1 ring-current" : "hover:bg-surface"}`}
                        >
                          <span>{priority}</span>
                          <span className="float-right">{priorityCounts[priority]}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              <div className="relative mt-3">
                <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search order ID or site"
                  className="h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 text-xs outline-none focus:border-ring"
                />
              </div>
            </div>
            <div className="max-h-[650px] overflow-y-auto lg:min-h-0 lg:flex-1 lg:max-h-none">
              {visibleTickets.map((ticket) => {
                const ticketUnreadComments =
                  ticket.unreadComments && !readTicketIds.includes(ticket.id)
                    ? ticket.unreadComments
                    : 0;
                const priorityStyle =
                  ticket.priority === "Urgent"
                    ? "bg-destructive/10 text-destructive"
                    : ticket.priority === "High"
                      ? "bg-warning/15 text-warning"
                      : ticket.priority === "Medium"
                        ? "bg-primary/15 text-primary"
                        : "bg-success/15 text-success";
                return (
                  <button
                    key={ticket.id}
                    type="button"
                    onClick={() => selectTicket(ticket)}
                    className={`w-full border-b border-border p-4 text-left transition-colors ${selected.id === ticket.id ? "bg-primary/10 shadow-[inset_3px_0_0_var(--color-primary)]" : "hover:bg-surface"}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[11px] font-semibold text-primary">{ticket.id}</p>
                      <span
                        className={`rounded px-1.5 py-0.5 text-[9px] font-semibold ${ticket.status === "Closed" ? "bg-success/15 text-success" : ticket.status === "Open" ? "bg-warning/15 text-warning" : "bg-primary/15 text-primary"}`}
                      >
                        {ticket.status}
                      </span>
                    </div>
                    <p className="mt-2 text-xs font-semibold leading-5">{ticket.title}</p>
                    <div className="mt-3 flex items-center justify-between text-[10px] text-muted-foreground">
                      <span className={`rounded px-1.5 py-0.5 font-semibold ${priorityStyle}`}>
                        {ticket.priority}
                      </span>
                      <span className="flex items-center gap-1">
                        {ticketUnreadComments > 0 && (
                          <span className="inline-flex items-center gap-1 rounded bg-primary px-1.5 py-0.5 font-semibold text-primary-foreground">
                            <MessageSquare className="h-2.5 w-2.5" />
                            {ticketUnreadComments}
                          </span>
                        )}
                        {ticket.updated}
                      </span>
                    </div>
                  </button>
                );
              })}
              {!visibleTickets.length && (
                <p className="p-8 text-center text-xs text-muted-foreground">
                  No tickets match this view.
                </p>
              )}
            </div>
          </aside>

          <div className="min-w-0 space-y-4">
            <section className={`${panel} overflow-hidden p-0`}>
              <header className="border-b border-border p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-[10px] font-bold uppercase text-primary">
                    {selectedTicket.id}
                  </p>
                  <span className="rounded bg-warning/15 px-2 py-0.5 text-[10px] font-semibold text-warning">
                    {selectedTicket.priority}
                  </span>
                </div>
                <h2 className="mt-1 text-sm font-semibold">{selectedTicket.title}</h2>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {[
                    selectedTicket.customer,
                    ticketLocation,
                    `Engineer: ${selectedTicket.engineer || "Unassigned"}`,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </header>
              {!isTeam &&
                (selectedTicket.status === "Open" || selectedTicket.status === "In Progress") &&
                selectedTicket.dbId &&
                onCancelTicket && (
                  <div className="flex justify-end border-b border-border p-3">
                    <AlertDialog
                      open={cancelDialogOpen}
                      onOpenChange={(open) => {
                        setCancelDialogOpen(open);
                        if (open) {
                          setCancelError("");
                          setCancellationMessage("");
                        }
                      }}
                    >
                      <AlertDialogTrigger asChild>
                        <Button size="sm" variant="outline" disabled={isCancelling}>
                          Cancel booking
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Cancel this booking?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This booking can be cancelled while it is open, including after an
                            engineer has been assigned.
                            {cancellationPolicyLoading ? (
                              <span className="mt-2 block">
                                Loading your cancellation terms. You can still cancel; no payment is
                                collected here.
                              </span>
                            ) : cancellationPolicyError ? (
                              <span className="mt-2 block text-destructive">
                                Cancellation terms could not be loaded: {cancellationPolicyError}{" "}
                                You can still cancel; no payment is collected here.
                              </span>
                            ) : cancellationPolicy ? (
                              <span className="mt-2 block">
                                {cancellationFeeDue
                                  ? `A cancellation fee of ₹${Math.round(cancellationPolicy.fee).toLocaleString("en-IN")} applies.`
                                  : `No cancellation fee applies now. The fee of ₹${Math.round(cancellationPolicy.fee).toLocaleString("en-IN")} applies ${cancellationWindowDescription(cancellationPolicy)}.`}{" "}
                                This cancellation does not collect or record a payment.
                              </span>
                            ) : null}
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <div className="space-y-2">
                          <label htmlFor="cancellation-message" className="text-sm font-medium">
                            Message to the service team (optional)
                          </label>
                          <Textarea
                            id="cancellation-message"
                            value={cancellationMessage}
                            onChange={(event) => setCancellationMessage(event.target.value)}
                            maxLength={2000}
                            placeholder="Tell us why you are cancelling, or leave this blank."
                            disabled={isCancelling}
                          />
                          <p className="text-right text-xs text-muted-foreground">
                            {cancellationMessage.length}/2000
                          </p>
                        </div>
                        {cancelError && (
                          <p role="alert" className="text-sm text-destructive">
                            Cancellation failed: {cancelError}
                          </p>
                        )}
                        <AlertDialogFooter>
                          <AlertDialogCancel>Keep booking</AlertDialogCancel>
                          <Button
                            type="button"
                            disabled={isCancelling}
                            onClick={async () => {
                              setIsCancelling(true);
                              setCancelError("");
                              try {
                                await onCancelTicket(selectedTicket.id, cancellationMessage.trim());
                                toast.success("Booking cancelled.");
                                setCancelDialogOpen(false);
                              } catch (error) {
                                const message = getCancellationErrorMessage(error);
                                setCancelError(message);
                                toast.error(`Booking could not be cancelled: ${message}`);
                              } finally {
                                setIsCancelling(false);
                              }
                            }}
                          >
                            {isCancelling ? "Cancelling…" : "Cancel booking"}
                          </Button>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                )}
              <div className="border-b border-border px-4 py-3">
                <p className="text-[9px] font-semibold uppercase text-muted-foreground">
                  Order status
                </p>
                <div className="mt-3 grid grid-cols-4 gap-1 sm:gap-3">
                  {orderStages.map((stage, index) => (
                    <div key={stage} className="min-w-0 text-center">
                      <span
                        className={`mx-auto grid h-7 w-7 place-items-center rounded-full border text-[10px] font-semibold ${index <= currentStage ? "border-success bg-success text-success-foreground" : "border-border bg-surface text-muted-foreground"}`}
                      >
                        {index < currentStage ? (
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        ) : (
                          index + 1
                        )}
                      </span>
                      <p
                        className={`mt-1.5 truncate text-[9px] font-medium ${index === currentStage ? "text-foreground" : "text-muted-foreground"}`}
                      >
                        {stage}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="grid border-b border-border sm:grid-cols-3">
                {[
                  ["Status", selectedTicket.status],
                  ["Assigned to", selectedTicket.engineer || "Unassigned"],
                  ["Progress", `${selectedTicket.progress}%`],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="border-b border-border p-2.5 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0"
                  >
                    <p className="text-[9px] uppercase text-muted-foreground">{label}</p>
                    <p className="mt-1 truncate text-[11px] font-semibold">{value}</p>
                    {label === "Progress" && (
                      <div className="mt-2 h-1 overflow-hidden rounded-full bg-surface">
                        <div
                          className="h-full bg-primary"
                          style={{ width: `${selectedTicket.progress}%` }}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div className="grid gap-3 border-b border-border p-4 xl:grid-cols-2">
                <div
                  className={`self-start rounded-md border p-4 ${isAssigned ? "border-success/30 bg-success/5" : "border-warning/30 bg-warning/5"}`}
                >
                  <div className="flex gap-3">
                    <span
                      className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${isAssigned ? "bg-success/15 text-success" : "bg-warning/15 text-warning"}`}
                    >
                      {isAssigned ? (
                        <CheckCircle2 className="h-5 w-5" />
                      ) : (
                        <UserRound className="h-5 w-5" />
                      )}
                    </span>
                    <div>
                      <p
                        className={`text-sm font-semibold ${isAssigned ? "text-success" : "text-warning"}`}
                      >
                        {isAssigned ? "Engineer assigned" : "Assignment pending"}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">
                        {isAssigned
                          ? `${selectedTicket.engineer} is assigned. Service updates will appear on this order.`
                          : "The project team has not assigned an engineer yet."}
                      </p>
                    </div>
                  </div>
                </div>
                <div>
                  <p className="mb-2 text-[10px] font-semibold uppercase text-muted-foreground">
                    Visit information
                  </p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    <OrderMetric icon={CalendarDays} label="Visit date" value={visitDate} />
                    <OrderMetric icon={Clock3} label="Visit time" value={visitTime} />
                    <OrderMetric
                      icon={MapPin}
                      label="Location"
                      value={ticketLocation || "Not provided"}
                      valueClassName="break-words"
                    />
                  </div>
                </div>
              </div>
              {selectedTicket.dbId && (
                <div className="flex justify-end border-b border-border px-4 py-2">
                  <Link
                    to="/invoice/$id"
                    params={{ id: selectedTicket.dbId }}
                    className="text-xs font-semibold text-primary hover:underline"
                  >
                    View invoice &amp; payments
                  </Link>
                </div>
              )}
              {!isTeam && selectedTicket.status === "Closed" && selectedTicket.dbId && (
                <RateJob dbId={selectedTicket.dbId} rated={selectedTicket.rating} />
              )}
              {isTeam && canAddAssignee && (
                <div className="grid gap-3 border-b border-border p-4 md:grid-cols-[1fr_1fr_auto]">
                  <label>
                    <span className="mb-1 block text-[10px] font-semibold uppercase text-muted-foreground">
                      Engineer
                    </span>
                    <select
                      value={selectedEngineerId}
                      onChange={(event) => setAssigneeEngineerId(event.target.value)}
                      disabled={engineersQuery.isLoading || Boolean(engineersQuery.error)}
                      className="h-9 w-full rounded-md border border-input bg-background px-3 text-xs outline-none focus:border-ring"
                    >
                      <option value="">Unassigned</option>
                      {assignableEngineers.map((engineer) => (
                        <option key={engineer.id} value={engineer.id}>
                          {engineer.full_name}
                        </option>
                      ))}
                    </select>
                    {engineersQuery.error && (
                      <span role="alert" className="mt-1 block text-[11px] text-destructive">
                        Could not load engineers: {engineersQuery.error.message}
                      </span>
                    )}
                    {!engineersQuery.error &&
                      !engineersQuery.isLoading &&
                      !assignableEngineers.length && (
                        <span className="mt-1 block text-[11px] text-muted-foreground">
                          No approved engineers are available.
                        </span>
                      )}
                  </label>
                  <label>
                    <span className="mb-1 block text-[10px] font-semibold uppercase text-muted-foreground">
                      Phone number
                    </span>
                    <input
                      value={assigneePhone ?? ""}
                      readOnly
                      placeholder="Selected engineer phone"
                      className="h-9 w-full rounded-md border border-input bg-surface px-3 text-xs text-muted-foreground"
                    />
                  </label>
                  <Button
                    className="self-end"
                    size="sm"
                    disabled={engineersQuery.isLoading || Boolean(engineersQuery.error)}
                    onClick={async () => {
                      const engineer = assignableEngineers.find(
                        (candidate) => candidate.id === selectedEngineerId,
                      );
                      const saved = await updateTicket(
                        {
                          engineerId: selectedEngineerId || null,
                          engineer: engineer?.full_name ?? "Unassigned",
                          assigneePhone: engineer?.phone ?? "",
                          status: engineer ? "In Progress" : selectedTicket.status,
                          progress: engineer
                            ? Math.max(selectedTicket.progress, 45)
                            : selectedTicket.progress,
                        },
                        "assignee",
                      );
                      if (saved) {
                        onNotify?.({
                          title: "Assignee updated",
                          detail: `${selected.id} · ${engineer?.full_name ?? "Unassigned"}`,
                        });
                      }
                    }}
                  >
                    <Users />
                    Save assignee
                  </Button>
                </div>
              )}
              {isAssigned && selectedTicket.assigneePhone && (
                <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3">
                  <span className="grid h-10 w-10 place-items-center rounded-full bg-primary/10 text-primary">
                    <UserRound className="h-5 w-5" />
                  </span>
                  <div className="min-w-[150px] flex-1">
                    <p className="text-xs font-semibold">{selectedTicket.engineer}</p>
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      {selectedTicket.assigneePhone}
                    </p>
                  </div>
                  <Button asChild size="sm" variant="outline">
                    <a href={`tel:${selectedTicket.assigneePhone}`}>
                      <Phone />
                      Contact engineer
                    </a>
                  </Button>
                </div>
              )}
              {isTeam && (canEditTickets || canAddAssignee || canCloseTicket) && (
                <div className="flex flex-wrap gap-2 border-b border-border p-3">
                  {canEditTickets && (
                    <Button size="sm" variant="outline" onClick={recordCall}>
                      <Phone />
                      Record customer call
                    </Button>
                  )}
                  {canCloseTicket && selectedTicket.status !== "Closed" && (
                    <Button
                      size="sm"
                      onClick={async () => {
                        const saved = await updateTicket(
                          { status: "Closed", progress: 100 },
                          "close",
                        );
                        if (saved)
                          onNotify?.({
                            title: "Ticket closed",
                            detail: `${selected.id} · Completed`,
                          });
                      }}
                    >
                      <CheckCircle2 />
                      Close ticket
                    </Button>
                  )}
                </div>
              )}
              {(activeTab === "public" || (isTeam && activeTab === "internal")) && (
                <Conversation
                  channel={activeTab}
                  messages={selectedMessages[activeTab]}
                  draft={draft}
                  setDraft={setDraft}
                  onSend={send}
                  onAttach={() => fileInputRef.current?.click()}
                  activeTab={activeTab}
                  setActiveTab={setActiveTab}
                  attachments={attachments}
                  isTeam={isTeam}
                  canEdit={!isTeam || canEditTickets}
                />
              )}

              {activeTab === "attachments" && (
                <div className="flex min-h-[554px] flex-col p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold">Ticket attachments</h3>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Photos, work orders, reports, and customer documents.
                      </p>
                    </div>
                    <Button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={!selectedTicket.dbId || isUploadingAttachments}
                    >
                      <Paperclip />
                      {isUploadingAttachments ? "Uploading..." : "Upload files"}
                    </Button>
                  </div>
                  {(attachmentActionError ||
                    (attachmentsQuery.error instanceof Error
                      ? attachmentsQuery.error.message
                      : "")) && (
                    <p
                      role="alert"
                      className="mt-3 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive"
                    >
                      {attachmentActionError || attachmentsQuery.error.message}
                    </p>
                  )}
                  {isUploadingAttachments && (
                    <p className="mt-3 text-xs text-muted-foreground" role="status">
                      Saving attachments...
                    </p>
                  )}
                  <div className="mt-5 divide-y divide-border rounded-md border border-border">
                    {attachmentsQuery.isLoading ? (
                      <p className="p-6 text-center text-xs text-muted-foreground" role="status">
                        Loading attachments...
                      </p>
                    ) : attachments.length ? (
                      attachments.map((file) => (
                        <div key={file.id} className="flex items-center gap-3 p-4">
                          <div className="grid h-10 w-10 place-items-center rounded-md bg-primary/10 text-primary">
                            <FileText className="h-4 w-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-semibold">{file.file_name}</p>
                            <p className="mt-1 text-[10px] text-muted-foreground">
                              {file.content_type || "File"} ·{" "}
                              {Math.max((file.file_size ?? 0) / 1024, 1).toFixed(0)} KB ·{" "}
                              {new Date(file.uploaded_at).toLocaleString()}
                            </p>
                          </div>
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label={`Download ${file.file_name}`}
                            onClick={() => downloadAttachment(file)}
                            disabled={downloadingAttachmentId === file.id}
                          >
                            <Download />
                          </Button>
                        </div>
                      ))
                    ) : (
                      <p className="p-6 text-center text-xs text-muted-foreground">
                        {selectedTicket.dbId
                          ? "No attachments have been uploaded for this ticket."
                          : "Attachments are available for saved booking tickets."}
                      </p>
                    )}
                  </div>
                  <div className="mt-auto border-t border-border pt-2">
                    <TicketTabs
                      activeTab={activeTab}
                      setActiveTab={setActiveTab}
                      attachments={attachments}
                      isTeam={isTeam}
                    />
                  </div>
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={addFiles}
                disabled={isUploadingAttachments}
              />
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
