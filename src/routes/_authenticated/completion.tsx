import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/completion")({
  beforeLoad: () => {
    throw redirect({ to: "/bookings" });
  },
});
