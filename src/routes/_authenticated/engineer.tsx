import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { ArrowLeft, BadgeCheck, Clock3, IndianRupee, MapPin, Navigation, Star, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/hooks/use-auth";
import { computeEarnings, engineerService, myEngineerQuery, myJobsQuery, payoutShareQuery, useEngineerRealtime, type Engineer, type Job } from "@/services/engineerService";

export const Route = createFileRoute("/_authenticated/engineer")({
  head: () => ({
    meta: [
      { title: "Engineer portal | Last Mile Connect" },
      { name: "description", content: "Field engineers manage jobs, availability, earnings and ratings." },
      { property: "og:title", content: "Engineer portal — Last Mile Connect" },
      { property: "og:description", content: "Jobs, availability, earnings and ratings for field engineers." },
    ],
  }),
  component: EngineerPortal,
});

const inr = (n: number) => `₹ ${Math.round(n).toLocaleString("en-IN")}`;

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <Button asChild variant="ghost"><Link to="/"><ArrowLeft />Back to marketplace</Link></Button>
        {children}
      </div>
    </div>
  );
}

function EngineerPortal() {
  const { userId, profile } = useAuth();
  const me = useQuery(myEngineerQuery(userId));
  useEngineerRealtime(userId ?? "anon");

  if (me.isLoading) return <Shell><div className="h-40 animate-pulse rounded-lg bg-surface" /></Shell>;
  if (me.isError) return <Shell><p className="text-sm text-destructive">Could not load your engineer profile. <button className="underline" onClick={() => me.refetch()}>Retry</button></p></Shell>;
  if (!me.data) return <Shell><Register defaults={{ full_name: profile?.full_name ?? "", phone: profile?.phone ?? "" }} /></Shell>;
  if (me.data.approval_status !== "approved")
    return (
      <Shell>
        <div className="rounded-lg border border-border bg-card p-6">
          <h1 className="text-xl font-semibold">Application {me.data.approval_status}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {me.data.approval_status === "pending" ? "Our operations team is reviewing your profile. You'll get a notification once approved." : "Contact operations for details about your engineer profile."}
          </p>
        </div>
      </Shell>
    );
  return <Shell><Dashboard engineer={me.data} /></Shell>;
}

const registerSchema = z.object({
  full_name: z.string().trim().min(2, "Enter your name").max(100),
  phone: z.string().trim().regex(/^\+?[0-9 ]{8,16}$/, "Enter a valid phone"),
  grade: z.enum(["L1", "L2"]),
  mode: z.enum(["Active", "Passive", "Both"]),
  city: z.string().trim().min(2, "Enter your base city").max(60),
  kit: z.string().trim().max(200),
});

function Register({ defaults }: { defaults: { full_name: string; phone: string } }) {
  const { userId } = useAuth();
  const qc = useQueryClient();
  const form = useForm<z.infer<typeof registerSchema>>({ resolver: zodResolver(registerSchema), defaultValues: { ...defaults, grade: "L1", mode: "Both", city: "", kit: "" } });
  const submit = form.handleSubmit(async (v) => {
    try {
      await engineerService.apply(userId!, v);
      toast.success("Application submitted.");
      qc.invalidateQueries({ queryKey: ["engineer", "me", userId] });
    } catch { toast.error("Could not submit your application."); }
  });
  const e = form.formState.errors;
  const sel = "h-9 w-full rounded-md border border-input bg-background px-3 text-sm";
  return (
    <form onSubmit={submit} className="space-y-4 rounded-lg border border-border bg-card p-6" noValidate>
      <div><h1 className="text-2xl font-semibold">Register as a field engineer</h1><p className="mt-1 text-sm text-muted-foreground">Operations will review and approve your profile before jobs are assigned.</p></div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5"><Label htmlFor="full_name">Full name</Label><Input id="full_name" {...form.register("full_name")} />{e.full_name && <p className="text-xs text-destructive">{e.full_name.message}</p>}</div>
        <div className="space-y-1.5"><Label htmlFor="phone">Phone</Label><Input id="phone" type="tel" {...form.register("phone")} />{e.phone && <p className="text-xs text-destructive">{e.phone.message}</p>}</div>
        <div className="space-y-1.5"><Label htmlFor="grade">Grade</Label><select id="grade" className={sel} {...form.register("grade")}><option value="L1">L1 Engineer</option><option value="L2">L2 Engineer</option></select></div>
        <div className="space-y-1.5"><Label htmlFor="mode">Work type</Label><select id="mode" className={sel} {...form.register("mode")}><option>Active</option><option>Passive</option><option>Both</option></select></div>
        <div className="space-y-1.5"><Label htmlFor="city">Base city</Label><Input id="city" placeholder="Pune" {...form.register("city")} />{e.city && <p className="text-xs text-destructive">{e.city.message}</p>}</div>
        <div className="space-y-1.5"><Label htmlFor="kit">Tool kit / vehicle</Label><Input id="kit" placeholder="Splicer, OTDR, bike" {...form.register("kit")} /></div>
      </div>
      <Button type="submit" disabled={form.formState.isSubmitting}>Submit application</Button>
    </form>
  );
}

