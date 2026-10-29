// @ts-nocheck
import { BarChart3, ClipboardList, CreditCard, Plus, UsersRound } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

const items = [
  {
    id: "dashboard",
    label: "Dashboard",
    splat: "project/dashboard",
    icon: BarChart3,
  },
  { id: "tickets", label: "Tickets", splat: "project/ticket", icon: ClipboardList },
  { id: "roles", label: "Role management", splat: "admin/role", icon: UsersRound },
  { id: "payment", label: "Payment", splat: "admin/payment", icon: CreditCard },
];

export function ProjectSideNav({
  activeSection,
  onCreateTicket,
  canViewDashboard,
  canViewTickets,
  canViewRoles,
  canViewPayment,
  canCreateTickets,
}) {
  const visibilityById = {
    dashboard: canViewDashboard,
    tickets: canViewTickets,
    roles: canViewRoles,
    // payment: canViewPayment,
  };
  const visibleItems = items.filter(({ id }) => visibilityById[id]);

  return (
    <aside className="sticky top-16 hidden h-[calc(100vh-4rem)] w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar p-3 text-sidebar-foreground md:flex">
      <div className="border-b border-sidebar-border px-2 pb-4">
        <p className="text-[10px] font-bold uppercase text-primary">Project workspace</p>
      </div>
      <nav className="mt-3 flex flex-col gap-1">
        {visibleItems.map(({ id, label, splat, icon: Icon }) => (
          <Button
            key={id}
            asChild
            type="button"
            variant="ghost"
            className={`h-10 justify-start px-3 text-xs ${activeSection === id ? "bg-primary/15 text-foreground shadow-[inset_2px_0_0_0_var(--color-primary)]" : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"}`}
          >
            <Link to="/$" params={{ _splat: splat }}>
              <Icon className={`h-4 w-4 ${activeSection === id ? "text-primary" : ""}`} />
              {label}
            </Link>
          </Button>
        ))}
      </nav>
              <div className="mt-4 border-t border-sidebar-border pt-4">
</div>
    </aside>
  );
}
