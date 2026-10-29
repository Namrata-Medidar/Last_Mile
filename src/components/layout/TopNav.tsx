// @ts-nocheck
import { jsx, jsxs } from "react/jsx-runtime";
import { Bell, Command, Search, UsersRound } from "lucide-react";
import { Fragment, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";
import { AccountMenu } from "./AccountMenu";
function TopNav({ crumbs, onBookingsSelect, role, onRoleChange, notifications = [], canUseTeam = false, onNotificationsOpen, onNotificationSelect }) {
  const [showNotifications, setShowNotifications] = useState(false);
  return /* @__PURE__ */ jsxs("header", { className: "sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-border bg-nav px-4 text-nav-foreground md:px-6", children: [
    /* @__PURE__ */ jsxs(Link, { to: "/", "aria-label": "Last Mile Connect home", className: "flex items-center gap-2", children: [
      /* @__PURE__ */ jsx("img", { src: "/brand-mark.png", alt: "", className: "h-8 w-8 rounded-md bg-white object-contain p-0.5" }),
      /* @__PURE__ */ jsxs("span", { className: "text-sm font-semibold", children: [
        "Last Mile ",
        /* @__PURE__ */ jsx("span", { className: "text-primary", children: "Connect" })
      ] })
    ] }),
    /* @__PURE__ */ jsx("nav", { "aria-label": "Breadcrumb", className: "ml-4 hidden items-center gap-2 text-xs lg:flex", children: crumbs.map((c, i) => /* @__PURE__ */ jsxs(Fragment, { children: [
      i > 0 && /* @__PURE__ */ jsx("span", { className: "text-muted-foreground", children: "\u203A" }),
      i === 0
        ? /* @__PURE__ */ jsx(Link, { to: "/", className: "text-muted-foreground hover:text-foreground", children: c })
        : /* @__PURE__ */ jsx("span", { className: "font-semibold text-foreground", children: c })
    ] }, c)) }),
    /* @__PURE__ */ jsxs("div", { className: "ml-auto flex items-center gap-3", children: [
      // /* @__PURE__ */ jsxs("div", { className: "relative hidden xl:block", children: [
      //   /* @__PURE__ */ jsx(Search, { className: "pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" }),
      //   // /* @__PURE__ */ jsx(
      //   //   "input",
      //   //   {
      //   //     type: "search",
      //   //     placeholder: "Search services, products, engineers...",
      //   //     "aria-label": "Search",
      //   //     className: "h-9 w-56 rounded-md border border-border bg-background/60 pl-9 pr-12 text-xs text-foreground outline-none placeholder:text-muted-foreground focus:border-ring lg:w-80"
      //   //   }
      //   // ),
      //   /* @__PURE__ */ jsxs("span", { className: "pointer-events-none absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-0.5 rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground", children: [
      //     /* @__PURE__ */ jsx(Command, { className: "h-3 w-3" }),
      //     "K"
      //   ] })
      // ] }),


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
        /* @__PURE__ */ jsx("div", { className: "mt-2 max-h-72 space-y-2 overflow-y-auto", children: notifications.length ? notifications.map((item) => /* @__PURE__ */ jsxs("button", { type: "button", onClick: () => { setShowNotifications(false); onNotificationSelect?.(item); }, className: "w-full rounded-md bg-surface/60 p-2 text-left hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", children: [
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
