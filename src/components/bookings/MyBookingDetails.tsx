import { Link } from "@tanstack/react-router";
import type { ChangeEvent, Dispatch, RefObject, SetStateAction } from "react";
import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  Download,
  FileText,
  MapPin,
  Paperclip,
  Phone,
  ReceiptText,
  UserRound,
  Users,
} from "lucide-react";

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
import type { BookingAttachment } from "@/services/attachmentService";
import type { Comment, Ticket, TicketUpdate } from "@/services/bookingService";
import {
  cancellationFeeApplies,
  cancellationWindowDescription,
  type CancellationPolicy,
} from "@/services/cancellationPolicyService";
import { toast } from "sonner";
import { RateJob } from "./RateJob";
import { orderStages, getCancellationErrorMessage } from "./myBookingsConstants";
import { Conversation, OrderMetric, TicketTabs } from "./MyBookingsWidgets";

type BookingTab = "public" | "attachments" | "internal";
type UpdateAction = "edit" | "assignee" | "close";
type Engineer = { id: string; full_name: string; phone: string | null };

type MyBookingDetailsProps = {
  ticket: Ticket;
  isTeam: boolean;
  currentUserId?: string | null;
  onCancelTicket?: (ticketId: string, message: string) => Promise<string | null>;
  cancellationPolicy?: CancellationPolicy | null;
  cancellationPolicyLoading: boolean;
  cancellationPolicyError?: string | null;
  cancelDialogOpen: boolean;
  setCancelDialogOpen: Dispatch<SetStateAction<boolean>>;
  cancelError: string;
  setCancelError: Dispatch<SetStateAction<string>>;
  cancellationMessage: string;
  setCancellationMessage: Dispatch<SetStateAction<string>>;
  isCancelling: boolean;
  setIsCancelling: Dispatch<SetStateAction<boolean>>;
  isAssigned: boolean;
  currentStage: number;
  ticketLocation: string;
  visitDate: string;
  visitTime: string;
  cancellationMessages: Comment[];
  canEditTickets: boolean;
  canAddAssignee: boolean;
  canCloseTicket: boolean;
  selectedEngineerId: string;
  setAssigneeEngineerId: Dispatch<SetStateAction<string | undefined>>;
  assignableEngineers: Engineer[];
  engineersLoading: boolean;
  engineersError?: string;
  assigneePhone?: string | null;
  updateTicket: (update: TicketUpdate, action?: UpdateAction) => Promise<boolean>;
  recordCall: () => void;
  onNotify?: (notification: { title: string; detail: string }) => void;
  activeTab: BookingTab;
  setActiveTab: Dispatch<SetStateAction<BookingTab>>;
  selectedMessages: { public: Comment[]; internal: Comment[] };
  draft: string;
  setDraft: Dispatch<SetStateAction<string>>;
  send: () => void;
  attachments: BookingAttachment[];
  fileInputRef: RefObject<HTMLInputElement | null>;
  isUploadingAttachments: boolean;
  attachmentActionError: string;
  attachmentsLoading: boolean;
  attachmentsError?: string;
  downloadingAttachmentId: string | null;
  onAddFiles: (event: ChangeEvent<HTMLInputElement>) => void;
  onDownloadAttachment: (file: BookingAttachment) => void;
};

