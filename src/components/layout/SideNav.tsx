import { jsx, jsxs } from "react/jsx-runtime";
import {
  Boxes,
  ClipboardCheck,
  HardHat,
  Network,
  RadioTower,
  Radar,
  Ticket,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { UsersRound, UserRound, ChevronDown } from "lucide-react";
const fieldEngineer = {
  title: "Field Engineer Support",
  service: "Field Engineer",
  to: "/",
  icon: HardHat,
};

const upcomingFeatures = [
  { title: "Site Audit", to: "/site-audit", icon: ClipboardCheck },
  { title: "Survey", to: "/survey", icon: Radar },
  { title: "Products & Inventory", to: "/products", icon: Boxes },
  { title: "Passive Services", to: "/passive", icon: RadioTower },
  { title: "ISP Gateway", to: "/isp-gateway", icon: Network },
];

function SideNav({
  activeService,
  onServiceSelect,
  role,
  onBookingsSelect,
  onRoleChange,
  canUseTeam = false,
  canViewFieldEngineer = false,
  canViewUpcomingFeatures = false,
  canViewCustomerPortal = false,
}: {
  activeService?: string;
  onServiceSelect?: (service: string) => void;
  role?: string;
  onBookingsSelect?: () => void;
  onRoleChange?: (role: string) => void;
  canUseTeam?: boolean;
  canViewFieldEngineer?: boolean;
  canViewUpcomingFeatures?: boolean;
  canViewCustomerPortal?: boolean;
}) {
  return (
    <aside className="sticky top-16 hidden h-[calc(100vh-4rem)] w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar p-3 text-sidebar-foreground lg:flex">
      {/* Workspace Switcher */}

      <nav className="flex flex-col gap-1">
        {/* Field Engineer stays on top */}
        {canViewFieldEngineer && (
          <Button
            type="button"
            variant="ghost"
            onClick={() => onServiceSelect?.(fieldEngineer.service)}
            className={`h-10 w-full justify-start px-3 text-xs ${
              activeService === fieldEngineer.title
                ? "bg-primary/15 text-foreground shadow-[inset_2px_0_0_0_var(--color-primary)]"
                : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            }`}
          >
            <HardHat
              className={`h-4 w-4 ${
                activeService === fieldEngineer.title ? "text-primary" : ""
              }`}
            />
            {fieldEngineer.title}
          </Button>
        )}

        {/* Upcoming Features heading */}
        {canViewUpcomingFeatures && (
          <>
            <div className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Upcoming Features
            </div>

            {/* Other services */}
            {upcomingFeatures.map((item) => {
              const active = activeService === item.title;

              return (
                <Button
                  key={item.title}
                  type="button"
                  variant="ghost"
                  onClick={() => onServiceSelect?.(item.title)}
                  className={`h-10 w-full justify-start px-3 text-xs ${
                    active
                      ? "bg-primary/15 text-foreground shadow-[inset_2px_0_0_0_var(--color-primary)]"
                      : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  }`}
                >
                  <item.icon
                    className={`h-4 w-4 ${active ? "text-primary" : ""}`}
                  />
                  {item.title}
                </Button>
              );
            })}
          </>
        )}
      </nav>
<div className="mb-4 border-b border-sidebar-border pb-4">
  {/* <p className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
    Workspace
  </p> */}

  <div className="rounded-xl border border-sidebar-border bg-background/70 p-2 shadow-sm">
    <div className="flex items-center gap-2.5 px-1 py-1">
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
        {role === "team" ? (
          <UsersRound className="h-4 w-4" />
        ) : (
          <UserRound className="h-4 w-4" />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-[10px] text-muted-foreground">
          CURRENT WORKSPACE
        </p>
      </div>

      <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
    </div>

    <div className="mt-2 flex flex-col gap-1 rounded-lg bg-muted/60 p-1">
      {canViewCustomerPortal && (
        <button
          type="button"
          onClick={() => onRoleChange?.("customer")}
          className={`flex w-full items-center justify-start gap-2 rounded-md px-3 py-2.5 text-xs font-medium transition-colors ${
            role !== "team"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:bg-background/60 hover:text-foreground"
          }`}
        >
          <UserRound className="h-3.5 w-3.5" />
          Customer
        </button>
      )}

      {canUseTeam && (
        <button
          type="button"
          onClick={() => onRoleChange?.("team")}
          className={`flex w-full items-center justify-start gap-2 rounded-md px-3 py-2.5 text-xs font-medium transition-colors ${
            role === "team"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:bg-background/60 hover:text-foreground"
          }`}
        >
          <UsersRound className="h-3.5 w-3.5" />
          Project Team
        </button>
      )}

    </div>
  </div>
</div>
      {/* My Orders — customers only */}
      {role === "customer" && (
        <div className="mt-auto border-t border-sidebar-border pt-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="inline-flex w-full justify-start gap-2 px-3"
            onClick={onBookingsSelect}
            aria-label="My orders"
          >
            <Ticket className="h-3.5 w-3.5" />
            <span>My orders</span>
          </Button>
        </div>
      )}
    </aside>
  );
}

export { SideNav };
