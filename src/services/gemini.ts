import { callGemini, geminiAvailable } from "@/services/geminiProxy";

/**
 * One way to ask Gemini for JSON, shared by the newer PAWS helpers (label reading, check-in support, record insights).
 * Requests go through the `gemini` edge function, which holds the key. With Google Search on, Gemini cannot use a response schema, so
 * the reply is read from the first JSON object in the text.
 */
export const geminiConfigured = geminiAvailable;

const PRIMARY = "gemini-2.5-flash";
const FALLBACK = "gemini-flash-latest";

export type GeminiResult<T> = { state: "ready"; value: T; sources: string[] } | { state: "offline" } | { state: "failed"; detail: string } | { state: "unconfigured" };

type Body = {
  error?: { message?: string };
  candidates?: { content?: { parts?: { text?: string }[] }; groundingMetadata?: { groundingChunks?: { web?: { uri?: string; title?: string } }[] } }[];
};

const post = (model: string, body: object, timeoutMs: number) => callGemini(model, body, timeoutMs);

/** The first balanced {...} in a reply, so a sentence or a code fence around the JSON does not break parsing. */
export const firstJson = (raw: string): unknown => {
  const start = raw.indexOf("{");
  if (start < 0) throw new SyntaxError("no JSON");
  let depth = 0;
  let quoted = false;
  for (let i = start; i < raw.length; i += 1) {
    const ch = raw[i];
    if (quoted) {
      if (ch === "\\") i += 1;
      else if (ch === '"') quoted = false;
    } else if (ch === '"') quoted = true;
    else if (ch === "{") depth += 1;
    else if (ch === "}" && (depth -= 1) === 0) return JSON.parse(raw.slice(start, i + 1));
  }
  throw new SyntaxError("unbalanced JSON");
};

/** Strip the dashes and markdown Gemini likes, so copy follows PAWS style. */
export const tidy = (value: string) =>
  value
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\s+[—–]\s+(?=[A-Z])/g, ". ")
    .replace(/\s*[—–]\s*/g, ", ")
    .trim();

export const askGeminiJson = async <T>({
  system,
  prompt,
  schema,
  search = false,
  maxTokens = 800,
  timeoutMs = 30000,
}: {
  system: string;
  prompt: string;
  /** A response schema; ignored when `search` is on. */
  schema?: object;
  /** Let Gemini look things up with Google Search, for facts like a product's label. */
  search?: boolean;
  maxTokens?: number;
  timeoutMs?: number;
}): Promise<GeminiResult<T>> => {
  if (!geminiConfigured) return { state: "unconfigured" };
  const generationConfig = {
    temperature: 0.2,
    maxOutputTokens: maxTokens,
    ...(search || !schema ? {} : { responseMimeType: "application/json", responseSchema: schema }),
  };
  const body = {
    system_instruction: { parts: [{ text: system }] },
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    ...(search ? { tools: [{ google_search: {} }] } : {}),
    generationConfig,
  };
  try {
    let response = await post(PRIMARY, { ...body, generationConfig: { ...generationConfig, thinkingConfig: { thinkingBudget: 0 } } }, timeoutMs);
    if (response.status === 404) response = await post(FALLBACK, body, timeoutMs);
    const json = (await response.json()) as Body;
    if (!response.ok || json.error) {
      const detail = json.error?.message ?? `HTTP ${response.status}`;
      if (__DEV__) console.warn(`[gemini] ${detail}`);
      return response.status >= 500 ? { state: "offline" } : { state: "failed", detail };
    }
    const candidate = json.candidates?.[0];
    const raw = candidate?.content?.parts?.map((part) => part.text ?? "").join("") ?? "";
    const sources = (candidate?.groundingMetadata?.groundingChunks ?? []).map((c) => c.web?.title ?? c.web?.uri ?? "").filter(Boolean);
    return { state: "ready", value: firstJson(raw) as T, sources };
  } catch (error) {
    if (__DEV__) console.warn(`[gemini] ${error instanceof Error ? error.message : "network"}`);
    return error instanceof SyntaxError ? { state: "failed", detail: "unreadable reply" } : { state: "offline" };
  }
};
