// @ts-nocheck
import { jsx, jsxs } from "react/jsx-runtime";
import { Boxes, ClipboardCheck, HardHat, LifeBuoy, Network, RadioTower, Radar, WandSparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
const items = [
  { title: "Site Audit", to: "/site-audit", icon: ClipboardCheck },
  { title: "Survey", to: "/survey", icon: Radar },
  { title: "Field Engineer Support", service: "Field Engineer", to: "/", icon: HardHat },
  { title: "Products & Inventory", to: "/products", icon: Boxes },
  { title: "Passive Services", to: "/passive", icon: RadioTower },
  { title: "ISP Gateway", to: "/isp-gateway", icon: Network }
];
function SideNav({ activeService, onServiceSelect }) {
  return /* @__PURE__ */ jsxs("aside", { className: "sticky top-16 hidden h-[calc(100vh-4rem)] w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar p-3 text-sidebar-foreground lg:flex", children: [
    /* @__PURE__ */ jsx("nav", { className: "flex flex-col gap-1", children: items.map((item) => {
      const active = activeService === item.title;
      return /* @__PURE__ */ jsxs(
        Button,
        {
          type: "button",
          variant: "ghost",
          onClick: () => onServiceSelect?.(item.service ?? item.title),
          className: `h-10 w-full justify-start px-3 text-xs ${active ? "bg-primary/15 text-foreground shadow-[inset_2px_0_0_0_var(--color-primary)]" : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"}`,
          children: [
            /* @__PURE__ */ jsx(item.icon, { className: `h-4 w-4 ${active ? "text-primary" : ""}` }),
            item.title
          ]
        },
        item.title
      );
    }) }),
   
   
  ] });
}
export {
  SideNav
};
