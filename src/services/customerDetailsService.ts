import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type CustomerSite = Pick<
  Tables<"customer_details">,
  "id" | "store_code" | "store_name" | "poc" | "poc_no" | "address"
>;

export const customerSitesQuery = queryOptions({
  queryKey: ["customer-details", "sites"],
  retry: 2,
  queryFn: async (): Promise<CustomerSite[]> => {
    const { data, error } = await supabase
      .from("customer_details")
      .select("id, store_code, store_name, poc, poc_no, address")
      .order("store_code");
    if (error) throw error;
    return data ?? [];
  },
});
