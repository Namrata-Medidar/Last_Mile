import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import "@lovable.dev/cloud-auth-js/styles.css";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { authService, safeRedirect } from "@/services/authService";
import { generate_token } from "@/services/tokenService";

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>): { redirect?: string } => (typeof s["redirect"] === "string" ? { redirect: s["redirect"] } : {}),
  head: () => ({
    meta: [
      { title: "Sign in | Last Mile Connect" },
      { name: "description", content: "Sign in or create a Last Mile Connect account to book and track telecom field services." },
      { property: "og:title", content: "Sign in to Last Mile Connect" },
      { property: "og:description", content: "Access bookings, tracking and your service history." },
    ],
  }),
  component: AuthPage,
});

const signInSchema = z.object({ email: z.string().trim().email("Enter a valid email"), password: z.string().min(1, "Enter your password") });
const signUpSchema = z.object({
  fullName: z.string().trim().min(2, "Enter your name").max(100),
  company: z.string().trim().min(2, "Enter your company").max(120),
  phone: z.string().trim().regex(/^\+?[0-9 ]{8,16}$/, "Enter a valid phone number"),
  email: z.string().trim().email("Enter a valid email").max(255),
  password: z.string().min(8, "At least 8 characters"),
});
const forgotSchema = z.object({ email: z.string().trim().email("Enter a valid email") });

type Mode = "signin" | "signup" | "forgot";

function Field({ id, label, error, ...props }: { id: string; label: string; error?: string | undefined } & React.ComponentProps<typeof Input>) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} aria-invalid={!!error} {...props} />
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

function AuthPage() {
  const [mode, setMode] = useState<Mode>("signin");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const { userId } = useAuth();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const target = safeRedirect(search.redirect ? new URL(search.redirect, "http://x").pathname : "/");

  useEffect(() => {
    if (userId) navigate({ to: target, replace: true });
  }, [userId, target, navigate]);

  const social = async (provider: "google" | "lovable") => {
    const result = await authService.signInWith(provider);
    if (result.error) toast.error("Sign-in failed. Please try again.");
  };

  return (
    <div className="grid min-h-screen place-items-center bg-background px-4 py-10">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-sm">
        <Link to="/" aria-label="Last Mile Connect home" className="mx-auto flex w-fit rounded-md bg-white p-1">
          <img src="/brand-logo.png" alt="Last Mile Connect — On-Site Services, Just a Click Away" className="h-auto w-44 object-contain" />
        </Link>
        <h1 className="mt-6 text-2xl font-semibold">
          {mode === "signin" ? "Sign in" : mode === "signup" ? "Create your account" : "Reset your password"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {mode === "forgot" ? "We'll email you a link to set a new password." : "Book, track and manage telecom field services."}
        </p>

        {sentTo ? (
          <div className="mt-6 rounded-md border border-border bg-surface/60 p-4 text-sm">
            Check <strong>{sentTo}</strong> for a link to continue.
            <Button variant="link" className="px-0" onClick={() => { setSentTo(null); setMode("signin"); }}>Back to sign in</Button>
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            {mode === "signin" && <SignInForm onForgot={() => setMode("forgot")} />}
            {mode === "signup" && <SignUpForm onSent={setSentTo} />}
            {mode === "forgot" && <ForgotForm onSent={setSentTo} />}

            {mode !== "forgot" && (
              <>
                <div className="flex items-center gap-3 text-xs text-muted-foreground"><span className="h-px flex-1 bg-border" />or<span className="h-px flex-1 bg-border" /></div>
                <Button type="button" variant="outline" className="w-full" onClick={() => social("google")}>Continue with Google</Button>
                <button type="button" className="lovable-auth-button w-full" onClick={() => social("lovable")}>Continue with Lovable</button>
              </>
            )}
            <p className="text-center text-sm text-muted-foreground">
              {mode === "signin" ? (
                <>New here? <button className="text-link font-medium" onClick={() => setMode("signup")}>Create an account</button></>
              ) : (
                <>Have an account? <button className="text-link font-medium" onClick={() => setMode("signin")}>Sign in</button></>
              )}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function SignInForm({ onForgot }: { onForgot: () => void }) {
  const form = useForm<z.infer<typeof signInSchema>>({
    resolver: zodResolver(signInSchema),
  });

  const submit = form.handleSubmit(async (v) => {
    try {
      const { data, error } = await authService.signIn(
        v.email,
        v.password
      );

      if (error) {
        toast.error(
          error.message.includes("confirm")
            ? "Please confirm your email first."
            : "Incorrect email or password."
        );
        return;
      }

      if (data.session) {
        await generate_token();
        toast.success("Login successful!");
      }
    } catch (error) {
      console.error("Login error:", error);
      toast.error("Login failed. Please try again.");
    }
  });

  const e = form.formState.errors;

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <Field
        id="email"
        label="Work email"
        type="email"
        autoComplete="email"
        error={e.email?.message}
        {...form.register("email")}
      />

      <Field
        id="password"
        label="Password"
        type="password"
        autoComplete="current-password"
        error={e.password?.message}
        {...form.register("password")}
      />

      <div className="flex justify-end">
        <button
          type="button"
          className="text-link text-xs"
          onClick={onForgot}
        >
          Forgot password?
        </button>
      </div>

      <Button
        type="submit"
        className="w-full"
        disabled={form.formState.isSubmitting}
      >
        {form.formState.isSubmitting ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}

function SignUpForm({ onSent }: { onSent: (email: string) => void }) {
  const form = useForm<z.infer<typeof signUpSchema>>({ resolver: zodResolver(signUpSchema) });
  const submit = form.handleSubmit(async (v) => {
    const { error } = await authService.signUp(v);
    if (error) { toast.error(error.message); return; }
    onSent(v.email);
  });
  const e = form.formState.errors;
  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <Field id="fullName" label="Full name" autoComplete="name" error={e.fullName?.message} {...form.register("fullName")} />
      <Field id="company" label="Company" autoComplete="organization" error={e.company?.message} {...form.register("company")} />
      <Field id="phone" label="Phone" type="tel" autoComplete="tel" error={e.phone?.message} {...form.register("phone")} />
      <Field id="email" label="Work email" type="email" autoComplete="email" error={e.email?.message} {...form.register("email")} />
      <Field id="password" label="Password" type="password" autoComplete="new-password" error={e.password?.message} {...form.register("password")} />
      <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>{form.formState.isSubmitting ? "Creating…" : "Create account"}</Button>
    </form>
  );
}

function ForgotForm({ onSent }: { onSent: (email: string) => void }) {
  const form = useForm<z.infer<typeof forgotSchema>>({ resolver: zodResolver(forgotSchema) });
  const submit = form.handleSubmit(async (v) => {
    const { error } = await authService.forgotPassword(v.email);
    if (error) { toast.error("Could not send the reset email. Try again shortly."); return; }
    onSent(v.email);
  });
  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <Field id="email" label="Work email" type="email" error={form.formState.errors.email?.message} {...form.register("email")} />
      <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>Send reset link</Button>
    </form>
  );
}