function Stat({ icon: Icon, label, value }: { icon: typeof Star; label: string; value: string }) {
  return <div className="rounded-lg border border-border bg-card p-4"><Icon className="h-5 w-5 text-primary" /><p className="mt-2 text-lg font-semibold">{value}</p><p className="text-xs text-muted-foreground">{label}</p></div>;
}

function Dashboard({ engineer }: { engineer: Engineer }) {
  const qc = useQueryClient();
  const jobs = useQuery(myJobsQuery(engineer.id));
  const share = useQuery(payoutShareQuery).data ?? 0.6;
  const [tab, setTab] = useState<"active" | "history">("active");
  const list = jobs.data ?? [];
  const active = list.filter((j) => j.status === "Open" || j.status === "In Progress");
  const history = list.filter((j) => j.status === "Closed" || j.status === "Cancelled");
  const earnings = computeEarnings(list, share);

  const toggle = useMutation({
    mutationFn: (v: boolean) => engineerService.setMyAvailability(v),
    onMutate: (v) => qc.setQueryData(["engineer", "me", engineer.user_id], { ...engineer, available: v }),
    onError: () => { toast.error("Could not update availability."); qc.invalidateQueries({ queryKey: ["engineer"] }); },
  });
  const action = useMutation({
    mutationFn: (a: { id: string; action: "start" | "complete" }) => engineerService.jobAction(a.id, a.action),
    onSuccess: (_d, a) => { toast.success(a.action === "start" ? "Job started" : "Job completed"); qc.invalidateQueries({ queryKey: ["engineer", "jobs", engineer.id] }); },
    onError: () => toast.error("That job can't be updated right now."),
  });

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase text-primary">Engineer portal</p>
          <h1 className="mt-1 text-2xl font-semibold">{engineer.full_name}</h1>
          <p className="text-sm text-muted-foreground">{engineer.grade} · {engineer.mode} · {engineer.city}{engineer.kit ? ` · ${engineer.kit}` : ""}</p>
        </div>
        <label className="flex items-center gap-3 rounded-md border border-border bg-card px-3 py-2 text-sm">
          <Switch checked={engineer.available} onCheckedChange={(v) => toggle.mutate(v)} aria-label="Available for jobs" />
          {engineer.available ? "Available for jobs" : "Offline"}
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-4">
        <Stat icon={Wrench} label="Active jobs" value={String(active.length)} />
        <Stat icon={BadgeCheck} label="Completed" value={String(earnings.completed)} />
        <Stat icon={IndianRupee} label={`Earnings (${Math.round(share * 100)}% share)`} value={inr(earnings.payout)} />
        <Stat icon={Star} label={`Rating (${engineer.ratings_count})`} value={engineer.ratings_count ? Number(engineer.rating).toFixed(1) : "—"} />
      </div>
      <div className="flex gap-2">
        <Button size="sm" variant={tab === "active" ? "default" : "outline"} onClick={() => setTab("active")}>Active trips ({active.length})</Button>
        <Button size="sm" variant={tab === "history" ? "default" : "outline"} onClick={() => setTab("history")}>Trip history ({history.length})</Button>
      </div>
      {jobs.isLoading ? (
        <div className="space-y-3">{[0, 1].map((i) => <div key={i} className="h-24 animate-pulse rounded-lg bg-surface" />)}</div>
      ) : (tab === "active" ? active : history).length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-10 text-center text-sm text-muted-foreground">{tab === "active" ? "No active jobs. New assignments appear here instantly." : "No completed jobs yet."}</div>
      ) : (
        <div className="space-y-3">
          {(tab === "active" ? active : history).map((j) => <JobCard key={j.id} job={j} busy={action.isPending} onAction={(a) => action.mutate({ id: j.id, action: a })} />)}
        </div>
      )}
    </>
  );
}

function JobCard({ job, busy, onAction }: { job: Job; busy: boolean; onAction: (a: "start" | "complete") => void }) {
  const place = [job.site_address, job.city].filter(Boolean).join(", ");
  return (
    <div className="flex flex-wrap items-center gap-4 rounded-lg border border-border bg-card p-4">
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-bold uppercase text-primary">{job.ticket_no} · {job.priority}</p>
        <p className="mt-1 font-semibold">{job.title}</p>
        <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="h-3.5 w-3.5" />{place || "Site address shared by operations"}{job.customer_name ? ` · ${job.customer_name}` : ""}</p>
        {job.customer_rating && <p className="mt-1 flex items-center gap-1 text-xs"><Star className="h-3.5 w-3.5 text-warning" />{job.customer_rating}/5 from customer</p>}
      </div>
      <span className="flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-xs"><Clock3 className="h-3 w-3" />{job.status}</span>
      {place && (
        <Button asChild size="sm" variant="outline">
          <a href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(place)}`} target="_blank" rel="noreferrer"><Navigation />Route</a>
        </Button>
      )}
      {job.status === "Open" && <Button size="sm" disabled={busy} onClick={() => onAction("start")}>Start job</Button>}
      {job.status === "In Progress" && <Button size="sm" disabled={busy} onClick={() => onAction("complete")}>Mark complete</Button>}
    </div>
  );
}
