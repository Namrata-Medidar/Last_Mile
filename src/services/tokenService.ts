import { supabase } from "@/integrations/supabase/client";

export async function generate_token() {
  const { data, error } = await supabase.auth.getSession();

  if (error) throw error;

  const token = data.session?.access_token;

  if (!token) {
    throw new Error("User is not authenticated");
  }

  localStorage.setItem("access_token", token);

  return token;
}