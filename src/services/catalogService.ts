import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import engineerImage from "@/assets/field-engineer.jpg";
import auditImage from "@/assets/site-audit.jpg";
import dataCenterImage from "@/assets/data-center.jpg";

const IMAGES: Record<string, string> = {
  "field-engineer": engineerImage,
  "site-audit": auditImage,
  "data-center": dataCenterImage,
};

export type CatalogService = {
  id: string;
  slug: string;
  title: string;
  category: string;
  description: string;
  image: string;
};

export const servicesQuery = queryOptions({
  queryKey: ["catalog", "services"],
  retry: 2,
  queryFn: async (): Promise<CatalogService[]> => {
    const { data, error } = await supabase
      .from("services")
      .select("id, slug, title, category, description, image_key")
      .eq("status", "active")
      .order("sort_order");
    if (error) throw error;
    return (data ?? []).map(({ image_key, ...s }) => ({ ...s, image: IMAGES[image_key] ?? dataCenterImage }));
  },
});
