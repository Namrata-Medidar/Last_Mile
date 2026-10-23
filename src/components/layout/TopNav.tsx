// @ts-nocheck
import { jsx, jsxs } from "react/jsx-runtime";
import { Bell, Command, Search, Ticket, UsersRound } from "lucide-react";
import { Fragment, useState } from "react";
import { Button } from "@/components/ui/button";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";
import { AccountMenu } from "./AccountMenu";
function TopNav({ crumbs, onBookingsSelect, role, onRoleChange, notifications = [], canUseTeam = false, onNotificationsOpen }) {
  const [showNotifications, setShowNotifications] = useState(false);
  return /* @__PURE__ */ jsxs("header", { className: "sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-border bg-nav px-4 text-nav-foreground md:px-6", children: [
    /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2", children: [
      /* @__PURE__ */ jsx("div", { className: "grid h-8 w-8 place-items-center rounded-md bg-primary text-[10px] font-bold text-primary-foreground", children: "LM" }),
      /* @__PURE__ */ jsxs("span", { className: "text-sm font-semibold", children: [
        "Last Mile ",
        /* @__PURE__ */ jsx("span", { className: "text-primary", children: "Connect" })
      ] })
    ] }),
    /* @__PURE__ */ jsx("nav", { "aria-label": "Breadcrumb", className: "ml-4 hidden items-center gap-2 text-xs lg:flex", children: crumbs.map((c, i) => /* @__PURE__ */ jsxs(Fragment, { children: [
      i > 0 && /* @__PURE__ */ jsx("span", { className: "text-muted-foreground", children: "\u203A" }),
      /* @__PURE__ */ jsx(
        "span",
        {
          className: i === crumbs.length - 1 ? "font-semibold text-foreground" : "text-muted-foreground",
          children: c
        }
      )
    ] }, c)) }),
    /* @__PURE__ */ jsxs("div", { className: "ml-auto flex items-center gap-3", children: [
      /* @__PURE__ */ jsxs("div", { className: "relative hidden xl:block", children: [
        /* @__PURE__ */ jsx(Search, { className: "pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" }),
        /* @__PURE__ */ jsx(
          "input",
          {
            type: "search",
            placeholder: "Search services, products, engineers...",
            "aria-label": "Search",
            className: "h-9 w-56 rounded-md border border-border bg-background/60 pl-9 pr-12 text-xs text-foreground outline-none placeholder:text-muted-foreground focus:border-ring lg:w-80"
          }
        ),
        /* @__PURE__ */ jsxs("span", { className: "pointer-events-none absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-0.5 rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground", children: [
          /* @__PURE__ */ jsx(Command, { className: "h-3 w-3" }),
          "K"
        ] })
      ] }),
      /* @__PURE__ */ jsxs("span", { className: "hidden items-center gap-2 rounded-full border border-success/40 bg-success/10 px-3 py-1 text-[11px] font-medium text-success lg:flex", children: [
        /* @__PURE__ */ jsx("span", { className: "h-1.5 w-1.5 rounded-full bg-success" }),
        "All Systems Operational"
      ] }),
      /* @__PURE__ */ jsxs("label", { className: "hidden items-center gap-2 rounded-md border border-border bg-background/60 px-2 sm:flex", children: [
        /* @__PURE__ */ jsx(UsersRound, { className: "h-3.5 w-3.5 text-primary" }),
        /* @__PURE__ */ jsx("select", { value: role, onChange: (event) => onRoleChange(event.target.value), onInput: (event) => onRoleChange(event.target.value), "aria-label": "Select workspace", className: "h-8 cursor-pointer bg-transparent text-xs font-semibold outline-none", children: [
          /* @__PURE__ */ jsx("option", { value: "customer", children: "Customer" }, "customer"),
          canUseTeam && /* @__PURE__ */ jsx("option", { value: "team", children: "Project team" }, "team")
        ] })
      ] }),
      role === "customer" && /* @__PURE__ */ jsxs(Button, { variant: "outline", size: "sm", className: "inline-flex px-2 md:px-3", onClick: onBookingsSelect, "aria-label": "My bookings", children: [
        /* @__PURE__ */ jsx(Ticket, { className: "h-3.5 w-3.5" }),
        /* @__PURE__ */ jsx("span", { className: "hidden md:inline", children: "My orders" })
      ] }),
      /* @__PURE__ */ jsxs(
        Button,
        {
          "aria-label": "Notifications",
          variant: "ghost",
          size: "icon",
          onClick: () => { setShowNotifications((current) => !current); onNotificationsOpen?.(); },
          className: "relative text-muted-foreground",
          children: [
            /* @__PURE__ */ jsx(Bell, { className: "h-4 w-4" }),
            notifications.some((n) => !n.read) && /* @__PURE__ */ jsx("span", { className: "absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 text-[9px] font-bold text-accent-foreground", children: notifications.filter((n) => !n.read).length })
          ]
        }
      ),
      showNotifications && /* @__PURE__ */ jsx("div", { className: "absolute right-20 top-14 z-50 w-80 rounded-md border border-border bg-card p-3 text-foreground shadow-xl", children: /* @__PURE__ */ jsxs("div", { children: [
        /* @__PURE__ */ jsx("p", { className: "text-xs font-semibold", children: "Notifications" }),
        /* @__PURE__ */ jsx("div", { className: "mt-2 max-h-72 space-y-2 overflow-y-auto", children: notifications.length ? notifications.map((item) => /* @__PURE__ */ jsxs("div", { className: "rounded-md bg-surface/60 p-2", children: [
          /* @__PURE__ */ jsx("p", { className: "text-xs font-semibold", children: item.title }),
          /* @__PURE__ */ jsx("p", { className: "mt-0.5 text-[10px] text-muted-foreground", children: item.detail })
        ] }, item.id)) : /* @__PURE__ */ jsx("p", { className: "py-5 text-center text-xs text-muted-foreground", children: "No new notifications" }) })
      ] }) }),
      /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-1 rounded-md border border-border bg-background/40 pl-2", children: [
        /* @__PURE__ */ jsx("span", { className: "hidden text-[11px] text-muted-foreground lg:inline", children: "Theme" }),
        /* @__PURE__ */ jsx(ThemeSwitcher, {})
      ] }),
      /* @__PURE__ */ jsx(AccountMenu, {})
    ] })
  ] });
}
export {
  TopNav
};
