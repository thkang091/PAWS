/**
 * DEVELOPMENT ONLY. A local stand-in for the `tournament` edge function's Number Trail actions, so the app on the iOS
 * simulator can run the real service code against the local PostgreSQL + PostGIS test cluster
 * (scripts/test-db-local.sh --keep) without deploying anything.
 *
 *   deno run --allow-net --allow-read --allow-env --allow-run --config supabase/functions/tournament/deno.json \
 *     scripts/number-trail-dev-server.ts
 *
 * What is real: the service code (numberService, numberPlayService, numberDiscoveryService, unchanged), the database
 * functions and PostGIS, and the pedestrian network (OpenStreetMap via Overpass, fetched once per area and stored in
 * the local database by the same loader the edge function uses). What is not: authentication. The caller's id is read
 * from their session token WITHOUT verifying it, which is acceptable only because this listens on 127.0.0.1 and is
 * never deployed. The app uses it only when EXPO_PUBLIC_NUMBER_TRAIL_DEV_URL is set in a development build.
 */
import { NUMBER_ACTIONS, StoreError, type NumberAction, type NumberDeps } from "../supabase/functions/tournament/numberService.ts";
import { PLAY_ACTIONS, type PlayAction } from "../supabase/functions/tournament/numberPlayService.ts";
import { DISCOVERY_ACTIONS, type DiscoveryAction } from "../supabase/functions/tournament/numberDiscoveryService.ts";
import { networkNear, type Db } from "../supabase/functions/tournament/network.ts";
import type { PedGraph } from "../supabase/functions/tournament/routes.ts";

const PORT = Number(Deno.env.get("PORT") ?? 54400);
const PSQL = Deno.env.get("PAWS_PSQL") ?? "/opt/homebrew/opt/postgresql@17/bin/psql";
const socket = (() => {
  for (const d of Deno.readDirSync("/tmp")) {
    if (!d.name.startsWith("pawspg.")) continue;
    try {
      Deno.statSync(`/tmp/${d.name}/.s.PGSQL.54329`);
      return `/tmp/${d.name}`;
    } catch {
      // not this one
    }
  }
  throw new Error("No local test cluster: run scripts/test-db-local.sh --keep first");
})();

/** One statement in its own session, sent on stdin (a stored street network is megabytes: too long for an argument). */
const sql = async (text: string): Promise<string> => {
  const child = new Deno.Command(PSQL, {
    args: ["-X", "-q", "-t", "-A", "-v", "ON_ERROR_STOP=1"],
    env: { PGHOST: socket, PGPORT: "54329", PGUSER: "postgres", PGDATABASE: "paws_test", LC_ALL: "en_US.UTF-8" },
    stdin: "piped",
    stdout: "piped",
    stderr: "piped",
  }).spawn();
  const writer = child.stdin.getWriter();
  await writer.write(new TextEncoder().encode(text.trimEnd().endsWith(";") ? text : `${text};`));
  await writer.close();
  const out = await child.output();
  if (!out.success) throw new Error(new TextDecoder().decode(out.stderr));
  return new TextDecoder().decode(out.stdout).trim();
};

const lit = (v: unknown): string => {
  if (v == null) return "null";
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "null";
  if (typeof v === "boolean") return v ? "true" : "false";
  const tag = "$q" + Math.random().toString(36).slice(2, 8) + "$";
  return typeof v === "string" ? `${tag}${v}${tag}` : `${tag}${JSON.stringify(v)}${tag}::jsonb`;
};
const SETOF = new Set(["number_stale_attempts"]);
const VOID = new Set(["number_prepare_failed", "number_plan_cache_put", "number_online_search_failed", "number_discovery_put"]);

