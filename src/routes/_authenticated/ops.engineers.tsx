import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/ops/engineers")({
  beforeLoad: () => {
    throw redirect({ to: "/admin", search: { tab: "engineers" } });
  },
});
