import { Activity, CheckCircle2, Clock3, ReceiptText } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { panel } from "@/components/common/ui";
import type { Ticket } from "@/services/bookingService";
import { priorities } from "./myBookingsConstants";

function DashboardMetric({
  icon: Icon,
  label,
  value,
  detail,
  tone = "text-primary",
}: {
  icon: typeof ReceiptText;
  label: string;
  value: number;
  detail: string;
  tone?: string;
}) {
  return (
    <section
      className={`${panel} p-4 transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-md`}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-[10px] font-semibold uppercase text-muted-foreground">{label}</p>
        <span className={`grid h-8 w-8 place-items-center rounded-md bg-surface ${tone}`}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className="mt-4 text-2xl font-semibold tracking-tight">{value}</p>
      <p className="mt-1 text-[11px] text-muted-foreground">{detail}</p>
    </section>
  );
}

export function ProjectDashboard({ allTickets }: { allTickets: Ticket[] }) {
  const openTickets = allTickets.filter((ticket) => ticket.status === "Open").length;
  const activeTickets = allTickets.filter((ticket) => ticket.status === "In Progress").length;
  const completedTickets = allTickets.filter((ticket) => ticket.status === "Closed").length;
  const priorityData = priorities.map((priority) => ({
    priority,
    tickets: allTickets.filter((ticket) => ticket.priority === priority).length,
  }));
  const statusData = [...new Set(allTickets.map((ticket) => ticket.status))].map((status) => ({
    status,
    tickets: allTickets.filter((ticket) => ticket.status === status).length,
  }));

  return (
    <section className="mb-5 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="mb-4">
        <p className="text-[10px] font-bold uppercase text-primary">Operations overview</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Project dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Current ticket counts by status and priority.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <DashboardMetric
          icon={ReceiptText}
          label="Total tickets"
          value={allTickets.length}
          detail="All project tickets"
        />
        <DashboardMetric
          icon={Clock3}
          label="Open"
          value={openTickets}
          detail="Awaiting assignment"
          tone="text-warning"
        />
        <DashboardMetric
          icon={Activity}
          label="In progress"
          value={activeTickets}
          detail="Currently being handled"
        />
        <DashboardMetric
          icon={CheckCircle2}
          label="Closed"
          value={completedTickets}
          detail="Completed tickets"
          tone="text-success"
        />
      </div>
      <div className="mt-3 grid gap-3 xl:grid-cols-2">
        <section className={`${panel} p-4`}>
          <h2 className="text-sm font-semibold">Tickets by priority</h2>
          <div className="mt-4 h-44">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={priorityData} margin={{ top: 6, right: 2, left: -22, bottom: 0 }}>
                <CartesianGrid
                  vertical={false}
                  stroke="var(--color-border)"
                  strokeDasharray="3 3"
                />
                <XAxis
                  dataKey="priority"
                  tick={{ fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: 6,
                    borderColor: "var(--color-border)",
                    fontSize: 11,
                  }}
                />
                <Bar dataKey="tickets" radius={[4, 4, 0, 0]} fill="var(--color-primary)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
        <section className={`${panel} p-4`}>
          <h2 className="text-sm font-semibold">Tickets by status</h2>
          <div className="mt-4 h-44">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={statusData} margin={{ top: 6, right: 2, left: -22, bottom: 0 }}>
                <CartesianGrid
                  vertical={false}
                  stroke="var(--color-border)"
                  strokeDasharray="3 3"
                />
                <XAxis dataKey="status" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: 6,
                    borderColor: "var(--color-border)",
                    fontSize: 11,
                  }}
                />
                <Bar dataKey="tickets" radius={[4, 4, 0, 0]} fill="var(--color-primary)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>
    </section>
  );
}
