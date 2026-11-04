// @ts-nocheck
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { panel } from "@/components/common/ui";
import { Button } from "@/components/ui/button";
import { attachmentService } from "@/services/attachmentService";
import { allEngineersQuery } from "@/services/engineerService";
import type { CommentsByTicket, Ticket, TicketUpdate } from "@/services/bookingService";
import type { CancellationPolicy } from "@/services/cancellationPolicyService";
import { cancellationFeeApplies } from "@/services/cancellationPolicyService";
import { MyBookingDetails } from "./MyBookingDetails";
import { ProjectDashboard } from "./MyBookingsDashboard";
import { MyBookingsQueue } from "./MyBookingsQueue";
import { priorities, priorityRank, statuses } from "./myBookingsConstants";

export function MyBookings({
  onBack,
  currentUserId,
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
  commentsError,
  loading = false,
  targetTicketId,
}: {
  onBack: () => void;
  currentUserId?: string | null;
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
  onCancelTicket?: (ticketId: string, message: string) => Promise<string | null>;
  cancellationPolicy?: CancellationPolicy | null;
  cancellationPolicyLoading?: boolean;
  cancellationPolicyError?: string | null;
  onComment?: (ticketNo: string, visibility: "public" | "internal", text: string) => void;
  canAddAssignee?: boolean;
  canCloseTicket?: boolean;
  canEditTickets?: boolean;
  comments?: CommentsByTicket | undefined;
  commentsError?: string | null;
  loading?: boolean;
  targetTicketId?: string | undefined;
}) {
  const isTeam = mode === "team";
  const allTickets = customerTickets;
  const queryClient = useQueryClient();
  const [selectedRaw, setSelected] = useState(null);
  const selected = allTickets.find((ticket) => ticket.id === selectedRaw?.id) ?? allTickets[0];
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
    () => [
      { id: "All", label: "All customers" },
      ...[
        ...new Map(
          allTickets.map((ticket) => [
            ticket.customerId,
            { id: ticket.customerId, label: ticket.customer || "Unknown customer" },
          ]),
        ).values(),
      ].sort((first, second) => first.label.localeCompare(second.label)),
    ],
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
            (customerFilter === "All" || ticket.customerId === customerFilter) &&
            `${ticket.id} ${ticket.title} ${ticket.customer}`.toLowerCase().includes(query)
          );
        })
        .sort(
          (firstTicket, secondTicket) =>
            priorityRank[firstTicket.priority] - priorityRank[secondTicket.priority],
        ),
    [allTickets, customerFilter, priorityFilter, search, statusFilter],
  );

  if (!selected) {
    return (
      <div className="w-full">
        {commentsError && (
          <p
            role="alert"
            className="mb-3 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
          >
            Ticket messages could not be loaded: {commentsError}
          </p>
        )}
        {isTeam && showDashboard && <ProjectDashboard allTickets={allTickets} />}
        {showTickets && (
          <div className={`${panel} grid place-items-center py-16 text-center`}>
            {loading ? (
              <div className="w-full max-w-md space-y-3">
                {[0, 1, 2].map((item) => (
                  <div key={item} className="h-10 animate-pulse rounded-md bg-surface" />
                ))}
              </div>
            ) : (
              <div>
                <p className="text-sm font-semibold">No orders yet</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {isTeam
                    ? "No tickets are available for your account. Engineers see only tickets assigned to them; customers see only tickets they created."
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
  }

  const selectedTicket = { ...selected, ...ticketUpdates[selected.id] };
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
  const cancellationMessages = selectedMessages.public.filter((message) =>
    message.text.startsWith("Cancellation message:"),
  );

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
    ) {
      return false;
    }
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
    if ((isTeam && !canEditTickets) || !draft.trim()) return;
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
    <div className={isTeam && showTickets ? "flex h-full min-h-0 w-full flex-col" : "w-full"}>
      {isTeam && showDashboard && <ProjectDashboard allTickets={allTickets} />}
      {showTickets && (
        <div
          className={
            isTeam
              ? "grid min-h-0 flex-1 gap-3 lg:grid-cols-[275px_minmax(0,1fr)]"
              : "grid gap-3 lg:grid-cols-[275px_minmax(0,1fr)]"
          }
        >
          <MyBookingsQueue
            isTeam={isTeam}
            visibleTickets={visibleTickets}
            selectedTicketId={selected.id}
            readTicketIds={readTicketIds}
            counts={counts}
            priorityCounts={priorityCounts}
            customerOptions={customerOptions}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            customerFilter={customerFilter}
            setCustomerFilter={setCustomerFilter}
            priorityFilter={priorityFilter}
            setPriorityFilter={setPriorityFilter}
            search={search}
            setSearch={setSearch}
            onSelectTicket={selectTicket}
          />
          <div
            className={isTeam ? "min-h-0 min-w-0 space-y-4 overflow-y-auto" : "min-w-0 space-y-4"}
          >
            {commentsError && (
              <p
                role="alert"
                className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
              >
                Ticket messages could not be loaded: {commentsError}
              </p>
            )}
            <MyBookingDetails
              ticket={selectedTicket}
              isTeam={isTeam}
              currentUserId={currentUserId}
              onCancelTicket={onCancelTicket}
              cancellationPolicy={cancellationPolicy}
              cancellationPolicyLoading={cancellationPolicyLoading}
              cancellationPolicyError={cancellationPolicyError}
              cancelDialogOpen={cancelDialogOpen}
              setCancelDialogOpen={setCancelDialogOpen}
              cancelError={cancelError}
              setCancelError={setCancelError}
              cancellationMessage={cancellationMessage}
              setCancellationMessage={setCancellationMessage}
              isCancelling={isCancelling}
              setIsCancelling={setIsCancelling}
              isAssigned={isAssigned}
              currentStage={currentStage}
              ticketLocation={ticketLocation}
              visitDate={visitDate}
              visitTime={visitTime}
              cancellationMessages={cancellationMessages}
              canEditTickets={canEditTickets}
              canAddAssignee={canAddAssignee}
              canCloseTicket={canCloseTicket}
              selectedEngineerId={selectedEngineerId}
              setAssigneeEngineerId={setAssigneeEngineerId}
              assignableEngineers={assignableEngineers}
              engineersLoading={engineersQuery.isLoading}
              engineersError={engineersQuery.error?.message}
              assigneePhone={assigneePhone}
              updateTicket={updateTicket}
              recordCall={recordCall}
              onNotify={onNotify}
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              selectedMessages={selectedMessages}
              draft={draft}
              setDraft={setDraft}
              send={send}
              attachments={attachments}
              fileInputRef={fileInputRef}
              isUploadingAttachments={isUploadingAttachments}
              attachmentActionError={attachmentActionError}
              attachmentsLoading={attachmentsQuery.isLoading}
              attachmentsError={
                attachmentsQuery.error instanceof Error ? attachmentsQuery.error.message : undefined
              }
              downloadingAttachmentId={downloadingAttachmentId}
              onAddFiles={addFiles}
              onDownloadAttachment={downloadAttachment}
            />
          </div>
        </div>
      )}
    </div>
  );
}
