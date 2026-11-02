import { supabase } from "@/integrations/supabase/client";
import type { BulkUserImportRow } from "@/lib/bulk-user-import";

export type BulkUserCreationResult = {
  email: string;
  full_name: string;
  role: string;
  password?: string;
  error?: string;
};

function getFetchFailureDetail(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null || !("context" in error)) return undefined;
  const context = error.context;
  if (context instanceof Error) return context.message;
  if (typeof context === "object" && context !== null && "message" in context) {
    return typeof context.message === "string" ? context.message : undefined;
  }
  return undefined;
}

export const bulkUserService = {
  async createUsers(users: BulkUserImportRow[]): Promise<BulkUserCreationResult[]> {
    const { data, error } = await supabase.functions.invoke("bulk-create-users", {
      body: { users },
    });

    if (error) {
      if (error.name === "FunctionsFetchError") {
        const detail = getFetchFailureDetail(error);
        const cause = detail ? ` Details: ${detail}` : "";
        throw new Error(
          `Could not reach the bulk-create-users Edge Function. Make sure it is deployed to this Supabase project, and check the browser's network/CORS errors.${cause}`,
        );
      }

      const responseMessage =
        data && typeof data === "object" && "error" in data && typeof data.error === "string"
          ? data.error
          : error.message;
      throw new Error(responseMessage || "Bulk user creation failed.");
    }

    if (!data || !Array.isArray(data.results)) {
      throw new Error("The server returned an invalid bulk user creation response.");
    }

    return data.results as BulkUserCreationResult[];
  },
};
