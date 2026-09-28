import Constants from "expo-constants";

export type ChatImage = { base64: string; mimeType: string; uri: string };

export type ChatTurn = {
  id: string;
  role: "user" | "coach";
  text: string;
  image?: ChatImage;
};

export type CoachBrief = {
  lesson: {
    number: number;
    chapter: string;
    title: string;
    steps: readonly { title: string; cues: readonly string[] }[];
  };
  stepIndex: number | null;
  struggleStep: number | null;
  sessionState: "not started" | "in progress" | "finished";
  dog: { name: string; breed: string | null; ageYears: number | null } | null;
  programme: { title: string; done: number; total: number } | null;
};

export type CoachReply =
  | { state: "ready"; text: string }
  | { state: "offline" }
  | { state: "failed"; detail: string }
  | { state: "unconfigured" };

const KEY =
  (Constants.expoConfig?.extra as { geminiApiKey?: string | null } | undefined)
    ?.geminiApiKey ?? null;

export const coachConfigured = typeof KEY === "string" && KEY.length > 0;

const PRIMARY = "gemini-2.5-flash";
const FALLBACK = "gemini-flash-latest";
const TIMEOUT_MS = 30000;

const briefing = (brief: CoachBrief) => {
  const { lesson, stepIndex, dog, programme } = brief;
  const steps = lesson.steps
    .map(
      (step, index) =>
        `Step ${index + 1}, "${step.title}":\n${step.cues.map((cue) => `  - ${cue}`).join("\n")}`,
    )
    .join("\n");

  return [
    "You are the PAWS training coach inside a dog training app. You help a dog guardian who pressed Need help during a lesson.",
    "",
    `LESSON ${lesson.number}: "${lesson.title}" (chapter: ${lesson.chapter}).`,
    "The lesson teaches exactly these steps, and these are the sentences the video says:",
    steps,
    "",
    stepIndex === null
      ? `Session: ${brief.sessionState}. They had not reached a specific step yet.`
      : `Session: ${brief.sessionState}. They were on step ${stepIndex + 1} of ${lesson.steps.length}, "${lesson.steps[stepIndex]?.title}", when they asked for help.`,
    brief.struggleStep !== null && lesson.steps[brief.struggleStep]
      ? `They said the step they are struggling with is step ${brief.struggleStep + 1}, "${lesson.steps[brief.struggleStep].title}". Focus your help on that step, even if the video was elsewhere.`
      : "",
    dog
      ? `Dog: ${dog.name}${dog.breed ? `, a ${dog.breed}` : ""}${dog.ageYears !== null ? `, about ${dog.ageYears} years old` : ""}. Use the dog's name.`
      : "The dog's name is not known. Say your dog.",
    programme
      ? `Programme: "${programme.title}", ${programme.done} of ${programme.total} sessions done.`
      : "",
    "",
    "HOW TO ANSWER",
    "- Ground every answer in this lesson's steps. Name the step you mean.",
    "- If they have not yet described what actually happens, do not give tips. Ask what happens when they try it, in one short sentence, and mention a photo would help.",
    "- Give two to four short numbered moves they can try right now, then ask one short question back.",
    "- Keep the whole reply under 90 words. No headings, no bold, no markdown symbols.",
    "- Never use dashes of any kind to join sentences. Use full stops or commas.",
    "- If they send a photo, say briefly what you can see that matters (distance, body language, lead, setting) before advising. Never describe people's faces.",
    "- If they mention biting, growling that is escalating, injury, pain, limping, not eating, or sudden behaviour change, say clearly that a vet or certified behaviourist should see the dog, and do not coach around it.",
    "- If the question is unrelated to dogs or this training, gently steer back.",
    "- Warm and plain, like a good trainer standing next to them. Never say you are an AI model.",
  ]
    .filter(Boolean)
    .join("\n");
};

