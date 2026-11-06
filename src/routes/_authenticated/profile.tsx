import { useEffect } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  ArrowLeft,
  Building2,
  Mail,
  MapPin,
  Phone,
  Save,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { authService } from "@/services/authService";
import { userService, userRoleNamesQuery } from "@/services/userService";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "Profile & security | Last Mile Connect" },
      { name: "description", content: "Manage your Last Mile Connect profile and password." },
      { property: "og:title", content: "Profile — Last Mile Connect" },
      { property: "og:description", content: "Manage your profile and password." },
    ],
  }),
  component: ProfilePage,
});

const profileSchema = z.object({
  full_name: z.string().trim().min(2, "Enter your name").max(100),
  company: z.string().trim().max(120),
  phone: z
    .string()
    .trim()
    .regex(/^(\+?[0-9 ]{8,16})?$/, "Enter a valid phone number"),
  address: z.string().trim().max(300),
});
const passwordSchema = z
  .object({
    current: z.string().min(1, "Enter your current password"),
    password: z.string().min(8, "At least 8 characters"),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { message: "Passwords don't match", path: ["confirm"] });

function ProfilePage() {
  const { userId, email, profile, session } = useAuth();
  const provider: unknown = session?.user.app_metadata["provider"];
  const signInMethod =
    provider === "email"
      ? "Email/password"
      : provider === "google"
        ? "Google"
        : typeof provider === "string" && provider
          ? provider.charAt(0).toUpperCase() + provider.slice(1)
          : "Unavailable";
  const roleNames = useQuery(userRoleNamesQuery(userId));
  const qc = useQueryClient();
  const form = useForm<z.infer<typeof profileSchema>>({ resolver: zodResolver(profileSchema) });
  const pw = useForm<z.infer<typeof passwordSchema>>({ resolver: zodResolver(passwordSchema) });

  useEffect(() => {
    if (profile)
      form.reset({
        full_name: profile.full_name ?? "",
        company: profile.company ?? "",
        phone: profile.phone ?? "",
        address: profile.address ?? "",
      });
  }, [profile, form]);

  const save = useMutation({
    mutationFn: (v: z.infer<typeof profileSchema>) => userService.updateProfile(userId!, v),
    onMutate: async (v) => {
      const key = ["profile", userId];
      const prev = qc.getQueryData(key);
      qc.setQueryData(key, (old: object | undefined) => ({ ...old, ...v }));
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      qc.setQueryData(["profile", userId], ctx?.prev);
      toast.error("Could not save your profile.");
    },
    onSuccess: () => toast.success("Profile saved."),
    onSettled: () => qc.invalidateQueries({ queryKey: ["profile", userId] }),
  });

  const changePassword = pw.handleSubmit(async (v) => {
    const { error } = await authService.changePassword(v.current, v.password);
    if (error) {
      toast.error(error.message);
      return;
    }
    pw.reset({ current: "", password: "", confirm: "" });
    toast.success("Password changed.");
  });

  const e = form.formState.errors;
  const displayName = profile?.full_name || "Your profile";
  const initials = displayName
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
  return (
    <div className="min-h-screen bg-background px-4 py-6 sm:px-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <Button asChild variant="ghost">
          <Link to="/">
            <ArrowLeft />
            Back to marketplace
          </Link>
        </Button>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">
            Your account
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
            Profile & security
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage your personal information and keep your account secure.
          </p>
        </div>

        <div className="grid items-start gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="overflow-hidden rounded-xl border border-border bg-card">
            <div className="h-20 bg-primary/10" />
            <div className="px-5 pb-5">
              <div className="-mt-8 grid h-16 w-16 place-items-center rounded-xl border-4 border-card bg-primary text-xl font-semibold text-primary-foreground">
                {initials}
              </div>
              <h2 className="mt-3 break-words text-lg font-semibold">{displayName}</h2>
              <p className="mt-1 break-all text-xs text-muted-foreground">{email}</p>
              <div className="mt-4 flex flex-wrap gap-2" aria-label="Assigned roles">
                {roleNames.isLoading ? (
                  <span className="text-xs text-muted-foreground">Loading roles...</span>
                ) : roleNames.isError ? (
                  <span role="alert" className="text-xs text-destructive">
                    Could not load roles
                  </span>
                ) : roleNames.data?.length ? (
                  roleNames.data.map((name) => (
                    <span
                      key={name}
                      className="rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary"
                    >
                      {name}
                    </span>
                  ))
                ) : (
                  <span className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                    No role assigned
                  </span>
                )}
              </div>
              {roleNames.isError && (
                <button className="text-sm underline" onClick={() => void roleNames.refetch()}>
                  Retry loading roles
                </button>
              )}
              <div className="mt-5 space-y-3 border-t border-border pt-4 text-xs">
                <p className="flex items-start gap-2">
                  <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="break-words">{profile?.company || "Company not added"}</span>
                </p>
                <p className="flex items-start gap-2">
                  <Phone className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span>{profile?.phone || "Phone not added"}</span>
                </p>
                <p className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="break-words">{profile?.address || "Address not added"}</span>
                </p>
              </div>
            </div>
          </aside>

          <div className="min-w-0 space-y-6">
            <form
              onSubmit={form.handleSubmit((v) => save.mutate(v))}
              className="space-y-5 rounded-xl border border-border bg-card p-4 sm:p-6"
              noValidate
            >
              <div className="flex items-center gap-3 border-b border-border pb-4">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                  <UserRound className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="font-semibold">Personal details</h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Your contact information and default site address.
                  </p>
                </div>
              </div>
              {!profile ? (
                <div className="space-y-3">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="h-9 animate-pulse rounded-md bg-surface" />
                  ))}
                </div>
              ) : (
                <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="full_name">Full name</Label>
                      <Input id="full_name" {...form.register("full_name")} />
                      {e.full_name && (
                        <p className="text-xs text-destructive">{e.full_name.message}</p>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="profile-email">Email address</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="profile-email"
                          value={email ?? ""}
                          readOnly
                          className="bg-muted/40 pl-9 text-muted-foreground"
                        />
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        Your sign-in email cannot be changed here.
                      </p>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="company">Company</Label>
                      <Input id="company" {...form.register("company")} />
                      {e.company && <p className="text-xs text-destructive">{e.company.message}</p>}
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="phone">Phone</Label>
                      <Input id="phone" type="tel" {...form.register("phone")} />
                      {e.phone && <p className="text-xs text-destructive">{e.phone.message}</p>}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="address">Default site address</Label>
                    <Textarea id="address" rows={2} {...form.register("address")} />
                    {e.address && <p className="text-xs text-destructive">{e.address.message}</p>}
                  </div>
                  <div className="flex justify-end border-t border-border pt-4">
                    <Button type="submit" disabled={save.isPending}>
                      <Save className="h-4 w-4" />
                      {save.isPending ? "Saving…" : "Save profile"}
                    </Button>
                  </div>
                </>
              )}
            </form>

            <form
              onSubmit={changePassword}
              className="space-y-5 rounded-xl border border-border bg-card p-4 sm:p-6"
              noValidate
            >
              <div className="flex items-center gap-3 border-b border-border pb-4">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                  <ShieldCheck className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="font-semibold">Security</h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Choose a strong password to protect your account.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-3">
                <span className="text-xs text-muted-foreground">Sign-in method</span>
                <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                  {signInMethod}
                </span>
              </div>
           
           
              <div className="space-y-1.5">
                <Label htmlFor="current">Current password</Label>
                <Input
                  id="current"
                  type="password"
                  autoComplete="current-password"
                  {...pw.register("current")}
                />
                {pw.formState.errors.current && (
                  <p className="text-xs text-destructive">{pw.formState.errors.current.message}</p>
                )}
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="npw">New password</Label>
                  <Input
                    id="npw"
                    type="password"
                    autoComplete="new-password"
                    {...pw.register("password")}
                  />
                  {pw.formState.errors.password && (
                    <p className="text-xs text-destructive">
                      {pw.formState.errors.password.message}
                    </p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cpw">Confirm new password</Label>
                  <Input
                    id="cpw"
                    type="password"
                    autoComplete="new-password"
                    {...pw.register("confirm")}
                  />
                  {pw.formState.errors.confirm && (
                    <p className="text-xs text-destructive">
                      {pw.formState.errors.confirm.message}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex justify-end border-t border-border pt-4">
                <Button type="submit" variant="outline" disabled={pw.formState.isSubmitting}>
                  <ShieldCheck className="h-4 w-4" />
                  {pw.formState.isSubmitting ? "Updating..." : "Update password"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
