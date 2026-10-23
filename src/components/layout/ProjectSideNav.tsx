// @ts-nocheck
import { BarChart3, ClipboardList, CreditCard, Plus, UsersRound } from "lucide-react";
import { Button } from "@/components/ui/button";

const items = [
  { id: "dashboard", label: "Dashboard", icon: BarChart3 },
  { id: "tickets", label: "Tickets", icon: ClipboardList },
  { id: "roles", label: "Role management", icon: UsersRound },
  { id: "payment", label: "Payment", icon: CreditCard },
];

export function ProjectSideNav({ activeSection, onSectionChange, onCreateTicket }) {
  return <aside className="sticky top-16 hidden h-[calc(100vh-4rem)] w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar p-3 text-sidebar-foreground md:flex"><div className="border-b border-sidebar-border px-2 pb-4"><p className="text-[10px] font-bold uppercase text-primary">Project workspace</p><p className="mt-1 text-xs text-muted-foreground">Service operations</p></div><nav className="mt-3 flex flex-col gap-1">{items.map(({ id, label, icon: Icon }) => <Button key={id} type="button" variant="ghost" onClick={() => onSectionChange(id)} className={`h-10 justify-start px-3 text-xs ${activeSection === id ? "bg-primary/15 text-foreground shadow-[inset_2px_0_0_0_var(--color-primary)]" : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"}`}><Icon className={`h-4 w-4 ${activeSection === id ? "text-primary" : ""}`} />{label}</Button>)}</nav><div className="mt-4 border-t border-sidebar-border pt-4"><Button className="w-full" onClick={onCreateTicket}><Plus />Create ticket</Button><p className="mt-2 px-1 text-[10px] leading-4 text-muted-foreground">Adds a sample ticket with a different service scenario and priority.</p></div></aside>;
}