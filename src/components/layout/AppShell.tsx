// @ts-nocheck
import { jsx, jsxs } from "react/jsx-runtime";
import { SideNav } from "./SideNav";
import { ProjectSideNav } from "./ProjectSideNav";
import { TopNav } from "./TopNav";
function AppShell({
  crumbs,
  children,
  activeService,
  onServiceSelect,
  onBookingsSelect,
  role,
  onRoleChange,
  projectSection,
  onProjectSectionChange,
  onCreateProjectTicket,
  notifications,
  canUseTeam,
  onNotificationsOpen,
  showServiceNav = true
}) {
  return /* @__PURE__ */ jsxs("div", { className: "min-h-screen bg-background", children: [
    /* @__PURE__ */ jsx(TopNav, { crumbs, onBookingsSelect, role, onRoleChange, notifications, canUseTeam, onNotificationsOpen }),
    /* @__PURE__ */ jsxs("div", { className: "flex w-full", children: [
      showServiceNav && /* @__PURE__ */ jsx(SideNav, { activeService, onServiceSelect }),
      role === "team" && /* @__PURE__ */ jsx(ProjectSideNav, { activeSection: projectSection, onSectionChange: onProjectSectionChange, onCreateTicket: onCreateProjectTicket }),
      /* @__PURE__ */ jsx("main", { id: "main-content", className: "min-w-0 flex-1 px-4 py-5 md:px-6 xl:px-8", children })
    ] })
  ] });
}
export {
  AppShell
};
