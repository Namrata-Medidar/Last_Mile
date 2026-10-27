import { CalendarDays, CheckCircle2, Clock3, MapPin, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Ticket } from "@/services/bookingService";

type OrderConfirmationModalProps = {
  ticket: Ticket;
  onConfirm: () => void;
};

export function OrderConfirmationModal({ ticket, onConfirm }: OrderConfirmationModalProps) {
  const isAssigned = ticket.engineer && ticket.engineer !== "Unassigned";

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-overlay/60 p-4">
      <section className="w-full max-w-xl rounded-md border border-border bg-card p-8 text-center shadow-2xl">
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-success/15 text-success">
          <CheckCircle2 className="h-9 w-9" />
        </span>
        <h2 className="mt-4 text-xl font-semibold text-success">Order completed</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Your service request has been placed successfully and is now in our queue.
        </p>

        <div className="mt-6 space-y-3 rounded-md bg-surface/50 p-5 text-left text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Order ID</span>
            <span className="font-semibold text-primary">{ticket.id}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Service</span>
            <span className="max-w-[65%] text-right font-medium">{ticket.title}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Customer</span>
            <span className="font-medium">{ticket.customer}</span>
          </div>
          <div className="flex justify-between border-t border-border pt-3">
            <span className="text-muted-foreground">Status</span>
            <span className="rounded bg-warning/15 px-2 py-0.5 font-semibold text-warning">
              {ticket.status}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Assignment</span>
            <span
              className={`rounded px-2 py-0.5 font-semibold ${isAssigned ? "bg-success/15 text-success" : "bg-warning/15 text-warning"}`}
            >
              {isAssigned ? ticket.engineer : "Assignment pending"}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Priority</span>
            <span className="font-medium">{ticket.priority}</span>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2 text-left text-xs">
          <div className="rounded-md border border-border bg-surface/40 p-3">
            <MapPin className="h-4 w-4 text-primary" />
            <p className="mt-2 font-semibold">{ticket.city}</p>
            <p className="mt-0.5 text-muted-foreground">Location</p>
          </div>
          <div className="rounded-md border border-border bg-surface/40 p-3">
            <Clock3 className="h-4 w-4 text-primary" />
            <p className="mt-2 font-semibold">15-20 minutes</p>
            <p className="mt-0.5 text-muted-foreground">Est. assignment</p>
          </div>
          <div className="rounded-md border border-border bg-surface/40 p-3">
            <CalendarDays className="h-4 w-4 text-primary" />
            <p className="mt-2 font-semibold">{ticket.updated}</p>
            <p className="mt-0.5 text-muted-foreground">Placed</p>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-3 rounded-md border border-warning/30 bg-warning/5 p-3 text-left">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-warning/15 text-warning">
            <UserRound className="h-4.5 w-4.5" />
          </span>
          <p className="text-xs leading-5 text-muted-foreground">
            {isAssigned
              ? `${ticket.engineer} has been assigned and will reach out shortly.`
              : "Our team is matching your request with the nearest qualified engineer."}
          </p>
        </div>

        <Button className="mt-5 w-full" onClick={onConfirm}>
          Confirm and view My Bookings
        </Button>
      </section>
    </div>
  );
}
