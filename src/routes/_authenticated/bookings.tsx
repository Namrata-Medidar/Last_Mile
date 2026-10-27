import { createFileRoute } from "@tanstack/react-router";
import { App } from "@/components/App";

export const Route = createFileRoute("/_authenticated/bookings")({
  component: () => <App page="bookings" />,
});
