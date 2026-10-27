import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/payment")({
  beforeLoad: () => {
    throw redirect({ to: "/bookings" });
  },
});
