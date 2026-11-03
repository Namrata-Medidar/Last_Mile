import { MessageSquare, Search } from "lucide-react";

import { panel } from "@/components/common/ui";
import type { Ticket } from "@/services/bookingService";
import { priorities, statuses } from "./myBookingsConstants";

export function MyBookingsQueue({
  isTeam,
  visibleTickets,
  selectedTicketId,
  readTicketIds,
  counts,
  priorityCounts,
  customerOptions,
  statusFilter,
  setStatusFilter,
  customerFilter,
  setCustomerFilter,
  priorityFilter,
  setPriorityFilter,
  search,
  setSearch,
  onSelectTicket,
}: {
  isTeam: boolean;
  visibleTickets: Ticket[];
  selectedTicketId: string;
  readTicketIds: string[];
  counts: Record<string, number>;
  priorityCounts: Record<string, number>;
  customerOptions: { id: string; label: string }[];
  statusFilter: string;
  setStatusFilter: (filter: string) => void;
  customerFilter: string;
  setCustomerFilter: (filter: string) => void;
  priorityFilter: string;
  setPriorityFilter: (filter: string) => void;
  search: string;
  setSearch: (query: string) => void;
  onSelectTicket: (ticket: Ticket) => void;
}) {
  return (
    <aside
      className={
        isTeam
          ? `${panel} queue-scrollbar flex h-full min-h-0 flex-col overflow-y-auto overscroll-contain p-0`
          : `${panel} flex h-fit max-h-none flex-col overflow-hidden p-0 lg:sticky lg:top-20 lg:h-[calc(100vh-6rem)]`
      }
    >
      <div className="shrink-0 border-b border-border p-3">
        <div>
          <p className="text-sm font-semibold">{isTeam ? "Project queue" : "My orders"}</p>
          {isTeam ? (
            <button
              type="button"
              onClick={() => {
                setStatusFilter("All");
                setCustomerFilter("All");
                setPriorityFilter("All");
                setSearch("");
              }}
              className="mt-0.5 rounded-sm text-left text-[10px] text-muted-foreground hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Show all tickets and clear queue filters"
            >
              {visibleTickets.length} visible tickets
            </button>
          ) : (
            <p className="mt-0.5 text-[10px] text-muted-foreground">
              {visibleTickets.length} visible orders
            </p>
          )}
        </div>
        <div className="mt-3 grid grid-cols-3 gap-1">
          {statuses.map(({ label, style }) => {
            const active = statusFilter === label;
            return (
              <button
                key={label}
                type="button"
                onClick={() => setStatusFilter(active ? "All" : label)}
                className={`rounded-md border px-1 py-1.5 text-center text-[9px] font-semibold transition-colors ${style} ${active ? "ring-1 ring-current" : "hover:bg-surface"}`}
              >
                <span className="block text-sm font-bold text-foreground">{counts[label]}</span>
                {label === "In Progress" ? "Pending" : label}
              </button>
            );
          })}
        </div>
        {isTeam && (
          <div className="mt-3 border-t border-border/60 pt-3">
            <p className="mb-2 text-[9px] font-semibold uppercase text-muted-foreground">
              Customer
            </p>
            <select
              value={customerFilter}
              onChange={(event) => setCustomerFilter(event.target.value)}
              className="mb-3 h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
            >
              {customerOptions.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.label}
                </option>
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
      <div
        className={
          isTeam
            ? "shrink-0"
            : "queue-scrollbar h-[min(55vh,600px)] min-h-[240px] flex-1 overflow-y-auto overscroll-contain lg:h-auto lg:min-h-0"
        }
      >
        {visibleTickets.map((ticket) => {
          const ticketUnreadComments =
            ticket.unreadComments && !readTicketIds.includes(ticket.id) ? ticket.unreadComments : 0;
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
              onClick={() => onSelectTicket(ticket)}
              className={`w-full border-b border-border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary ${selectedTicketId === ticket.id ? "bg-primary/10 shadow-[inset_3px_0_0_var(--color-primary)]" : "hover:bg-surface"}`}
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
          <p className="p-8 text-center text-xs text-muted-foreground">No tickets match this view.</p>
        )}
      </div>
    </aside>
  );
}
