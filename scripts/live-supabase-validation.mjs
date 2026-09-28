#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";

const loadEnvFile = (path) => {
  if (!existsSync(path)) return;
  const text = readFileSync(path, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const [key, ...rest] = trimmed.split("=");
    if (!process.env[key]) {
      process.env[key] = rest.join("=").replace(/^["']|["']$/g, "");
    }
  }
};

loadEnvFile(resolve(process.cwd(), ".env"));

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  console.error("Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY.");
  process.exit(1);
}

const client = createClient(url, anonKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
  },
  realtime: {
    transport: WebSocket,
  },
});

const checks = [];

const run = async (label, fn) => {
  try {
    const message = await fn();
    checks.push({ label, ok: true, message });
  } catch (error) {
    checks.push({
      label,
      ok: false,
      message: formatError(error),
    });
  }
};

const formatError = (error) => {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object") {
    const message = error.message ?? error.error_description ?? error.error;
    const details = error.details ?? error.hint ?? error.code;
    return [message, details].filter(Boolean).join(" — ") || JSON.stringify(error);
  }
  return String(error);
};

const requireNoError = ({ error, data }) => {
  if (error) throw error;
  return data;
};

await run("anonymous auth", async () => {
  const { data, error } = await client.auth.signInAnonymously();
  if (error) throw error;
  if (!data.user) throw new Error("No anonymous user returned.");
  return data.user.is_anonymous ? "anonymous session created" : "session created";
});

await run("bootstrap_user_profile RPC", async () => {
  const { data, error } = await client.rpc("bootstrap_user_profile");
  requireNoError({ data, error });
  return "profile bootstrap callable";
});

await run("training catalog", async () => {
  const { data, error } = await client.from("training_skills").select("id,slug").limit(3);
  requireNoError({ data, error });
  return `${data?.length ?? 0} rows readable`;
});

await run("shop catalog", async () => {
  const { data, error } = await client.from("shop_items").select("id,item_key").limit(3);
  requireNoError({ data, error });
  return `${data?.length ?? 0} shop item rows readable`;
});

await run("challenge games catalog", async () => {
  const { data, error } = await client.from("challenge_games").select("id,verifier_prompt").eq("is_active", true).limit(3);
  requireNoError({ data, error });
  const missingPrompt = (data ?? []).some((row) => !row.verifier_prompt?.trim());
  if (missingPrompt) throw new Error("a challenge game row has no verifier_prompt");
  return `${data?.length ?? 0} challenge game rows readable, verifier_prompt present`;
});

await run("coupons catalog", async () => {
  const { data, error } = await client.from("coupons").select("id,title").limit(3);
  requireNoError({ data, error });
  return `${data?.length ?? 0} coupon rows readable`;
});

await run("dog lookup under RLS", async () => {
  const { data, error } = await client.from("dogs").select("id,name").limit(1);
  requireNoError({ data, error });
  return data?.[0] ? `dog visible: ${data[0].id}` : "no dog for this fresh validation user";
});

const { data: dogs } = await client.from("dogs").select("id").limit(1);
const dogId = dogs?.[0]?.id;

await run("wallet RPC", async () => {
  if (!dogId) return "skipped: no dog for validation user";
  const { data, error } = await client.rpc("get_wallet_summary", { target_dog_id: dogId });
  requireNoError({ data, error });
  return `wallet RPC returned ${JSON.stringify(data)}`;
});

await run("profile dashboard RPC", async () => {
  if (!dogId) return "skipped: no dog for validation user";
  const { data, error } = await client.rpc("get_profile_dashboard", { target_dog_id: dogId });
  requireNoError({ data, error });
  return data ? "dashboard RPC returned data" : "dashboard RPC returned empty";
});

await run("dog-moments storage bucket", async () => {
  const { data, error } = await client.storage.from("dog-moments").list("", { limit: 1 });
  requireNoError({ data, error });
  return `storage list ok (${data?.length ?? 0})`;
});

await run("protected wallet transactions read", async () => {
  const { data, error } = await client.from("wallet_transactions").select("id").limit(1);
  requireNoError({ data, error });
  return `${data?.length ?? 0} rows visible to current user`;
});

let failed = 0;
for (const check of checks) {
  const prefix = check.ok ? "PASS" : "FAIL";
  if (!check.ok) failed += 1;
  console.log(`${prefix} ${check.label}: ${check.message}`);
}

if (failed > 0) {
  console.error(`\n${failed} live Supabase validation check(s) failed.`);
  process.exit(1);
}

console.log("\nLive Supabase validation completed.");
