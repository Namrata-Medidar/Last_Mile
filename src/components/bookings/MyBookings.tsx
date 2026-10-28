// @ts-nocheck
import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Activity, BadgeCheck, BarChart3, CalendarDays, CheckCircle2, Clock3, Download, FileText, LockKeyhole, MapPin, MessageSquare, Paperclip, Phone, Plus, ReceiptText, Search, Send, UserRound, Users } from "lucide-react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { panel } from "@/components/common/ui";
import { Button } from "@/components/ui/button";
import { RateJob } from "./RateJob";
import type { CommentsByTicket, Ticket, TicketUpdate } from "@/services/bookingService";

const tickets = [
  { id: "FE-2026-00124", title: "Connectivity down at Pune Store 24", status: "In Progress", priority: "Urgent", engineer: "Rajesh Kumar", updated: "2 min ago", city: "Pune", customer: "Airtel Business", progress: 68, unreadComments: 2 },
  { id: "SA-2026-00117", title: "Site readiness audit - Noida", status: "Open", priority: "Medium", engineer: "Unassigned", updated: "18 min ago", city: "Noida", customer: "Reliance Retail", progress: 12, unreadComments: 1 },
  { id: "SV-2026-00109", title: "WiFi heatmap survey - Bengaluru", status: "Closed", priority: "Low", engineer: "Karthik Rao", updated: "Yesterday", city: "Bengaluru", customer: "Marriott", progress: 100, unreadComments: 0 },
  { id: "FE-2026-00098", title: "Router replacement - Hyderabad", status: "In Progress", priority: "High", engineer: "Neha Singh", updated: "32 min ago", city: "Hyderabad", customer: "Axis Bank", progress: 44, unreadComments: 0 },
  { id: "PS-2026-00091", title: "Fiber termination and testing", status: "Open", priority: "High", engineer: "Unassigned", updated: "1 hr ago", city: "Mumbai", customer: "HDFC Bank", progress: 8 },
  { id: "SA-2026-00072", title: "Branch infrastructure audit", status: "Closed", priority: "Medium", engineer: "Arun Bhat", updated: "3 days ago", city: "Chennai", customer: "ICICI Bank", progress: 100 },
];

const statuses = [
  { label: "Open", icon: Clock3, style: "border-warning/20 bg-warning/10 text-warning" },
  { label: "In Progress", icon: Activity, style: "border-primary/20 bg-primary/10 text-primary" },
  { label: "Closed", icon: CheckCircle2, style: "border-success/20 bg-success/10 text-success" },
];
const orderStages = ["Pending", "Assigned", "In progress", "Completed"];
const priorities = ["Urgent", "High", "Medium", "Low"];
const priorityRank = { Urgent: 0, High: 1, Medium: 2, Low: 3 };

const tabs = [
  { id: "public", label: "Public reply", icon: Users },
  { id: "attachments", label: "Attachments", icon: Paperclip },
  { id: "internal", label: "Internal note", icon: LockKeyhole },

];

const startingMessages = {
  "FE-2026-00124": {
    public: [
    { sender: "Rajesh Kumar", role: "Field engineer", text: "I have reviewed the issue and will reach the location shortly.", time: "10:18 AM" },
    { sender: "Amit Deshpande", role: "Customer", text: "The site POC is available. Billing counters are still offline.", time: "10:20 AM" },
    { sender: "You", role: "Operations", text: "Please contact the site POC before arrival and share the diagnosis here.", time: "10:22 AM" },
    ],
    
    internal: [
    { sender: "Nisha Shah", role: "NOC", text: "Last-mile circuit is reachable. Suspecting a local power or CPE issue.", time: "10:12 AM" },
    { sender: "You", role: "Service desk", text: "Keep a replacement router ready. Verify the RCA before sharing it.", time: "10:16 AM" },
    ],
  },
  "SA-2026-00117": {
    public: [{ sender: "Priya Nair", role: "Service desk", text: "Your site readiness audit is awaiting engineer assignment.", time: "10:05 AM" }],
    internal: [{ sender: "You", role: "Service desk", text: "Check auditor availability for the Noida service area.", time: "10:08 AM" }],
  },
};

const startingFiles = [
  { name: "site-photo-router.jpg", type: "Site photo", size: "2.4 MB", by: "Rajesh Kumar", time: "10:31 AM" },
  { name: "work-order-FE-00124.pdf", type: "Work order", size: "184 KB", by: "Operations", time: "9:55 AM" },
  { name: "network-diagram.pdf", type: "Technical document", size: "620 KB", by: "Amit Deshpande", time: "9:48 AM" },
];

