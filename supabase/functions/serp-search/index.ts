import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SERP_API_KEY = Deno.env.get("SERP_API_KEY");
const TIMEOUT_MS = 15000;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405);
  }

  if (!SERP_API_KEY) {
    console.error("[serp-search] SERP_API_KEY is not configured for this function.");
    return json({ error: "unconfigured" }, 500);
  }

  let payload: { params?: Record<string, unknown> };
  try {
    payload = await req.json();
  } catch {
    return json({ error: "invalid_json_body" }, 400);
  }

  const rawParams = payload?.params;
  if (!rawParams || typeof rawParams !== "object" || Array.isArray(rawParams)) {
    return json({ error: "missing_params" }, 400);
  }

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(rawParams)) {
    if (key === "api_key") continue;
    if (typeof value === "string" && value.length > 0) {
      params.set(key, value);
    }
  }
  params.set("api_key", SERP_API_KEY);

  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), TIMEOUT_MS);

  try {
    const upstream = await fetch(`https://serpapi.com/search.json?${params.toString()}`, {
      signal: abort.signal,
    });

    if (!upstream.ok) {
      console.error(`[serp-search] upstream HTTP ${upstream.status}`);
      return json({ error: `upstream_http_${upstream.status}` }, upstream.status >= 500 ? 502 : 502);
    }

    const body = await upstream.json();

    if (typeof body?.error === "string") {
      console.error(`[serp-search] upstream reported an error in a 200 body.`);
      return json({ error: body.error }, 502);
    }

    return json(body);
  } catch (error) {
    const detail = abort.signal.aborted
      ? "timed out"
      : error instanceof Error
        ? error.message
        : "unknown network failure";
    console.error(`[serp-search] request failed: ${detail}`);
    return json({ error: "network_failure" }, 502);
  } finally {
    clearTimeout(timer);
  }
});
