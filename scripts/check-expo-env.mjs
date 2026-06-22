#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const envPath = resolve(process.cwd(), ".env");
const forbiddenKeys = [
  "SUPABASE_SERVICE_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SERVICE_ROLE_KEY",
  "GEMINI_API_KEY",
  "OPENAI_API_KEY",
  "STRIPE_SECRET_KEY",
  "REVENUECAT_SECRET_KEY",
];

if (!existsSync(envPath)) {
  console.log("No root .env file found.");
  process.exit(0);
}

const text = readFileSync(envPath, "utf8");
const found = [];

for (const line of text.split(/\r?\n/)) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
  const [key] = trimmed.split("=");
  if (forbiddenKeys.includes(key.trim())) {
    found.push(key.trim());
  }
}

if (found.length > 0) {
  console.error("Root Expo .env contains backend-only secret keys:");
  for (const key of found) {
    console.error(`- ${key}`);
  }
  console.error("\nMove these to paws-dog-ai/.env or a secure backend host secret store.");
  process.exit(1);
}

console.log("Expo environment safety check passed.");
