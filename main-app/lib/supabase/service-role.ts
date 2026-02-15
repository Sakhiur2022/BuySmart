import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/types/database.types";

let serviceRoleClient: SupabaseClient<Database> | null = null;
let hasWarned = false;

export function getServiceRoleSupabase(): SupabaseClient<Database> | null {
  if (serviceRoleClient) {
    return serviceRoleClient;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    if (!hasWarned) {
      console.warn(
        "SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_URL is missing; agent logs will be skipped.",
      );
      hasWarned = true;
    }

    return null;
  }

  serviceRoleClient = createClient<Database>(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return serviceRoleClient;
}
