import { useEffect } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { authService, ROLE_LABELS } from "@/services/authService";
import { userService } from "@/services/userService";

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
  phone: z.string().trim().regex(/^(\+?[0-9 ]{8,16})?$/, "Enter a valid phone number"),
  address: z.string().trim().max(300),
});
const passwordSchema = z
  .object({ current: z.string().min(1, "Enter your current password"), password: z.string().min(8, "At least 8 characters"), confirm: z.string() })
  .refine((v) => v.password === v.confirm, { message: "Passwords don't match", path: ["confirm"] });

function ProfilePage() {
  const { userId, email, profile, roles } = useAuth();
  const qc = useQueryClient();
  const form = useForm<z.infer<typeof profileSchema>>({ resolver: zodResolver(profileSchema) });
  const pw = useForm<z.infer<typeof passwordSchema>>({ resolver: zodResolver(passwordSchema) });

  useEffect(() => {
    if (profile) form.reset({ full_name: profile.full_name ?? "", company: profile.company ?? "", phone: profile.phone ?? "", address: profile.address ?? "" });
  }, [profile, form]);

  const save = useMutation({
    mutationFn: (v: z.infer<typeof profileSchema>) => userService.updateProfile(userId!, v),
    onMutate: async (v) => {
      const key = ["profile", userId];
      const prev = qc.getQueryData(key);
      qc.setQueryData(key, (old: object | undefined) => ({ ...old, ...v }));
      return { prev };
    },
    onError: (_e, _v, ctx) => { qc.setQueryData(["profile", userId], ctx?.prev); toast.error("Could not save your profile."); },
    onSuccess: () => toast.success("Profile saved."),
    onSettled: () => qc.invalidateQueries({ queryKey: ["profile", userId] }),
  });

  const changePassword = pw.handleSubmit(async (v) => {
    const { error } = await authService.changePassword(v.current, v.password);
    if (error) { toast.error(error.message); return; }
    pw.reset({ current: "", password: "", confirm: "" });
    toast.success("Password changed.");
  });

  const e = form.formState.errors;
  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto max-w-2xl space-y-6">
        <Button asChild variant="ghost"><Link to="/"><ArrowLeft />Back to marketplace</Link></Button>
        <div>
          <h1 className="text-2xl font-semibold">Profile & security</h1>
          <p className="mt-1 text-sm text-muted-foreground">{email} · {roles.map((r) => ROLE_LABELS[r]).join(", ")}</p>
        </div>

        <form onSubmit={form.handleSubmit((v) => save.mutate(v))} className="space-y-4 rounded-lg border border-border bg-card p-6" noValidate>
          <h2 className="font-semibold">Profile</h2>
          {!profile ? (
            <div className="space-y-3">{[0, 1, 2].map((i) => <div key={i} className="h-9 animate-pulse rounded-md bg-surface" />)}</div>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5"><Label htmlFor="full_name">Full name</Label><Input id="full_name" {...form.register("full_name")} />{e.full_name && <p className="text-xs text-destructive">{e.full_name.message}</p>}</div>
                <div className="space-y-1.5"><Label htmlFor="company">Company</Label><Input id="company" {...form.register("company")} /></div>
                <div className="space-y-1.5"><Label htmlFor="phone">Phone</Label><Input id="phone" type="tel" {...form.register("phone")} />{e.phone && <p className="text-xs text-destructive">{e.phone.message}</p>}</div>
              </div>
              <div className="space-y-1.5"><Label htmlFor="address">Default site address</Label><Textarea id="address" rows={2} {...form.register("address")} /></div>
              <Button type="submit" disabled={save.isPending}>{save.isPending ? "Saving…" : "Save profile"}</Button>
            </>
          )}
        </form>

        <form onSubmit={changePassword} className="space-y-4 rounded-lg border border-border bg-card p-6" noValidate>
          <h2 className="font-semibold">Change password</h2>
          <p className="text-xs text-muted-foreground">Signed in with Google or Lovable? Use "Forgot password" on the sign-in page to set one first.</p>
          <div className="space-y-1.5"><Label htmlFor="current">Current password</Label><Input id="current" type="password" autoComplete="current-password" {...pw.register("current")} />{pw.formState.errors.current && <p className="text-xs text-destructive">{pw.formState.errors.current.message}</p>}</div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5"><Label htmlFor="npw">New password</Label><Input id="npw" type="password" autoComplete="new-password" {...pw.register("password")} />{pw.formState.errors.password && <p className="text-xs text-destructive">{pw.formState.errors.password.message}</p>}</div>
            <div className="space-y-1.5"><Label htmlFor="cpw">Confirm</Label><Input id="cpw" type="password" autoComplete="new-password" {...pw.register("confirm")} />{pw.formState.errors.confirm && <p className="text-xs text-destructive">{pw.formState.errors.confirm.message}</p>}</div>
          </div>
          <Button type="submit" variant="outline" disabled={pw.formState.isSubmitting}>Update password</Button>
        </form>
      </div>
    </div>
  );
}
