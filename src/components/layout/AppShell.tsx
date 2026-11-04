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
  canViewTickets,
  canViewRoles,
  canViewDashboard,
  canViewFieldEngineer,
  canViewUpcomingFeatures,
  canViewCustomerPortal,
  notifications,
  canUseTeam,
  onNotificationsOpen,
  onNotificationSelect,
  showServiceNav = true,
}) {
  return /* @__PURE__ */ jsxs("div", {
    className: "min-h-screen bg-background",
    children: [
      /* @__PURE__ */ jsx(TopNav, {
        crumbs,
        onBookingsSelect,
        role,
        onRoleChange,
        notifications,
        canUseTeam,
        onNotificationsOpen,
        onNotificationSelect,
      }),
      /* @__PURE__ */ jsxs("div", {
        className: "flex w-full",
        children: [
          showServiceNav &&
            showServiceNav &&
            jsx(SideNav, {
              activeService,
              onServiceSelect,
              role,
              onBookingsSelect,
              onRoleChange,
              canUseTeam,
              canViewFieldEngineer,
              canViewUpcomingFeatures,
              canViewCustomerPortal,
            }),
          role === "team" &&
            /* @__PURE__ */ jsx(ProjectSideNav, {
              activeSection: projectSection,
              canViewDashboard,
              canViewTickets,
              canViewRoles,
            }),
          /* @__PURE__ */ jsx("main", {
            id: "main-content",
            className: `min-w-0 flex-1 px-4 py-5 md:px-6 xl:px-8 ${projectSection === "tickets" ? "h-[calc(100vh-4rem)] min-h-0 overflow-hidden pb-3 pt-0" : ""}`,
            children,
          }),
        ],
      }),
    ],
  });
}
export { AppShell };