const activityData = [
  { time: "09:00", updates: 1 }, { time: "10:00", updates: 4 }, { time: "11:00", updates: 7 },
  { time: "12:00", updates: 5 }, { time: "13:00", updates: 8 }, { time: "14:00", updates: 6 },
];
const weeklyData = [
  { day: "Mon", opened: 8, closed: 5 }, { day: "Tue", opened: 5, closed: 7 },
  { day: "Wed", opened: 11, closed: 8 }, { day: "Thu", opened: 7, closed: 9 },
  { day: "Fri", opened: 9, closed: 6 }, { day: "Sat", opened: 4, closed: 5 },
];
const closingTimeData = [
  { label: "Apr", hours: 19 }, { label: "May", hours: 17 }, { label: "Jun", hours: 16 }, { label: "Jul", hours: 14 }, { label: "Aug", hours: 12 }, { label: "Sep", hours: 11 },
];
const closingByAssigneeData = [
  { label: "Rajesh", hours: 10 }, { label: "Neha", hours: 13 }, { label: "Karthik", hours: 15 }, { label: "Arun", hours: 18 },
];
const closingByCustomerData = [
  { label: "Airtel", hours: 11 }, { label: "Axis", hours: 13 }, { label: "HDFC", hours: 16 }, { label: "Reliance", hours: 18 }, { label: "ICICI", hours: 20 },
];

function TicketTabs({ activeTab, setActiveTab, attachments, isTeam }) {
  return <div className="flex gap-1 overflow-x-auto" role="tablist" aria-label="Ticket workspace">{tabs.filter((tab) => isTeam || tab.id !== "internal").map(({ id, label, icon: Icon }) => <button key={id} type="button" role="tab" aria-selected={activeTab === id} onClick={() => setActiveTab(id)} className={`flex h-8 shrink-0 items-center gap-1.5 rounded px-2 text-[10px] font-semibold ${activeTab === id ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-surface hover:text-foreground"}`}><Icon className="h-3 w-3" />{label}{id === "attachments" && <span className="rounded bg-surface px-1 text-[9px]">{attachments.length}</span>}</button>)}</div>;
}

function Conversation({ channel, messages, draft, setDraft, onSend, onAttach, activeTab, setActiveTab, attachments, isTeam, canEdit = true }) {
  const internal = channel === "internal";
  return <div className="p-4">
      <div className="h-[470px] space-y-3 overflow-y-auto rounded-md border border-border bg-surface/35 p-4">
        {messages.map((message, index) => <div key={`${message.time}-${index}`} className={message.sender === "You" ? "text-right" : ""}><p className="text-[10px] text-muted-foreground">{message.sender} · {message.role} · {message.time}</p><p className={`mt-1 inline-block max-w-[85%] rounded-md px-3 py-2 text-left text-xs leading-5 ${message.sender === "You" ? "bg-primary text-primary-foreground" : "bg-surface"}`}>{message.text}</p></div>)}
      </div>
      <div className="mt-3 border-t border-border pt-2"><TicketTabs activeTab={activeTab} setActiveTab={setActiveTab} attachments={attachments} isTeam={isTeam} /><div className="mt-2 flex gap-2">{canEdit ? <><Button size="icon" variant="outline" onClick={onAttach} aria-label="Attach file"><Paperclip /></Button><input value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => event.key === "Enter" && onSend()} placeholder={internal ? "Add a private note" : "Reply to customer and engineer"} className="h-10 min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-xs outline-none focus:border-ring" /><Button size="icon" onClick={onSend} aria-label="Send message"><Send /></Button></> : <p className="py-2 text-xs text-muted-foreground">You have view-only access to this ticket.</p>}</div></div>
  </div>;
}

function OrderMetric({ icon: Icon, label, value }) {
  return <div className="rounded-md border border-border bg-surface/50 p-3"><Icon className="h-4 w-4 text-primary" /><p className="mt-2 text-xs font-semibold">{value}</p><p className="mt-1 text-[10px] text-muted-foreground">{label}</p></div>;
}

function DashboardMetric({ icon: Icon, label, value, detail, tone = "text-primary" }) {
  return <section className={`${panel} p-4 transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-md`}><div className="flex items-start justify-between gap-3"><p className="text-[10px] font-semibold uppercase text-muted-foreground">{label}</p><span className={`grid h-8 w-8 place-items-center rounded-md bg-surface ${tone}`}><Icon className="h-4 w-4" /></span></div><p className="mt-4 text-2xl font-semibold tracking-tight">{value}</p><p className="mt-1 text-[11px] text-muted-foreground">{detail}</p></section>;
}