export function MyBookingDetails({
  ticket,
  isTeam,
  currentUserId,
  onCancelTicket,
  cancellationPolicy,
  cancellationPolicyLoading,
  cancellationPolicyError,
  cancelDialogOpen,
  setCancelDialogOpen,
  cancelError,
  setCancelError,
  cancellationMessage,
  setCancellationMessage,
  isCancelling,
  setIsCancelling,
  isAssigned,
  currentStage,
  ticketLocation,
  visitDate,
  visitTime,
  cancellationMessages,
  canEditTickets,
  canAddAssignee,
  canCloseTicket,
  selectedEngineerId,
  setAssigneeEngineerId,
  assignableEngineers,
  engineersLoading,
  engineersError,
  assigneePhone,
  updateTicket,
  recordCall,
  onNotify,
  activeTab,
  setActiveTab,
  selectedMessages,
  draft,
  setDraft,
  send,
  attachments,
  fileInputRef,
  isUploadingAttachments,
  attachmentActionError,
  attachmentsLoading,
  attachmentsError,
  downloadingAttachmentId,
  onAddFiles,
  onDownloadAttachment,
}: MyBookingDetailsProps) {
  const cancellationFeeDue = Boolean(
    cancellationPolicy &&
      cancellationFeeApplies(cancellationPolicy, {
        ...(ticket.createdAt ? { createdAt: ticket.createdAt } : {}),
        ...(ticket.visitDate ? { visitDate: ticket.visitDate } : {}),
        ...(ticket.visitTime ? { visitTime: ticket.visitTime } : {}),
      }),
  );

  return (
    <section className="min-w-0 overflow-hidden rounded-md border border-border bg-card">
      <header className="border-b border-border p-3">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-[10px] font-bold uppercase text-primary">{ticket.id}</p>
          <span className="rounded bg-warning/15 px-2 py-0.5 text-[10px] font-semibold text-warning">
            {ticket.priority}
          </span>
        </div>
        <h2 className="mt-1 text-sm font-semibold">{ticket.title}</h2>
        <p className="mt-1 text-[11px] text-muted-foreground">
          {[ticket.customer, ticketLocation, `Engineer: ${ticket.engineer || "Unassigned"}`]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </header>
      {!isTeam &&
        (ticket.status === "Open" || ticket.status === "In Progress") &&
        onCancelTicket && (
          <div className="flex justify-end border-b border-border p-3">
            {ticket.customerId !== currentUserId ? (
              <p className="text-xs text-muted-foreground">
                Only the booking owner can cancel this booking.
              </p>
            ) : ticket.dbId ? (
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
                      This booking can be cancelled while it is open, including after an engineer
                      has been assigned.
                      {cancellationPolicyLoading ? (
                        <span className="mt-2 block">
                          Loading your cancellation terms. You can still cancel; no payment is
                          collected here.
                        </span>
                      ) : cancellationPolicyError ? (
                        <span className="mt-2 block text-destructive">
                          Cancellation terms could not be loaded: {cancellationPolicyError} You can
                          still cancel; no payment is collected here.
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
                          const messageError = await onCancelTicket(
                            ticket.id,
                            cancellationMessage.trim(),
                          );
                          toast.success("Booking cancelled.");
                          if (messageError) {
                            toast.error(
                              `Booking cancelled, but the message could not be saved: ${messageError}`,
                            );
                          }
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
            ) : null}
          </div>
        )}
      <div className="border-b border-border px-4 py-3">
        <p className="text-[9px] font-semibold uppercase text-muted-foreground">Order status</p>
        <div className="mt-3 grid grid-cols-4 gap-1 sm:gap-3">
          {orderStages.map((stage, index) => (
            <div key={stage} className="min-w-0 text-center">
              <span
                className={`mx-auto grid h-7 w-7 place-items-center rounded-full border text-[10px] font-semibold ${index <= currentStage ? "border-success bg-success text-success-foreground" : "border-border bg-surface text-muted-foreground"}`}
              >
                {index < currentStage ? <CheckCircle2 className="h-3.5 w-3.5" /> : index + 1}
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
      <div className="flex flex-wrap items-stretch gap-2 border-b border-border px-4 py-3">
        <div className="flex flex-wrap items-stretch gap-2">
          {[
            ["Status", ticket.status],
            ["Assigned to", ticket.engineer || "Unassigned"],
          ].map(([label, value]) => (
            <div
              key={label}
              className="flex min-h-9 w-fit min-w-[120px] max-w-[220px] flex-col justify-center rounded-md bg-surface/50 px-3 py-1.5"
            >
              <p className="text-[9px] uppercase text-muted-foreground">{label}</p>
              <p className="truncate text-[11px] font-semibold">{value}</p>
            </div>
          ))}
        </div>
        {(ticket.dbId || (canCloseTicket && ticket.status !== "Closed")) && (
          <div className="ml-auto flex items-stretch gap-2">
            {ticket.dbId && (
              <Button
                asChild
                size="sm"
                className="h-9 gap-2 rounded-md px-3 text-xs shadow-sm"
              >
                <Link to="/invoice/$id" params={{ id: ticket.dbId }}>
                  <ReceiptText className="h-4 w-4" />
                  Invoice
                </Link>
              </Button>
            )}
            {canCloseTicket && ticket.status !== "Closed" && (
              <Button
                size="sm"
                variant="outline"
                className="h-9 gap-2 rounded-md px-3 text-xs"
                onClick={async () => {
                  const saved = await updateTicket({ status: "Closed", progress: 100 }, "close");
                  if (saved) {
                    onNotify?.({ title: "Ticket closed", detail: `${ticket.id} · Completed` });
                  }
                }}
              >
                <CheckCircle2 />
                Close ticket
              </Button>
            )}
          </div>
        )}
      </div>
      {cancellationMessages.length > 0 && (
        <div className="space-y-2 border-b border-border p-4">
          {cancellationMessages.map((message) => (
            <div
              key={`${message.time}-${message.text}`}
              className="rounded-md border border-warning/30 bg-warning/10 p-3"
            >
              <p className="text-xs font-semibold text-warning">
                Customer cancellation message · {message.sender} · {message.time}
              </p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">
                {message.text.replace(/^Cancellation message:\s*/, "")}
              </p>
            </div>
          ))}
        </div>
      )}
      <div className="grid gap-3 border-b border-border p-4 xl:grid-cols-2">
        <div
          className={`self-start rounded-md border p-4 ${isAssigned ? "border-success/30 bg-success/5" : "border-warning/30 bg-warning/5"}`}
        >
          <div className="flex gap-3">
            <span
              className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${isAssigned ? "bg-success/15 text-success" : "bg-warning/15 text-warning"}`}
            >
              {isAssigned ? <CheckCircle2 className="h-5 w-5" /> : <UserRound className="h-5 w-5" />}
            </span>
            <div>
              <p className={`text-sm font-semibold ${isAssigned ? "text-success" : "text-warning"}`}>
                {isAssigned ? "Engineer assigned" : "Assignment pending"}
              </p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                {isAssigned
                  ? `${ticket.engineer} is assigned. Service updates will appear on this order.`
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
      {!isTeam && ticket.status === "Closed" && ticket.dbId && (
        <RateJob dbId={ticket.dbId} rated={ticket.rating} />
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
              disabled={engineersLoading || Boolean(engineersError)}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-xs outline-none focus:border-ring"
            >
              <option value="">Unassigned</option>
              {assignableEngineers.map((engineer) => (
                <option key={engineer.id} value={engineer.id}>
                  {engineer.full_name}
                </option>
              ))}
            </select>
            {engineersError && (
              <span role="alert" className="mt-1 block text-[11px] text-destructive">
                Could not load engineers: {engineersError}
              </span>
            )}
            {!engineersError && !engineersLoading && !assignableEngineers.length && (
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
            disabled={engineersLoading || Boolean(engineersError)}
            onClick={async () => {
              const engineer = assignableEngineers.find(
                (candidate) => candidate.id === selectedEngineerId,
              );
              const saved = await updateTicket(
                {
                  engineerId: selectedEngineerId || null,
                  engineer: engineer?.full_name ?? "Unassigned",
                  assigneePhone: engineer?.phone ?? "",
                  status: engineer ? "In Progress" : ticket.status,
                  progress: engineer ? Math.max(ticket.progress, 45) : ticket.progress,
                },
                "assignee",
              );
              if (saved) {
                onNotify?.({
                  title: "Assignee updated",
                  detail: `${ticket.id} · ${engineer?.full_name ?? "Unassigned"}`,
                });
              }
            }}
          >
            <Users />
            Save assignee
          </Button>
        </div>
      )}
      {isAssigned && ticket.assigneePhone && (
        <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3">
          <span className="grid h-10 w-10 place-items-center rounded-full bg-primary/10 text-primary">
            <UserRound className="h-5 w-5" />
          </span>
          <div className="min-w-[150px] flex-1">
            <p className="text-xs font-semibold">{ticket.engineer}</p>
            <p className="mt-1 text-[10px] text-muted-foreground">{ticket.assigneePhone}</p>
          </div>
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
              disabled={!ticket.dbId || isUploadingAttachments}
            >
              <Paperclip />
              {isUploadingAttachments ? "Uploading..." : "Upload files"}
            </Button>
          </div>
          {(attachmentActionError || attachmentsError) && (
            <p
              role="alert"
              className="mt-3 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive"
            >
              {attachmentActionError || attachmentsError}
            </p>
          )}
          {isUploadingAttachments && (
            <p className="mt-3 text-xs text-muted-foreground" role="status">
              Saving attachments...
            </p>
          )}
          <div className="mt-5 divide-y divide-border rounded-md border border-border">
            {attachmentsLoading ? (
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
                    onClick={() => onDownloadAttachment(file)}
                    disabled={downloadingAttachmentId === file.id}
                  >
                    <Download />
                  </Button>
                </div>
              ))
            ) : (
              <p className="p-6 text-center text-xs text-muted-foreground">
                {ticket.dbId
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
        onChange={onAddFiles}
        disabled={isUploadingAttachments}
      />
    </section>
  );
}
