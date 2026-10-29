import { createFileRoute } from "@tanstack/react-router";
import { App } from "@/components/App";

export const Route = createFileRoute("/_authenticated/bookings")({
  validateSearch: (search: Record<string, unknown>): { ticket?: string } =>
    typeof search["ticket"] === "string" ? { ticket: search["ticket"] } : {},
  component: BookingsPage,
});

function BookingsPage() {
  const { ticket } = Route.useSearch();
  return <App page="bookings" targetTicketId={ticket} />;
}
