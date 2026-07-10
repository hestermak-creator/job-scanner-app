import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Service-role client — bypasses row-level security entirely. This is the
// one place in the app that's allowed to read/write every user's rows in a
// single batch job (the nightly scan cron). Never import this from a client
// component, an onboarding/dashboard page, or anything reachable from the
// browser. SUPABASE_SERVICE_ROLE_KEY must NOT have a NEXT_PUBLIC_ prefix —
// if it ever ends up in client-side code, it defeats every RLS policy in
// the project.
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
