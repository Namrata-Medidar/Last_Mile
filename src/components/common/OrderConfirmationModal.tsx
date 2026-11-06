import { CalendarDays, CheckCircle2, MapPin, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Ticket } from "@/services/bookingService";

type OrderConfirmationModalProps = {
  ticket: Ticket;
  onConfirm: () => void;
};

export function OrderConfirmationModal({ ticket, onConfirm }: OrderConfirmationModalProps) {
  const isAssigned = ticket.engineer && ticket.engineer !== "Unassigned";
  const location = ticket.city || ticket.siteLocation || "Not provided";

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-overlay/60 p-4">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="booking-confirmation-title"
        className="flex max-h-[calc(100dvh-2rem)] w-full max-w-lg flex-col overflow-hidden rounded-md border border-border bg-card text-center shadow-2xl"
      >
        <div className="min-h-0 overflow-y-auto p-4">
          <span className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-success/15 text-success">
            <CheckCircle2 className="h-6 w-6" />
          </span>
          <h2 id="booking-confirmation-title" className="mt-2 text-lg font-semibold text-success">
            Booking completed
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Your service request has been placed successfully and is now in our queue.
          </p>

          <div className="mt-3 space-y-2 rounded-md bg-surface/50 p-3 text-left text-xs">
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
            <div className="flex justify-between border-t border-border pt-2">
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

          <div className="mt-3 grid grid-cols-2 gap-2 text-left text-xs">
            <div className="rounded-md border border-border bg-surface/40 p-2">
              <MapPin className="h-3.5 w-3.5 text-primary" />
              <p className="mt-1 font-semibold">{location}</p>
              <p className="mt-0.5 text-muted-foreground">Location</p>
            </div>
            <div className="rounded-md border border-border bg-surface/40 p-2">
              <CalendarDays className="h-3.5 w-3.5 text-primary" />
              <p className="mt-1 font-semibold">{ticket.updated}</p>
              <p className="mt-0.5 text-muted-foreground">Placed</p>
            </div>
          </div>

          <div className="mt-3 flex items-center gap-2 rounded-md border border-warning/30 bg-warning/5 p-2 text-left">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-warning/15 text-warning">
              <UserRound className="h-4 w-4" />
            </span>
            <p className="text-xs leading-4 text-muted-foreground">
              {isAssigned
                ? `${ticket.engineer} has been assigned to your booking.`
                : "Your booking is awaiting engineer assignment."}
            </p>
          </div>
        </div>
        <div className="shrink-0 border-t border-border bg-card p-3">
          <Button size="sm" className="w-full" onClick={onConfirm}>
            Confirm and view My Bookings
          </Button>
        </div>
      </section>
    </div>
  );
}
