import { env } from "@/config/env";
import { getSupabaseClient } from "@/lib/supabase";

/**
 * Every Gemini request in PAWS goes through the `gemini` Supabase edge function, which holds the API key. The app sends
 * the same request body it would send to Google and gets Google's reply (status and JSON) back, so callers keep their
 * own parsing and error handling. Nothing about the key lives in the app.
 */
export const geminiAvailable = env.isValid && Boolean(getSupabaseClient());

export const callGemini = async (model: string, body: object, timeoutMs: number): Promise<Response> => {
  const client = getSupabaseClient();
  if (!client || !env.isValid) throw new Error("not configured");
  const { data } = await client.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("not signed in");
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), timeoutMs);
  try {
    return await fetch(`${env.data.supabaseUrl}/functions/v1/gemini`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, apikey: env.data.supabaseAnonKey },
      body: JSON.stringify({ model, body }),
      signal: abort.signal,
    });
  } finally {
    clearTimeout(timer);
  }
};
