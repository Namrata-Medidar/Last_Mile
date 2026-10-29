import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/tracking")({
  beforeLoad: () => {
    throw redirect({ to: "/bookings" });
  },
});
