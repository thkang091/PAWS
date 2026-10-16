import { callGemini, geminiAvailable } from "@/services/geminiProxy";

import type { FoodRule, FoodVerdict } from "@/services/foodService";
import type { ChatImage } from "@/services/trainerChat";

// Gemini runs behind the `gemini` edge function; the key never ships in the app.
export const foodCheckConfigured = geminiAvailable;

const PRIMARY = "gemini-2.5-flash";
const FALLBACK = "gemini-flash-latest";
const TIMEOUT_MS = 30000;

export type FoodDog = {
  name: string;
  breed: string | null;
  ageYears: number | null;
  weightKg: number | null;
  currentFood: string | null;
  rules: readonly FoodRule[];
  /** The full profile brief: conditions, medications, activity and recent check-ins can change the answer. */
  profile?: string;
};

export type FoodAnswer = {
  food: string | null;
  verdict: FoodVerdict;
  headline: string;
  reason: string;
  amount: string | null;
  watchFor: readonly string[];
  suggestRule: boolean;
};

export type FoodTurn = { role: "user" | "paws"; text: string };

export type FoodReply =
  | { state: "ready"; answer: FoodAnswer }
  | { state: "offline" }
  | { state: "failed"; detail: string }
  | { state: "unconfigured" };

const KIND_LABEL: Record<FoodRule["kind"], string> = {
  allergy: "allergic",
  intolerance: "intolerant",
  never: "never give",
  vet: "vet said no",
};

const briefing = (dog: FoodDog) =>
  [
    "You are the food safety checker inside PAWS, a dog care app. A guardian asks whether their dog can eat something, by photo or by name.",
    "",
    `DOG: ${dog.name}${dog.breed ? `, ${dog.breed}` : ""}${dog.ageYears != null ? `, about ${dog.ageYears} years old` : ""}${dog.weightKg != null ? `, about ${dog.weightKg} kg` : ""}.`,
    dog.currentFood ? `Usual food: ${dog.currentFood}.` : "Usual food: not set.",
    dog.profile ? `PROFILE:\n${dog.profile}\nUse it: conditions (pancreatitis, kidney disease, diabetes, sensitive stomach), medications and recent stomach trouble in check-ins can make an otherwise safe food a caution or avoid.` : "",
    dog.rules.length > 0
      ? `CAN'T-EAT LIST set by the guardian (always honour it): ${dog.rules
          .map((rule) => `${rule.name} (${KIND_LABEL[rule.kind]}${rule.note ? `, ${rule.note}` : ""})`)
          .join("; ")}.`
      : "CAN'T-EAT LIST: empty.",
    "",
    "HOW TO ANSWER",
    "- Identify the single food in question. If a photo shows several foods, judge the riskiest one and name it.",
    "- verdict: safe (fine in normal treat amounts), caution (only plain, small, or prepared a certain way), avoid (toxic, dangerous, or on the can't-eat list), unknown (you cannot tell what it is).",
    "- If the food or any ingredient matches the can't-eat list, verdict is avoid and the reason says it is on the list.",
    "- Scale any amount to this dog's size. Give amount only for safe or caution, as a short phrase like 'two thumb-sized pieces'.",
    "- If the photo is unclear, not food, or has no food in it, verdict is unknown and ask for a closer photo or the name.",
    "- For toxic foods (grapes, raisins, chocolate, xylitol, onion, garlic, macadamia, alcohol, caffeine, cooked bones), say to call a vet now if the dog already ate some.",
    "- headline: under 7 words, plain, starts with the food name. reason: under 40 words, warm and specific to this dog.",
    "- watchFor: up to 3 very short signs to watch after eating, empty for safe foods.",
    "- suggestRule: true when verdict is avoid and the food is not already on the can't-eat list.",
    "- Never use dashes to join sentences. Never use markdown. Never say you are an AI.",
  ].join("\n");

const schema = {
  type: "OBJECT",
  properties: {
    food: { type: "STRING", nullable: true },
    verdict: { type: "STRING", enum: ["safe", "caution", "avoid", "unknown"] },
    headline: { type: "STRING" },
    reason: { type: "STRING" },
    amount: { type: "STRING", nullable: true },
    watchFor: { type: "ARRAY", items: { type: "STRING" } },
    suggestRule: { type: "BOOLEAN" },
  },
  required: ["verdict", "headline", "reason", "watchFor", "suggestRule"],
};

const tidy = (value: string) =>
  value
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\s+[—–]\s+(?=[A-Z])/g, ". ")
    .replace(/\s*[—–]\s*/g, ", ")
    .trim();

const call = (model: string, body: object): Promise<Response> => callGemini(model, body, TIMEOUT_MS);

export const askFood = async (
  dog: FoodDog,
  history: readonly FoodTurn[],
  question: { text: string; image?: ChatImage },
): Promise<FoodReply> => {
  if (!foodCheckConfigured) return { state: "unconfigured" };

  const contents = [
    ...history.slice(-6).map((turn) => ({
      role: turn.role === "paws" ? "model" : "user",
      parts: [{ text: turn.text }],
    })),
    {
      role: "user",
      parts: [
        ...(question.image
          ? [{ inline_data: { mime_type: question.image.mimeType, data: question.image.base64 } }]
          : []),
        { text: question.text || `Can ${dog.name} eat this?` },
      ],
    },
  ];

  const base = {
    system_instruction: { parts: [{ text: briefing(dog) }] },
    contents,
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 600,
      responseMimeType: "application/json",
      responseSchema: schema,
    },
  };

  try {
    let response = await call(PRIMARY, {
      ...base,
      generationConfig: { ...base.generationConfig, thinkingConfig: { thinkingBudget: 0 } },
    });
    if (response.status === 404) response = await call(FALLBACK, base);

    const body = (await response.json()) as {
      error?: { message?: string };
      candidates?: { content?: { parts?: { text?: string }[] } }[];
      promptFeedback?: { blockReason?: string };
    };

    if (!response.ok || body.error) {
      const detail = body.error?.message ?? `HTTP ${response.status}`;
      if (__DEV__) console.warn(`[food] ${detail}`);
      return response.status >= 500 ? { state: "offline" } : { state: "failed", detail };
    }

    const raw = body.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("") ?? "";
    const parsed = JSON.parse(raw) as Partial<FoodAnswer>;
    if (!parsed.verdict || !parsed.headline) return { state: "failed", detail: "empty reply" };

    return {
      state: "ready",
      answer: {
        food: parsed.food ? tidy(parsed.food) : null,
        verdict: parsed.verdict,
        headline: tidy(parsed.headline),
        reason: tidy(parsed.reason ?? ""),
        amount: parsed.amount ? tidy(parsed.amount) : null,
        watchFor: (parsed.watchFor ?? []).map(tidy).filter(Boolean).slice(0, 3),
        suggestRule: Boolean(parsed.suggestRule),
      },
    };
  } catch (error) {
    if (__DEV__) console.warn(`[food] ${error instanceof Error ? error.message : "network"}`);
    return error instanceof SyntaxError ? { state: "failed", detail: "unreadable reply" } : { state: "offline" };
  }
};
