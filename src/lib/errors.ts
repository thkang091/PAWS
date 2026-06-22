export class AppError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AppError";
  }
}

const errorMessages: Array<[RegExp, string]> = [
  [/supabase.*config|environment|missing/i, "Supabase environment variables are missing."],
  [/network|fetch|offline/i, "Network unavailable. Check your connection and try again."],
  [/auth/i, "Authentication bootstrap failed. Please retry."],
  [/daily quest|initialize/i, "Daily quest initialization failed. Please retry."],
  [/training.*already|duplicate/i, "This training session was already recorded."],
  [/quest already/i, "This quest has already been completed."],
  [/moment already|uploaded today/i, "Dog Moment already uploaded today."],
  [/upload/i, "Dog Moment upload failed. Please retry."],
  [/insufficient silver/i, "Insufficient silver balance."],
  [/insufficient gold/i, "Insufficient gold balance."],
  [/game entry already/i, "Game entry already exists."],
  [/reward unavailable/i, "Reward unavailable."],
  [/redemption already/i, "Redemption already submitted."],
  [/care event/i, "Care event update failed. Please retry."],
];

export const getErrorMessage = (error: unknown, fallback = "Something went wrong. Please retry."): string => {
  if (!error) {
    return fallback;
  }

  if (error instanceof Error) {
    return error.message || fallback;
  }

  if (typeof error === "string") {
    return error || fallback;
  }

  if (typeof error === "object") {
    const record = error as Record<string, unknown>;
    const candidates = [record.message, record.details, record.hint, record.error_description, record.code];
    const readable = candidates.find((value): value is string => typeof value === "string" && value.trim().length > 0);

    if (readable) {
      return readable;
    }

    try {
      const serialized = JSON.stringify(error);
      return serialized && serialized !== "{}" ? serialized : fallback;
    } catch {
      return fallback;
    }
  }

  return String(error) || fallback;
};

export const toAppError = (error: unknown, fallback = "Something went wrong. Please retry."): AppError => {
  if (error instanceof AppError) {
    return error;
  }

  const rawMessage = getErrorMessage(error, fallback);
  const matchedMessage = errorMessages.find(([pattern]) => pattern.test(rawMessage))?.[1];

  return new AppError(matchedMessage ?? rawMessage ?? fallback);
};

export const requireValue = <T>(value: T | null | undefined, message: string): T => {
  if (value === null || value === undefined) {
    throw new AppError(message);
  }

  return value;
};
