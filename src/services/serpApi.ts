import { getSupabaseClient } from "@/lib/supabase";

export type Feed<T> =
  | { state: "idle" }
  | { state: "loading" }
  | { state: "ready"; items: readonly T[] }
  | { state: "empty" }
  | { state: "offline"; detail?: string }
  | { state: "unconfigured" }
  | { state: "failed"; detail?: string };

export const serpConfigured = getSupabaseClient() !== null;

const TIMEOUT_MS = 15000;

const RETRY_DELAY_MS = 700;

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const report = (label: string, detail: string) => {
  if (__DEV__) console.warn(`[serp] ${label}: ${detail}`);
};

const cache = new Map<string, unknown>();

export const serpSearch = async <T,>(
  params: Record<string, string>,
  pick: (body: Record<string, unknown>) => readonly T[],
): Promise<Feed<T>> => {
  const client = getSupabaseClient();
  if (!client) {
    report("unconfigured", "no Supabase client — see src/lib/supabase.ts");
    return { state: "unconfigured" };
  }

  const cacheKey = new URLSearchParams(params).toString();

  const hit = cache.get(cacheKey);
  if (hit) return hit as Feed<T>;

  const attempt = async (): Promise<Feed<T>> => {
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), TIMEOUT_MS);

    try {
      const { data, error } = await client.functions.invoke("serp-search", {
        body: { params },
        signal: abort.signal,
      });

      if (error) {
        const status = (error as { context?: { status?: number } }).context?.status;
        const detail = error.message ?? "edge function error";
        report(status && status >= 500 ? "offline" : "http", detail);
        return status !== undefined && status < 500
          ? { state: "failed", detail }
          : { state: "offline", detail };
      }

      const body = data as Record<string, unknown>;
      if (body.error === "unconfigured") {
        report("unconfigured", "SERP_API_KEY is not set for the serp-search function");
        return { state: "unconfigured" };
      }
      if (typeof body.error === "string") {
        report("api", body.error);
        return { state: "failed", detail: body.error };
      }

      const items = pick(body);
      return items.length > 0 ? { state: "ready", items } : { state: "empty" };
    } catch (error) {
      const detail =
        abort.signal.aborted
          ? `timed out after ${TIMEOUT_MS}ms`
          : error instanceof Error
            ? error.message
            : "unknown network failure";
      return { state: "offline", detail };
    } finally {
      clearTimeout(timer);
    }
  };

  let result = await attempt();

  if (result.state === "offline") {
    report("retrying", result.detail ?? "network");
    await wait(RETRY_DELAY_MS);
    result = await attempt();
    if (result.state === "offline") report("offline", result.detail ?? "network");
  }

  if (result.state === "ready" || result.state === "empty") cache.set(cacheKey, result);

  return result;
};