function ProjectDashboardLegacy({ allTickets }) {
  const openTickets = allTickets.filter((ticket) => ticket.status === "Open").length;
  const activeTickets = allTickets.filter((ticket) => ticket.status === "In Progress").length;
  const completedTickets = allTickets.filter((ticket) => ticket.status === "Closed").length;
  const urgentTickets = allTickets.filter((ticket) => ticket.priority === "Urgent").length;
  const priorityData = priorities.map((priority) => ({ priority, tickets: allTickets.filter((ticket) => ticket.priority === priority).length }));
  const assigneeData = Object.values(allTickets.reduce((summary, ticket) => {
    const name = ticket.engineer === "Unassigned" ? "Unassigned" : ticket.engineer;
    summary[name] = summary[name] ?? { name, customers: new Set(), tickets: 0 };
    summary[name].customers.add(ticket.customer);
    summary[name].tickets += 1;
    return summary;
  }, {})).map((item) => ({ name: item.name, customers: item.customers.size, tickets: item.tickets }));
  return <section className="mb-5 animate-in fade-in slide-in-from-bottom-2 duration-500">
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3"><div><p className="text-[10px] font-bold uppercase text-primary">Operations overview</p><h1 className="mt-1 text-2xl font-semibold tracking-tight">Project dashboard</h1><p className="mt-1 text-sm text-muted-foreground">Monitor service delivery and act on the highest-priority tickets first.</p></div><p className="rounded-md border border-border bg-card px-3 py-2 text-[11px] font-medium text-muted-foreground">Updated just now</p></div>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><DashboardMetric icon={ReceiptText} label="Total tickets" value={allTickets.length} detail="Across all customer accounts" /><DashboardMetric icon={Clock3} label="Avg closing time" value="14 hrs" detail="Rolling 4-week service average" tone="text-primary" /><DashboardMetric icon={Activity} label="In progress" value={activeTickets} detail="Engineers currently engaged" /><DashboardMetric icon={CheckCircle2} label="Completed" value={completedTickets} detail="Closed service requests" tone="text-success" /></div>
    <div className="mt-3 grid gap-3 xl:grid-cols-2"><section className={`${panel} p-4`}><div className="flex items-start justify-between"><div><h2 className="text-sm font-semibold">Ticket activity</h2><p className="mt-1 text-[11px] text-muted-foreground">Service updates received during the workday</p></div><BarChart3 className="h-4 w-4 text-primary" /></div><div className="mt-4 h-44"><ResponsiveContainer width="100%" height="100%"><AreaChart data={activityData} margin={{ top: 6, right: 4, left: -22, bottom: 0 }}><defs><linearGradient id="ticketUpdates" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.28} /><stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} /></linearGradient></defs><CartesianGrid vertical={false} stroke="var(--color-border)" strokeDasharray="3 3" /><XAxis dataKey="time" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} /><YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} /><Tooltip contentStyle={{ borderRadius: 6, borderColor: "var(--color-border)", fontSize: 11 }} /><Area type="monotone" dataKey="updates" stroke="var(--color-primary)" strokeWidth={2} fill="url(#ticketUpdates)" /></AreaChart></ResponsiveContainer></div></section><section className={`${panel} p-4`}><div className="flex items-start justify-between"><div><h2 className="text-sm font-semibold">Priority mix</h2><p className="mt-1 text-[11px] text-muted-foreground">{urgentTickets} urgent ticket{urgentTickets === 1 ? "" : "s"} need attention</p></div><span className="rounded bg-destructive/10 px-2 py-1 text-[10px] font-semibold text-destructive">Urgent</span></div><div className="mt-4 h-44"><ResponsiveContainer width="100%" height="100%"><BarChart data={priorityData} margin={{ top: 6, right: 2, left: -22, bottom: 0 }}><CartesianGrid vertical={false} stroke="var(--color-border)" strokeDasharray="3 3" /><XAxis dataKey="priority" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} /><YAxis allowDecimals={false} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} /><Tooltip contentStyle={{ borderRadius: 6, borderColor: "var(--color-border)", fontSize: 11 }} /><Bar dataKey="tickets" radius={[4, 4, 0, 0]} fill="var(--color-primary)" /></BarChart></ResponsiveContainer></div></section></div>
    <div className="mt-3 grid gap-3 xl:grid-cols-2"><section className={`${panel} p-4`}><h2 className="text-sm font-semibold">Average closing time</h2><p className="mt-1 text-[11px] text-muted-foreground">Average hours from ticket creation to closure.</p><div className="mt-4 h-44"><ResponsiveContainer width="100%" height="100%"><AreaChart data={closingTimeData} margin={{ top: 6, right: 4, left: -22, bottom: 0 }}><CartesianGrid vertical={false} stroke="var(--color-border)" strokeDasharray="3 3" /><XAxis dataKey="week" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} /><YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} /><Tooltip contentStyle={{ borderRadius: 6, borderColor: "var(--color-border)", fontSize: 11 }} /><Area type="monotone" dataKey="hours" stroke="var(--color-success)" strokeWidth={2} fill="var(--color-success)" fillOpacity={0.12} /></AreaChart></ResponsiveContainer></div></section><section className={`${panel} p-4`}><h2 className="text-sm font-semibold">Assignee customer load</h2><p className="mt-1 text-[11px] text-muted-foreground">How many customers each assignee is handling.</p><div className="mt-4 h-44"><ResponsiveContainer width="100%" height="100%"><BarChart data={assigneeData} margin={{ top: 6, right: 2, left: -22, bottom: 0 }}><CartesianGrid vertical={false} stroke="var(--color-border)" strokeDasharray="3 3" /><XAxis dataKey="name" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} /><YAxis allowDecimals={false} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} /><Tooltip contentStyle={{ borderRadius: 6, borderColor: "var(--color-border)", fontSize: 11 }} /><Bar dataKey="customers" radius={[4, 4, 0, 0]} fill="var(--color-primary)" /></BarChart></ResponsiveContainer></div></section></div>
  </section>;
}

