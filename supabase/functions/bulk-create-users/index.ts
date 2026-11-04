import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const systemRoleSlugs = new Set(["super_admin", "admin", "ops_manager", "engineer", "customer"]);

type UserInput = {
  full_name: string;
  company: string;
  phone: string;
  email: string;
  role: string;
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function isUserInput(value: unknown): value is UserInput {
  if (typeof value !== "object" || value === null) return false;
  const user = value as Record<string, unknown>;
  return (
    typeof user.full_name === "string" &&
    user.full_name.trim().length > 0 &&
    user.full_name.length <= 100 &&
    typeof user.company === "string" &&
    user.company.trim().length > 0 &&
    user.company.length <= 120 &&
    typeof user.phone === "string" &&
    /^\+?[0-9 ]{8,16}$/.test(user.phone) &&
    typeof user.email === "string" &&
    user.email.length <= 255 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user.email) &&
    typeof user.role === "string" &&
    /^[a-z][a-z0-9_]*$/.test(user.role)
  );
}

function isBulkUserPayload(value: unknown): value is { users: UserInput[] } {
  if (typeof value !== "object" || value === null) return false;
  const users = (value as Record<string, unknown>).users;
  return (
    Array.isArray(users) && users.length > 0 && users.length <= 100 && users.every(isUserInput)
  );
}

function generatePassword(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  const randomPart = btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
  return `Aa1!${randomPart}`;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (request.method !== "POST") return jsonResponse({ error: "Method not allowed." }, 405);

  try {
    const authorization = request.headers.get("Authorization");
    if (!authorization?.startsWith("Bearer ")) {
      return jsonResponse({ error: "Authentication is required." }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const publishableKey =
      Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !publishableKey || !serviceRoleKey) {
      console.error(
        "Bulk user creation is missing required Supabase server environment variables.",
      );
      return jsonResponse({ error: "Bulk user creation is not configured on the server." }, 500);
    }

    const callerClient = createClient(supabaseUrl, publishableKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const accessToken = authorization.slice("Bearer ".length);
    const { data: userData, error: authError } = await callerClient.auth.getUser(accessToken);
    if (authError || !userData.user) {
      return jsonResponse({ error: "Authentication is required." }, 401);
    }

    const [permissionResult, adminRoleResult, superAdminRoleResult] = await Promise.all([
      callerClient.rpc("has_permission", {
        _user_id: userData.user.id,
        _permission_code: "users.role_management",
      }),
      callerClient.rpc("has_role", { _user_id: userData.user.id, _role: "admin" }),
      callerClient.rpc("has_role", { _user_id: userData.user.id, _role: "super_admin" }),
    ]);
    if (permissionResult.error || adminRoleResult.error || superAdminRoleResult.error) {
      console.error(
        "Bulk user creation permission check failed.",
        permissionResult.error ?? adminRoleResult.error ?? superAdminRoleResult.error,
      );
      return jsonResponse({ error: "Could not verify your account permissions." }, 500);
    }
    if (!permissionResult.data || (!adminRoleResult.data && !superAdminRoleResult.data)) {
      return jsonResponse({ error: "You do not have permission to create users." }, 403);
    }

    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      return jsonResponse({ error: "Request body must contain valid JSON." }, 400);
    }

    if (!isBulkUserPayload(payload)) {
      return jsonResponse(
        {
          error:
            "Provide between 1 and 100 valid users with name, company, phone, email, and role.",
        },
        400,
      );
    }

    const emails = payload.users.map((user) => user.email.trim().toLowerCase());
    if (new Set(emails).size !== emails.length) {
      return jsonResponse({ error: "The upload contains duplicate work emails." }, 400);
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const results = [];

    for (const input of payload.users) {
      const email = input.email.trim().toLowerCase();
      const roleSlug = input.role;
      let createdUserId: string | null = null;
      const password = generatePassword();

      try {
        const { data: role, error: roleError } = await adminClient
          .from("roles")
          .select("id, slug, is_active")
          .eq("slug", roleSlug)
          .maybeSingle();
        if (roleError) throw new Error("Could not verify the selected role.");
        if (!role?.is_active) {
          throw new Error("The selected role is unavailable.");
        }
        if (roleSlug === "super_admin" && !superAdminRoleResult.data) {
          throw new Error("Only a super admin can assign super admin access.");
        }

        const { data: created, error: createError } = await adminClient.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: {
            full_name: input.full_name.trim(),
            company: input.company.trim(),
            phone: input.phone.trim(),
          },
        });
        if (createError) throw new Error(createError.message);
        if (!created.user) throw new Error("The authentication provider did not return a user.");
        createdUserId = created.user.id;

        const { error: profileError } = await adminClient
          .from("profiles")
          .update({
            full_name: input.full_name.trim(),
            company: input.company.trim(),
            phone: input.phone.trim(),
            email,
          })
          .eq("id", createdUserId);
        if (profileError) throw new Error("Could not save the user profile.");

        const isSystemRole = systemRoleSlugs.has(roleSlug);
        const { error: assignError } = await adminClient.from("user_roles").upsert(
          {
            user_id: createdUserId,
            role_id: role.id,
            role: isSystemRole ? roleSlug : null,
            status: "active",
            created_by: userData.user.id,
          },
          { onConflict: isSystemRole ? "user_id,role" : "user_id,role_id" },
        );
        if (assignError) throw new Error("Could not assign the selected role.");

        if (roleSlug === "engineer") {
          const { data: engineer, error: engineerError } = await adminClient
            .from("engineers")
            .select("id")
            .eq("user_id", createdUserId)
            .maybeSingle();
          if (engineerError || !engineer) {
            throw new Error(
              "Engineer profile sync is unavailable. Apply migration 0018 before importing engineers.",
            );
          }
        }

        results.push({
          email,
          full_name: input.full_name.trim(),
          role: roleSlug,
          password,
        });
      } catch (error) {
        if (createdUserId) {
          const { error: engineerCleanupError } = await adminClient
            .from("engineers")
            .delete()
            .eq("user_id", createdUserId);
          if (engineerCleanupError) {
            console.error("Could not clean up a partially created engineer profile.", {
              userId: createdUserId,
              error: engineerCleanupError,
            });
          }
          const { error: cleanupError } = await adminClient.auth.admin.deleteUser(createdUserId);
          if (cleanupError) {
            console.error("Could not clean up a partially created user.", {
              userId: createdUserId,
              error: cleanupError,
            });
          }
        }
        results.push({
          email,
          full_name: input.full_name.trim(),
          role: roleSlug,
          error: error instanceof Error ? error.message : "Account creation failed.",
        });
      }
    }

    return jsonResponse({ results });
  } catch (error) {
    console.error("Bulk user creation request failed.", error);
    return jsonResponse(
      { error: "Bulk user creation failed. Check the upload and try again." },
      500,
    );
  }
});