const tidy = (raw: string) =>
  raw
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/(^|\s)\*(\S.+?)\*(?=\s|$)/g, "$1$2")
    .replace(/^#+\s*/gm, "")
    .replace(/^\s*[-*•]\s+/gm, "")
    .replace(/\s+[—–]\s+(?=[A-Z])/g, ". ")
    .replace(/\s*[—–]\s*/g, ", ")
    .replace(/\s+--\s+/g, ", ")
    .replace(/^(\d+)\.\s+/gm, "$1. ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

const toContents = (history: readonly ChatTurn[]) => {
  const start = history.findIndex((turn) => turn.role === "user");
  const merged: { role: "user" | "model"; parts: object[] }[] = [];

  for (const turn of start === -1 ? [] : history.slice(start)) {
    const role = turn.role === "coach" ? "model" : "user";
    const parts = [
      ...(turn.image
        ? [{ inline_data: { mime_type: turn.image.mimeType, data: turn.image.base64 } }]
        : []),
      { text: turn.text || "Here is a photo of what is happening." },
    ];
    const last = merged[merged.length - 1];
    if (last?.role === role) last.parts.push(...parts);
    else merged.push({ role, parts });
  }

  return merged;
};

const call = async (model: string, body: object): Promise<Response> => {
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), TIMEOUT_MS);
  try {
    return await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": KEY as string },
        body: JSON.stringify(body),
        signal: abort.signal,
      },
    );
  } finally {
    clearTimeout(timer);
  }
};

export const askCoach = async (
  brief: CoachBrief,
  history: readonly ChatTurn[],
): Promise<CoachReply> => {
  if (!coachConfigured) return { state: "unconfigured" };

  const base = {
    system_instruction: { parts: [{ text: briefing(brief) }] },
    contents: toContents(history),
    generationConfig: { temperature: 0.6, maxOutputTokens: 700 },
  };

  try {
    let response = await call(PRIMARY, {
      ...base,
      generationConfig: { ...base.generationConfig, thinkingConfig: { thinkingBudget: 0 } },
    });
    if (response.status === 404) response = await call(FALLBACK, base);

    const body = (await response.json()) as {
      error?: { message?: string };
      candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
      promptFeedback?: { blockReason?: string };
    };

    if (!response.ok || body.error) {
      const detail = body.error?.message ?? `HTTP ${response.status}`;
      if (__DEV__) console.warn(`[coach] ${detail}`);
      return response.status >= 500 ? { state: "offline" } : { state: "failed", detail };
    }

    if (body.promptFeedback?.blockReason) {
      return {
        state: "ready",
        text: "I cannot help with that one. Tell me what your dog is doing during the lesson and I will help with that.",
      };
    }

    const text = body.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("") ?? "";
    if (!text.trim()) return { state: "failed", detail: "empty reply" };

    return { state: "ready", text: tidy(text) };
  } catch (error) {
    if (__DEV__) console.warn(`[coach] ${error instanceof Error ? error.message : "network"}`);
    return { state: "offline" };
  }
};

export type VoiceClip = { base64: string; mimeType: string; durationMs: number };

export type Transcript =
  | { state: "ready"; text: string }
  | { state: "silent" }
  | { state: "offline" }
  | { state: "failed" }
  | { state: "unconfigured" };

const hallucinated = (text: string, durationMs: number) => {
  const words = text.toLowerCase().replace(/[^\p{L}\p{N}\s']/gu, " ").split(/\s+/).filter(Boolean);
  if (words.length > Math.max(12, (durationMs / 1000) * 6)) return true;
  const sentences = text.split(/[.?!]+/).map((part) => part.trim().toLowerCase()).filter(Boolean);
  const counts = new Map<string, number>();
  for (const sentence of sentences) counts.set(sentence, (counts.get(sentence) ?? 0) + 1);
  return [...counts.values()].some((count) => count >= 3);
};

export const transcribe = async (clip: VoiceClip): Promise<Transcript> => {
  if (!coachConfigured) return { state: "unconfigured" };

  const body = {
    system_instruction: {
      parts: [
        {
          text: "Transcribe the speech exactly, in the language spoken. Return only the words, with normal punctuation and no dashes. If there is no clear speech, return nothing at all.",
        },
      ],
    },
    contents: [{ role: "user", parts: [{ inline_data: { mime_type: clip.mimeType, data: clip.base64 } }] }],
    generationConfig: { temperature: 0, maxOutputTokens: 400, thinkingConfig: { thinkingBudget: 0 } },
  };

  try {
    const response = await call(PRIMARY, body);
    const json = (await response.json()) as {
      error?: { message?: string };
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    if (!response.ok || json.error) {
      if (__DEV__) console.warn(`[coach voice] ${json.error?.message ?? response.status}`);
      return response.status >= 500 ? { state: "offline" } : { state: "failed" };
    }
    const text = tidy(json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "");
    if (text.length < 2 || hallucinated(text, clip.durationMs)) return { state: "silent" };
    return { state: "ready", text };
  } catch {
    return { state: "offline" };
  }
};
