import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

/**
 * Wipe an account back to a first launch: its dogs (and through them every dog record: care, health, training, games,
 * wallet), its plan choice, its synced app data, and the onboarding flags. The account itself and its sign-in stay, so
 * the next launch runs onboarding again under the same login.
 * Only accounts listed in RESET_ALLOWED_EMAILS (default: the owner's) may call it; the check happens here, not in the app.
 */
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ALLOWED = (Deno.env.get("RESET_ALLOWED_EMAILS") ?? "thkang091@gmail.com")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...corsHeaders } });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const asUser = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } });
  const { data, error } = await asUser.auth.getUser();
  const user = data.user;
  if (error || !user) return json({ error: "unauthorized" }, 401);
  if (!user.email || !ALLOWED.includes(user.email.toLowerCase())) return json({ error: "not_allowed" }, 403);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const steps: [string, () => PromiseLike<{ error: { message: string; code?: string } | null }>][] = [
    ["dogs", () => admin.from("dogs").delete().eq("owner_id", user.id)],
    ["plan", () => admin.from("user_plan_selections").delete().eq("owner_id", user.id)],
    ["synced data", () => admin.from("user_kv").delete().eq("owner_id", user.id)],
    ["onboarding", () => admin.from("profiles").update({ onboarding_completed: false, tutorial_completed: false }).eq("id", user.id)],
  ];
  for (const [label, run] of steps) {
    const { error: stepError } = await run();
    // A table that does not exist yet (synced data before its migration) has nothing to reset.
    if (stepError && stepError.code !== "42P01" && stepError.code !== "PGRST205") {
      console.error(`[reset-account] ${label}: ${stepError.message}`);
      return json({ error: `could_not_reset_${label.replace(" ", "_")}` }, 500);
    }
  }
  return json({ ok: true });
});
