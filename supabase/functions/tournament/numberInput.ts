import type { Digit } from "./digits.ts";

/**
 * What a player types as their Number Trail number: a whole number from 0 to 99, written the usual way. 0 to 9 are
 * one digit, 10 to 99 two. "07" is not 7: leading zeros are refused with an explanation (a leading-zero challenge
 * would be its own mode). Shared by the phone and the server so both refuse the same things.
 */
export type NumberInputError = "empty" | "negative" | "decimal" | "not_a_number" | "zero" | "too_big" | "leading_zero";

export type ParsedNumber = { ok: true; number: string; value: number; digits: Digit[] } | { ok: false; error: NumberInputError };

export const parseTargetNumber = (raw: unknown): ParsedNumber => {
  const s = typeof raw === "number" ? String(raw) : typeof raw === "string" ? raw.trim() : "";
  if (!s) return { ok: false, error: "empty" };
  if (/^-\s*[0-9]/.test(s)) return { ok: false, error: "negative" };
  if (/^[0-9]*[.,][0-9]*$/.test(s) && /[0-9]/.test(s)) return { ok: false, error: "decimal" };
  if (!/^[0-9]+$/.test(s)) return { ok: false, error: "not_a_number" };
  // 0 is a number like any other (one digit); "00" is a leading zero.
  if (s === "0") return { ok: true, number: "0", value: 0, digits: ["0"] as Digit[] };
  if (s.length > 1 && s[0] === "0") return { ok: false, error: "leading_zero" };
  const value = Number(s);
  if (value > 99) return { ok: false, error: "too_big" };
  return { ok: true, number: s, value, digits: s.split("") as Digit[] };
};

/** Every number a player can choose. */
export const CHOOSABLE_NUMBERS: readonly string[] = Array.from({ length: 100 }, (_, i) => String(i));
