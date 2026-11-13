/**
 * The one place PAWS talks to Google's Gemini API. The key comes from the GEMINI_API_KEY function secret and never
 * leaves the server. Used by the `gemini` function (the app's pass-through) and by `media` (entry checks, pose
 * ideas, example photos).
 */

/** Models PAWS is allowed to call. The image model is used only to draft example photos for organizers. */
export const GEMINI_MODELS = new Set(["gemini-2.5-flash", "gemini-flash-latest", "gemini-2.5-flash-lite", "gemini-2.5-flash-image"]);

export const geminiEndpoint = (model: string) => `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

export const geminiKey = () => Deno.env.get("GEMINI_API_KEY") ?? null;

export type GeminiReply = { ok: true; data: unknown } | { ok: false; status: number; error: string };

const RETRYABLE = new Set([429, 500, 502, 503, 504]);
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * generateContent with a timeout and a couple of retries for rate limits and server errors (with backoff and a
 * little jitter). Returns an error code rather than throwing.
 */
export const generate = async (model: string, body: unknown, opts: { timeoutMs?: number; retries?: number } = {}): Promise<GeminiReply> => {
  const key = geminiKey();
  if (!key) return { ok: false, status: 503, error: "unconfigured" };
  if (!GEMINI_MODELS.has(model)) return { ok: false, status: 400, error: "model_not_allowed" };
  const retries = opts.retries ?? 2;
  let last: GeminiReply = { ok: false, status: 504, error: "unavailable" };
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), opts.timeoutMs ?? 45_000);
    try {
      const res = await fetch(geminiEndpoint(model), {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify(body),
        signal: abort.signal,
      });
      if (res.ok) return { ok: true, data: await res.json() };
      last = { ok: false, status: res.status, error: res.status === 429 ? "rate_limited" : `upstream_${res.status}` };
      if (!RETRYABLE.has(res.status)) return last;
    } catch {
      last = { ok: false, status: 504, error: abort.signal.aborted ? "timed_out" : "network" };
    } finally {
      clearTimeout(timer);
    }
    if (attempt < retries) await wait(600 * 2 ** attempt + Math.random() * 300);
  }
  return last;
};

/** The text of the first candidate, or null. */
export const textOf = (data: unknown): string | null => {
  const parts = (data as { candidates?: { content?: { parts?: { text?: string }[] } }[] })?.candidates?.[0]?.content?.parts ?? [];
  const text = parts.map((p) => p?.text ?? "").join("");
  return text || null;
};