function ProjectDashboard({ allTickets }) {
  const [closingView, setClosingView] = useState("month");
  const activeTickets = allTickets.filter((ticket) => ticket.status === "In Progress").length;
  const completedTickets = allTickets.filter((ticket) => ticket.status === "Closed").length;
  const urgentTickets = allTickets.filter((ticket) => ticket.priority === "Urgent").length;
  const priorityData = priorities.map((priority) => ({ priority, tickets: allTickets.filter((ticket) => ticket.priority === priority).length }));
  const closingViews = {
    month: { label: "Average Closing Time by Month", data: closingTimeData },
    assignee: { label: "Average Closing Time by Assignee", data: closingByAssigneeData },
    customer: { label: "Average Closing Time by Customer", data: closingByCustomerData },
  };
  const activeClosingView = closingViews[closingView];
  return <section className="mb-5 animate-in fade-in slide-in-from-bottom-2 duration-500">
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3"><div><p className="text-[10px] font-bold uppercase text-primary">Operations overview</p><h1 className="mt-1 text-2xl font-semibold tracking-tight">Project dashboard</h1><p className="mt-1 text-sm text-muted-foreground">Monitor closing time, workload, and priority risk from one view.</p></div><p className="rounded-md border border-border bg-card px-3 py-2 text-[11px] font-medium text-muted-foreground">Updated just now</p></div>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><DashboardMetric icon={ReceiptText} label="Total tickets" value={allTickets.length} detail="Across all customer accounts" /><DashboardMetric icon={Clock3} label="Avg closing time" value="14 hrs" detail="Current service average" tone="text-primary" /><DashboardMetric icon={Activity} label="In progress" value={activeTickets} detail="Engineers currently engaged" /><DashboardMetric icon={CheckCircle2} label="Completed" value={completedTickets} detail="Closed service requests" tone="text-success" /></div>
    <section className={`${panel} mt-3 p-4`}><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-sm font-semibold">{activeClosingView.label}</h2><p className="mt-1 text-[11px] text-muted-foreground">Select a view to modify the graph.</p></div><div className="flex gap-1 rounded-md bg-surface p-1">{Object.entries(closingViews).map(([id, item]) => <Button key={id} size="sm" variant={closingView === id ? "default" : "ghost"} onClick={() => setClosingView(id)}>{item.label.replace("Average Closing Time by ", "")}</Button>)}</div></div><div className="mt-5 h-72"><ResponsiveContainer width="100%" height="100%"><BarChart data={activeClosingView.data} margin={{ top: 6, right: 12, left: -18, bottom: 0 }}><CartesianGrid vertical={false} stroke="var(--color-border)" strokeDasharray="3 3" /><XAxis dataKey="label" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} /><YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} unit="h" /><Tooltip contentStyle={{ borderRadius: 6, borderColor: "var(--color-border)", fontSize: 11 }} formatter={(value) => [`${value} hrs`, "Average closing time"]} /><Bar dataKey="hours" radius={[6, 6, 0, 0]} fill="var(--color-primary)" /></BarChart></ResponsiveContainer></div></section>
    <div className="mt-3 grid gap-3 xl:grid-cols-2"><section className={`${panel} p-4`}><div className="flex items-start justify-between"><div><h2 className="text-sm font-semibold">Priority mix</h2><p className="mt-1 text-[11px] text-muted-foreground">{urgentTickets} urgent ticket{urgentTickets === 1 ? "" : "s"} need attention</p></div><span className="rounded bg-destructive/10 px-2 py-1 text-[10px] font-semibold text-destructive">Urgent</span></div><div className="mt-4 h-44"><ResponsiveContainer width="100%" height="100%"><BarChart data={priorityData} margin={{ top: 6, right: 2, left: -22, bottom: 0 }}><CartesianGrid vertical={false} stroke="var(--color-border)" strokeDasharray="3 3" /><XAxis dataKey="priority" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} /><YAxis allowDecimals={false} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} /><Tooltip contentStyle={{ borderRadius: 6, borderColor: "var(--color-border)", fontSize: 11 }} /><Bar dataKey="tickets" radius={[4, 4, 0, 0]} fill="var(--color-primary)" /></BarChart></ResponsiveContainer></div></section><section className={`${panel} p-4`}><h2 className="text-sm font-semibold">Ticket volume</h2><p className="mt-1 text-[11px] text-muted-foreground">Opened vs closed tickets by weekday.</p><div className="mt-4 h-44"><ResponsiveContainer width="100%" height="100%"><BarChart data={weeklyData} margin={{ top: 6, right: 2, left: -22, bottom: 0 }}><CartesianGrid vertical={false} stroke="var(--color-border)" strokeDasharray="3 3" /><XAxis dataKey="day" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} /><YAxis allowDecimals={false} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} /><Tooltip contentStyle={{ borderRadius: 6, borderColor: "var(--color-border)", fontSize: 11 }} /><Bar dataKey="opened" radius={[4, 4, 0, 0]} fill="var(--color-primary)" /><Bar dataKey="closed" radius={[4, 4, 0, 0]} fill="var(--color-success)" /></BarChart></ResponsiveContainer></div></section></div>
  </section>;
}

