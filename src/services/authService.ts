// import { supabase } from "@/integrations/supabase/client";
// import { lovable } from "@/integrations/lovable";

// export type AppRole = "super_admin" | "admin" | "ops_manager" | "engineer" | "customer";

// export const STAFF_ROLES: AppRole[] = ["super_admin", "admin", "ops_manager"];

// export const ROLE_LABELS: Record<AppRole, string> = {
//   super_admin: "Super Admin",
//   admin: "Admin",
//   ops_manager: "Operations Manager",
//   engineer: "Field Engineer",
//   customer: "Customer",
// };

// export function isStaff(roles: AppRole[]): boolean {
//   return roles.some((r) => STAFF_ROLES.includes(r));
// }

// /** Only allow same-origin relative paths as post-login destinations. */
// export function safeRedirect(path: unknown): string {
//   if (typeof path !== "string" || !path.startsWith("/") || path.startsWith("//")) return "/";
//   return path;
// }

// export const authService = {
//   signIn: (email: string, password: string) => supabase.auth.signInWithPassword({ email, password }),
//   signUp: (input: { email: string; password: string; fullName: string; company: string; phone: string }) =>
//     supabase.auth.signUp({
//       email: input.email,
//       password: input.password,
//       options: {
//         emailRedirectTo: window.location.origin,
//         data: { full_name: input.fullName, company: input.company, phone: input.phone },
//       },
//     }),
//   signInWith: (provider: "google" | "lovable") =>
//     lovable.auth.signInWithOAuth(provider, { redirect_uri: window.location.origin }),
//   forgotPassword: (email: string) =>
//     supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` }),
//   setNewPassword: (password: string) => supabase.auth.updateUser({ password }),
//   changePassword: (currentPassword: string, password: string) =>
//     supabase.auth.updateUser({ password, current_password: currentPassword } as never),
//   signOut: () => supabase.auth.signOut(),
// };

import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";

export type AppRole =
  | "super_admin"
  | "admin"
  | "ops_manager"
  | "engineer"
  | "customer";

export const STAFF_ROLES: AppRole[] = [
  "super_admin",
  "admin",
  "ops_manager",
];

export const ROLE_LABELS: Record<AppRole, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  ops_manager: "Operations Manager",
  engineer: "Field Engineer",
  customer: "Customer",
};

export function isStaff(roles: AppRole[]): boolean {
  return roles.some((role) => STAFF_ROLES.includes(role));
}

/** Only allow same-origin relative paths as post-login destinations. */
export function safeRedirect(path: unknown): string {
  if (
    typeof path !== "string" ||
    !path.startsWith("/") ||
    path.startsWith("//")
  ) {
    return "/";
  }

  return path;
}

export const authService = {
  // Email and password authentication through Supabase
  signIn: (email: string, password: string) =>
    supabase.auth.signInWithPassword({ email, password }),

  // Register a new user through Supabase

signUp: async (input: {
  email: string;
  password: string;
  fullName: string;
  company: string;
  phone: string;
}) => {
  const result = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      emailRedirectTo: window.location.origin,
      data: {
        full_name: input.fullName,
        company: input.company,
        phone: input.phone,
      },
    },
  });

  if (result.error) {
    console.error("SIGNUP ERROR:", {
      message: result.error.message,
      status: result.error.status,
      name: result.error.name,
    });
  } else {
    console.log("SIGNUP RESPONSE:", {
      userCreated: Boolean(result.data.user),
      sessionCreated: Boolean(result.data.session),
      userId: result.data.user?.id,
      emailConfirmationPending:
        Boolean(result.data.user) && !result.data.session,
    });
  }

  return result;
},


  // Google uses Supabase OAuth; Lovable uses Lovable Cloud Auth
  signInWith: (provider: "google" | "lovable") => {
    if (provider === "google") {
      return supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: window.location.origin,
        },
      });
    }

    return lovable.auth.signInWithOAuth("lovable", {
      redirect_uri: window.location.origin,
    });
  },

  // Password reset
  forgotPassword: (email: string) =>
    supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    }),

  setNewPassword: (password: string) =>
    supabase.auth.updateUser({ password }),

  changePassword: (currentPassword: string, password: string) =>
    supabase.auth.updateUser({
      password,
      current_password: currentPassword,
    } as never),

  // signOut: (scope: "global" | "local" = "local") =>
  //   supabase.auth.signOut({ scope }),
  signOut: async (scope: "global" | "local" = "local") => {
  const result = await supabase.auth.signOut({ scope });

  if (!result.error) {
    localStorage.removeItem("access_token");
  }

  return result;
},
};