/** Supabase's rpc shape over psql: { data, error }. */
const db: Db = {
  rpc: async (name, args) => {
    const call = `public.${name}(${Object.entries(args).map(([k, v]) => `${k} => ${lit(v)}`).join(", ")})`;
    const text = SETOF.has(name) ? `select coalesce(jsonb_agg(x), '[]'::jsonb) from ${call} x` : VOID.has(name) ? `select ${call}, 'null'` : `select to_jsonb(${call})`;
    try {
      const out = await sql(text);
      return { data: VOID.has(name) || out === "" ? null : JSON.parse(out), error: null };
    } catch (e) {
      return { data: null, error: { message: (e as Error).message } };
    }
  },
};

const log = (event: string, detail?: Record<string, unknown>) => console.log(JSON.stringify({ at: new Date().toISOString(), event, ...detail }));

const deps: NumberDeps = {
  rpc: async <T>(name: string, args: Record<string, unknown>) => {
    const { data, error } = await db.rpc(name, args);
    if (error) throw new StoreError(error.message.match(/ERROR:\s+([a-z]+(?:_[a-z]+)+)/)?.[1] ?? "server_error");
    return data as T;
  },
  loadNetwork: async (lat, lng, minutes, radiusM) => {
    const network = await networkNear(db, lat, lng, minutes, radiusM, log);
    if ("error" in network) return network;
    return { graph: network.graph as PedGraph, source: network.source, sources: network.sources };
  },
  now: Date.now,
  random: () => crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296,
  sha256: async (t) => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(t))), (b) => b.toString(16).padStart(2, "0")).join(""),
  log,
};

/** The caller's id from their session token (UNVERIFIED: development only), created in the local database on first use. */
const userOf = async (auth: string | null): Promise<string | null> => {
  const token = auth?.replace(/^Bearer\s+/i, "") ?? "";
  try {
    const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    const id = typeof payload.sub === "string" && /^[0-9a-f-]{36}$/i.test(payload.sub) ? payload.sub : null;
    if (id) await sql(`insert into auth.users (id, email) values ('${id}', 'dev-${id.slice(0, 8)}@sim.paws') on conflict (id) do nothing`);
    return id;
  } catch {
    return null;
  }
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

Deno.serve({ hostname: "127.0.0.1", port: PORT }, async (req) => {
  if (req.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405);
  const userId = await userOf(req.headers.get("Authorization"));
  if (!userId) return json({ ok: false, error: "unauthorized" }, 401);
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return json({ ok: false, error: "bad_request" }, 400);
  const action = String(body.action);
  // Coordinates are logged rounded (about 100 m) for the test report; this log never leaves the machine.
  const lat = Number(body.latitude);
  const lng = Number(body.longitude);
  log("request", { action, user: userId.slice(0, 8), ...(Number.isFinite(lat) ? { lat: Math.round(lat * 1000) / 1000, lng: Math.round(lng * 1000) / 1000, radiusM: body.radiusM, number: body.number } : {}) });
  try {
    const handler = (NUMBER_ACTIONS as Record<string, unknown>)[action] ?? (PLAY_ACTIONS as Record<string, unknown>)[action] ?? (DISCOVERY_ACTIONS as Record<string, unknown>)[action];
    if (!handler) return json({ ok: false, error: "unknown_action" }, 400);
    const reply = await (handler as (d: NumberDeps, u: string, b: Record<string, unknown>) => Promise<{ status: number; body: Record<string, unknown> }>)(deps, userId, body);
    log("reply", { action, status: reply.status, ...(reply.body.available ? { available: (reply.body.available as string[]).length, partial: reply.body.partial, checkedRadiusM: reply.body.checkedRadiusM } : {}), ...(reply.body.routes ? { routes: (reply.body.routes as unknown[]).length, total: reply.body.total, complete: reply.body.complete } : {}), ...(reply.body.ok ? {} : { error: reply.body.error }) });
    return json(reply.body, reply.status);
  } catch (e) {
    log("unhandled", { action, message: (e as Error).message });
    return json({ ok: false, error: "server_error" }, 500);
  }
});
log("listening", { port: PORT, socket });

// Types only, so `deno check` keeps these names in step with the services.
export type { NumberAction, PlayAction, DiscoveryAction };