export function MyBookings({
  onBack,
  customerTickets = [],
  mode = "customer",
  showDashboard = false,
  showTickets = true,
  onNotify,
  onUpdateTicket,
  onComment,
  canEditTickets = true,
  canAddAssignee = false,
  canCloseTicket = false,
  comments,
  loading = false,
  targetTicketId,
}: {
  onBack: () => void;
  customerTickets?: Ticket[];
  mode?: "customer" | "team";
  showDashboard?: boolean;
  showTickets?: boolean;
  onNotify?: (notification: { title: string; detail: string }) => void;
  onUpdateTicket?: (
    ticketNo: string,
    update: TicketUpdate,
    action?: "edit" | "assignee" | "close",
  ) => Promise<boolean> | boolean | void;
  onComment?: (
    ticketNo: string,
    visibility: "public" | "internal",
    text: string,
  ) => void;
  canAddAssignee?: boolean;
  canCloseTicket?: boolean;
  canEditTickets?: boolean;
  comments?: CommentsByTicket | undefined;
  loading?: boolean;
  targetTicketId?: string | undefined;
}) {
  const isTeam = mode === "team";
  const allTickets = customerTickets;
  const [selectedRaw, setSelected] = useState(null);
  const selected = allTickets.find((t) => t.id === selectedRaw?.id) ?? allTickets[0];
  const [readTicketIds, setReadTicketIds] = useState([]);
  const [ticketUpdates, setTicketUpdates] = useState({});
  const [statusFilter, setStatusFilter] = useState("All");
  const [priorityFilter, setPriorityFilter] = useState("All");
  const [customerFilter, setCustomerFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("public");
  const [assigneeName, setAssigneeName] = useState(allTickets[0]?.engineer === "Unassigned" ? "" : allTickets[0]?.engineer ?? "");
  const [assigneePhone, setAssigneePhone] = useState(allTickets[0]?.assigneePhone ?? "");
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState(startingMessages);
  const [attachments, setAttachments] = useState(startingFiles);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!targetTicketId) return;
    const targetTicket = allTickets.find(
      (ticket) => ticket.dbId === targetTicketId || ticket.id === targetTicketId,
    );
    if (!targetTicket) return;
    setSelected(targetTicket);
    setStatusFilter("All");
    setPriorityFilter("All");
    setCustomerFilter("All");
    setSearch("");
  }, [allTickets, targetTicketId]);

  const counts = useMemo(() => Object.fromEntries(statuses.map(({ label }) => [label, allTickets.filter((ticket) => ticket.status === label).length])), [allTickets]);
  const priorityCounts = useMemo(() => Object.fromEntries(priorities.map((priority) => [priority, allTickets.filter((ticket) => ticket.priority === priority).length])), [allTickets]);
  const customerOptions = useMemo(() => ["All", ...new Set(allTickets.map((ticket) => ticket.customer))], [allTickets]);
  const visibleTickets = useMemo(() => allTickets.filter((ticket) => {
    const query = search.toLowerCase();
    return (statusFilter === "All" || ticket.status === statusFilter) && (priorityFilter === "All" || ticket.priority === priorityFilter) && (customerFilter === "All" || ticket.customer === customerFilter) && `${ticket.id} ${ticket.title} ${ticket.customer}`.toLowerCase().includes(query);
  }).sort((firstTicket, secondTicket) => priorityRank[firstTicket.priority] - priorityRank[secondTicket.priority]), [allTickets, customerFilter, priorityFilter, search, statusFilter]);

  if (!selected) return <div className="w-full">{isTeam && showDashboard && <ProjectDashboard allTickets={allTickets} />}{showTickets && <div className={`${panel} grid place-items-center py-16 text-center`}>{loading ? <div className="w-full max-w-md space-y-3">{[0, 1, 2].map((i) => <div key={i} className="h-10 animate-pulse rounded-md bg-surface" />)}</div> : <div><p className="text-sm font-semibold">No orders yet</p><p className="mt-1 text-xs text-muted-foreground">{isTeam ? "Tickets created by customers will appear here." : "Book a service from the marketplace to see it here."}</p><Button className="mt-4" variant="outline" onClick={onBack}>Browse services</Button></div>}</div>}</div>;
  const selectedTicket = { ...selected, ...ticketUpdates[selected.id] };
  const currentStage = selectedTicket.status === "Closed" ? 3 : selectedTicket.status === "In Progress" ? 2 : selectedTicket.engineer !== "Unassigned" ? 1 : 0;
  const isAssigned = selectedTicket.engineer !== "Unassigned";
  const visitDate = selectedTicket.priority === "Urgent" ? "Immediate" : "24 Sep 2026";
  const visitTime = selectedTicket.priority === "Urgent" ? "On dispatch" : "10:00 AM";
  const selectedMessages = comments?.[selected.id] ?? { public: [], internal: [] };
  const unreadComments = selected.unreadComments && !readTicketIds.includes(selected.id) ? selected.unreadComments : 0;
  const selectTicket = (ticket) => {
    setSelected(ticket);
    setAssigneeName(ticket.engineer === "Unassigned" ? "" : ticket.engineer);
    setAssigneePhone(ticket.assigneePhone ?? "");
    setReadTicketIds((current) => current.includes(ticket.id) ? current : [...current, ticket.id]);
  };
  const updateTicket = async (update, action = "edit") => {
    if (
      isTeam &&
      ((action === "edit" && !canEditTickets) ||
        (action === "assignee" && !canAddAssignee) ||
        (action === "close" && !canCloseTicket))
    ) return false;
    setTicketUpdates((current) => ({ ...current, [selected.id]: { ...current[selected.id], ...update } }));
    const saved = await onUpdateTicket?.(selected.id, update, action);
    return saved !== false;
  };
  const recordCall = () => {
    updateTicket({ lastContact: "Customer called just now" });
    onComment?.(selected.id, "public", "We contacted the site POC to confirm access and visit availability.");
    onNotify?.({ title: "Ticket updated", detail: `${selected.id} · Customer call recorded` });
  };
  const send = () => {
    if (isTeam && !canEditTickets) return;
    if (!draft.trim()) return;
    onComment?.(selected.id, isTeam ? activeTab : "public", draft.trim());
    onNotify?.({ title: activeTab === "internal" ? "Internal note added" : "New public reply", detail: `${selected.id} · ${draft.trim()}` });
    setDraft("");
  };
  const addFiles = (event) => {
    if (isTeam && !canEditTickets) return;
    const files = Array.from(event.target.files ?? []);
    setAttachments((current) => [...files.map((file) => ({ name: file.name, type: "New upload", size: `${Math.max(file.size / 1024, 1).toFixed(0)} KB`, by: "You", time: "Now" })), ...current]);
    event.target.value = "";
  };

  return <div className="w-full">
    {isTeam && showDashboard && <ProjectDashboard allTickets={allTickets} />}
    {showTickets && <div className="grid gap-3 lg:grid-cols-[275px_minmax(0,1fr)]">
      <aside className={`${panel} h-fit max-h-[720px] overflow-hidden p-0 lg:sticky lg:top-20`}>
        <div className="border-b border-border p-4"><div><p className="text-sm font-semibold">{isTeam ? "Project queue" : "My orders"}</p><p className="mt-0.5 text-[10px] text-muted-foreground">{visibleTickets.length} visible {isTeam ? "tickets" : "orders"}</p></div><div className="mt-4 grid grid-cols-3 gap-1">{statuses.map(({ label, style }) => { const active = statusFilter === label; return <button key={label} type="button" onClick={() => setStatusFilter(active ? "All" : label)} className={`rounded-md border px-1 py-2 text-center text-[9px] font-semibold transition-colors ${style} ${active ? "ring-1 ring-current" : "hover:bg-surface"}`}><span className="block text-sm text-foreground">{counts[label]}</span>{label === "In Progress" ? "Pending" : label}</button>; })}</div>{isTeam && <div className="mt-3 border-t border-border pt-3"><p className="mb-2 text-[9px] font-semibold uppercase text-muted-foreground">Customer</p><select value={customerFilter} onChange={(event) => setCustomerFilter(event.target.value)} className="mb-3 h-8 w-full rounded-md border border-input bg-background px-2 text-xs">{customerOptions.map((customer) => <option key={customer}>{customer}</option>)}</select><p className="mb-2 text-[9px] font-semibold uppercase text-muted-foreground">Priority</p><div className="grid grid-cols-2 gap-1">{priorities.map((priority) => { const active = priorityFilter === priority; const style = priority === "Urgent" ? "border-destructive/30 bg-destructive/10 text-destructive" : priority === "High" ? "border-warning/30 bg-warning/10 text-warning" : priority === "Medium" ? "border-primary/30 bg-primary/10 text-primary" : "border-success/30 bg-success/10 text-success"; return <button key={priority} type="button" onClick={() => setPriorityFilter(active ? "All" : priority)} className={`rounded-md border px-2 py-1.5 text-left text-[10px] font-semibold ${style} ${active ? "ring-1 ring-current" : "hover:bg-surface"}`}><span>{priority}</span><span className="float-right">{priorityCounts[priority]}</span></button>; })}</div></div>}<div className="relative mt-3"><Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search order ID or site" className="h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 text-xs outline-none focus:border-ring" /></div></div>
        <div className="max-h-[650px] overflow-y-auto">{visibleTickets.map((ticket) => { const ticketUnreadComments = ticket.unreadComments && !readTicketIds.includes(ticket.id) ? ticket.unreadComments : 0; const priorityStyle = ticket.priority === "Urgent" ? "bg-destructive/10 text-destructive" : ticket.priority === "High" ? "bg-warning/15 text-warning" : ticket.priority === "Medium" ? "bg-primary/15 text-primary" : "bg-success/15 text-success"; return <button key={ticket.id} type="button" onClick={() => selectTicket(ticket)} className={`w-full border-b border-border p-4 text-left transition-colors ${selected.id === ticket.id ? "bg-primary/10 shadow-[inset_3px_0_0_var(--color-primary)]" : "hover:bg-surface"}`}><div className="flex items-center justify-between gap-2"><p className="text-[11px] font-semibold text-primary">{ticket.id}</p><span className={`rounded px-1.5 py-0.5 text-[9px] font-semibold ${ticket.status === "Closed" ? "bg-success/15 text-success" : ticket.status === "Open" ? "bg-warning/15 text-warning" : "bg-primary/15 text-primary"}`}>{ticket.status}</span></div><p className="mt-2 text-xs font-semibold leading-5">{ticket.title}</p><div className="mt-3 flex items-center justify-between text-[10px] text-muted-foreground"><span className={`rounded px-1.5 py-0.5 font-semibold ${priorityStyle}`}>{ticket.priority}</span><span className="flex items-center gap-1">{ticketUnreadComments > 0 && <span className="inline-flex items-center gap-1 rounded bg-primary px-1.5 py-0.5 font-semibold text-primary-foreground"><MessageSquare className="h-2.5 w-2.5" />{ticketUnreadComments}</span>}{ticket.updated}</span></div></button>; })}{!visibleTickets.length && <p className="p-8 text-center text-xs text-muted-foreground">No tickets match this view.</p>}</div>
      </aside>

      <div className="min-w-0 space-y-4">
        <section className={`${panel} overflow-hidden p-0`}>
          <header className="border-b border-border p-3"><div className="flex flex-wrap items-center gap-2"><p className="text-[10px] font-bold uppercase text-primary">{selectedTicket.id}</p><span className="rounded bg-warning/15 px-2 py-0.5 text-[10px] font-semibold text-warning">{selectedTicket.priority}</span></div><h2 className="mt-1 text-sm font-semibold">{selectedTicket.title}</h2><p className="mt-1 text-[11px] text-muted-foreground">{selectedTicket.customer} · {selectedTicket.city} · Owner: {selectedTicket.engineer}</p></header>
          <div className="border-b border-border px-4 py-3"><p className="text-[9px] font-semibold uppercase text-muted-foreground">Order status</p><div className="mt-3 grid grid-cols-4 gap-1 sm:gap-3">{orderStages.map((stage, index) => <div key={stage} className="min-w-0 text-center"><span className={`mx-auto grid h-7 w-7 place-items-center rounded-full border text-[10px] font-semibold ${index <= currentStage ? "border-success bg-success text-success-foreground" : "border-border bg-surface text-muted-foreground"}`}>{index < currentStage ? <CheckCircle2 className="h-3.5 w-3.5" /> : index + 1}</span><p className={`mt-1.5 truncate text-[9px] font-medium ${index === currentStage ? "text-foreground" : "text-muted-foreground"}`}>{stage}</p></div>)}</div></div>
          <div className="grid border-b border-border sm:grid-cols-4">{[["Status", selectedTicket.status], ["SLA remaining", "01h 42m"], ["Assigned to", selectedTicket.engineer], ["Progress", `${selectedTicket.progress}%`]].map(([label, value]) => <div key={label} className="border-b border-border p-2.5 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0"><p className="text-[9px] uppercase text-muted-foreground">{label}</p><p className="mt-1 truncate text-[11px] font-semibold">{value}</p>{label === "Progress" && <div className="mt-2 h-1 overflow-hidden rounded-full bg-surface"><div className="h-full bg-primary" style={{ width: `${selectedTicket.progress}%` }} /></div>}</div>)}</div>
          <div className="grid gap-3 border-b border-border p-4 xl:grid-cols-[minmax(0,1fr)_280px]">
            <div className={`rounded-md border p-4 ${isAssigned ? "border-success/30 bg-success/5" : "border-warning/30 bg-warning/5"}`}><div className="flex gap-3"><span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${isAssigned ? "bg-success/15 text-success" : "bg-warning/15 text-warning"}`}>{isAssigned ? <CheckCircle2 className="h-5 w-5" /> : <UserRound className="h-5 w-5" />}</span><div><p className={`text-sm font-semibold ${isAssigned ? "text-success" : "text-warning"}`}>{isAssigned ? "Engineer assigned" : "Assignment pending"}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{isAssigned ? `${selectedTicket.engineer} is assigned. Service updates will appear on this order.` : "The project team is matching your request with the nearest qualified engineer."}</p></div></div><p className="mt-3 border-t border-border/60 pt-3 text-[11px] text-muted-foreground">{isAssigned ? "Estimated arrival" : "Estimated assignment"}<strong className="ml-2 text-primary">{isAssigned ? "30 minutes" : "15-20 minutes"}</strong></p></div>
            <div><p className="mb-2 text-[10px] font-semibold uppercase text-muted-foreground">Visit information</p><div className="grid grid-cols-3 gap-2"><OrderMetric icon={CalendarDays} label="Visit date" value={visitDate} /><OrderMetric icon={Clock3} label="Visit time" value={visitTime} /><OrderMetric icon={MapPin} label="Location" value={selectedTicket.city} /></div></div>
          </div>
          {selectedTicket.dbId && <div className="flex justify-end border-b border-border px-4 py-2"><Link to="/invoice/$id" params={{ id: selectedTicket.dbId }} className="text-xs font-semibold text-primary hover:underline">View invoice &amp; payments</Link></div>}
          {!isTeam && selectedTicket.status === "Closed" && selectedTicket.dbId && <RateJob dbId={selectedTicket.dbId} rated={selectedTicket.rating} />}
          {isTeam && canAddAssignee && (
            <div className="grid gap-3 border-b border-border p-4 md:grid-cols-[1fr_1fr_auto]">
              <label>
                <span className="mb-1 block text-[10px] font-semibold uppercase text-muted-foreground">Assignee name</span>
                <input value={assigneeName} onChange={(event) => setAssigneeName(event.target.value)} placeholder="Engineer name" className="h-9 w-full rounded-md border border-input bg-background px-3 text-xs outline-none focus:border-ring" />
              </label>
              <label>
                <span className="mb-1 block text-[10px] font-semibold uppercase text-muted-foreground">Assignee phone no</span>
                <input value={assigneePhone} onChange={(event) => setAssigneePhone(event.target.value)} placeholder="Phone number" className="h-9 w-full rounded-md border border-input bg-background px-3 text-xs outline-none focus:border-ring" />
              </label>
              <Button className="self-end" size="sm" onClick={async () => {
                const saved = await updateTicket({
                  engineer: assigneeName.trim() || "Unassigned",
                  assigneePhone: assigneePhone.trim(),
                  status: assigneeName.trim() ? "In Progress" : selectedTicket.status,
                  progress: assigneeName.trim() ? Math.max(selectedTicket.progress, 45) : selectedTicket.progress,
                }, "assignee");
                if (saved) {
                  onNotify?.({ title: "Assignee updated", detail: `${selected.id} · ${assigneeName.trim() || "Unassigned"}` });
                }
              }}>
                <Users />Save assignee
              </Button>
            </div>
          )}
          {isAssigned && <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3"><span className="grid h-10 w-10 place-items-center rounded-full bg-primary/10 text-primary"><UserRound className="h-5 w-5" /></span><div className="min-w-[150px] flex-1"><p className="text-xs font-semibold">{selectedTicket.engineer} <BadgeCheck className="inline h-3.5 w-3.5 text-primary" /></p><p className="mt-1 text-[10px] text-muted-foreground">Field engineer · 4.8 rating · 7 years experience</p></div><Button size="sm" variant="outline"><Phone />Contact engineer</Button></div>}
          {isTeam && (canEditTickets || canAddAssignee || canCloseTicket) && (
            <div className="flex flex-wrap gap-2 border-b border-border p-3">
              {canEditTickets && (
                <Button size="sm" variant="outline" onClick={recordCall}>
                  <Phone />Record customer call
                </Button>
              )}
              {canAddAssignee && (
                <Button size="sm" variant="outline" onClick={async () => {
                  setAssigneeName("Rajesh Kumar");
                  const saved = await updateTicket({ engineer: "Rajesh Kumar", status: "In Progress", progress: 45 }, "assignee");
                  if (saved) onNotify?.({ title: "Engineer assigned", detail: `${selected.id} · Rajesh Kumar` });
                }}>
                  <Users />Assign engineer
                </Button>
              )}
              {canCloseTicket && selectedTicket.status !== "Closed" && (
                <Button size="sm" onClick={async () => {
                  const saved = await updateTicket({ status: "Closed", progress: 100 }, "close");
                  if (saved) onNotify?.({ title: "Ticket closed", detail: `${selected.id} · Completed` });
                }}>
                  <CheckCircle2 />Close ticket
                </Button>
              )}
            </div>
          )}
          {(activeTab === "public" || (isTeam && activeTab === "internal")) && <Conversation channel={activeTab} messages={selectedMessages[activeTab]} draft={draft} setDraft={setDraft} onSend={send} onAttach={() => fileInputRef.current?.click()} activeTab={activeTab} setActiveTab={setActiveTab} attachments={attachments} isTeam={isTeam} canEdit={!isTeam || canEditTickets} />}

          {activeTab === "attachments" && <div className="flex min-h-[554px] flex-col p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-sm font-semibold">Ticket attachments</h3><p className="mt-1 text-xs text-muted-foreground">Photos, work orders, reports, and customer documents.</p></div>{(!isTeam || canEditTickets) && <Button onClick={() => fileInputRef.current?.click()}><Paperclip />Upload files</Button>}</div><div className="mt-5 divide-y divide-border rounded-md border border-border">{attachments.map((file, index) => <div key={`${file.name}-${index}`} className="flex items-center gap-3 p-4"><div className="grid h-10 w-10 place-items-center rounded-md bg-primary/10 text-primary"><FileText className="h-4 w-4" /></div><div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold">{file.name}</p><p className="mt-1 text-[10px] text-muted-foreground">{file.type} · {file.size} · {file.by} · {file.time}</p></div><Button size="icon" variant="ghost" aria-label={`Download ${file.name}`}><Download /></Button></div>)}</div><div className="mt-auto border-t border-border pt-2"><TicketTabs activeTab={activeTab} setActiveTab={setActiveTab} attachments={attachments} isTeam={isTeam} /></div></div>}

          <input ref={fileInputRef} type="file" multiple className="hidden" onChange={addFiles} />
        </section>

      </div>

    </div>}
  </div>;
}
