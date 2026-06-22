const redacted = "[redacted]";

export const captureUnexpectedError = (error: unknown, context?: Record<string, string | number | boolean | null>): void => {
  const message = error instanceof Error ? error.message : String(error);
  if (__DEV__) {
    console.warn("[error-reporting]", message, context ?? {});
  }
};

export const sanitizeForReporting = (value: string | null | undefined): string =>
  value ? redacted : "";
