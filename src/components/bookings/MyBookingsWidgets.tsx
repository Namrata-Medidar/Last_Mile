import { LockKeyhole, Paperclip, Send, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { BookingAttachment } from "@/services/attachmentService";
import type { Comment } from "@/services/bookingService";

type BookingTab = "public" | "attachments" | "internal";

const tabs: { id: BookingTab; label: string; icon: typeof Users }[] = [
  { id: "public", label: "Public reply", icon: Users },
  { id: "attachments", label: "Attachments", icon: Paperclip },
  { id: "internal", label: "Internal note", icon: LockKeyhole },
];

export function TicketTabs({
  activeTab,
  setActiveTab,
  attachments,
  isTeam,
}: {
  activeTab: BookingTab;
  setActiveTab: (tab: BookingTab) => void;
  attachments: BookingAttachment[];
  isTeam: boolean;
}) {
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

export function Conversation({
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
}: {
  channel: "public" | "internal";
  messages: Comment[];
  draft: string;
  setDraft: (value: string) => void;
  onSend: () => void;
  onAttach: () => void;
  activeTab: BookingTab;
  setActiveTab: (tab: BookingTab) => void;
  attachments: BookingAttachment[];
  isTeam: boolean;
  canEdit?: boolean;
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

export function OrderMetric({
  icon: Icon,
  label,
  value,
  valueClassName = "",
}: {
  icon: typeof Paperclip;
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="rounded-md bg-surface/50 p-2.5">
      <Icon className="h-3.5 w-3.5 text-primary" />
      <p className={`mt-1.5 text-[11px] font-semibold ${valueClassName}`}>{value}</p>
      <p className="mt-0.5 text-[9px] text-muted-foreground">{label}</p>
    </div>
  );
}
