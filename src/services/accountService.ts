import { getClientOrThrow, throwIfError } from "@/services/serviceUtils";
import type { AccountStatus } from "@/types/domain";

export const getAccountStatus = async (): Promise<AccountStatus> => {
  const client = getClientOrThrow();
  const { data, error } = await client.auth.getUser();
  throwIfError(error);
  const user = data.user;
  const isAnonymous = Boolean(user?.is_anonymous);
  const email = user?.email ?? undefined;

  return {
    isAnonymous,
    hasRecoverableIdentity: Boolean(email) || !isAnonymous,
    email,
  };
};

/** Where Supabase sends people back after confirming an email or linking Apple or Google. */
export const AUTH_CALLBACK = "paws://auth/callback";

/**
 * Add an email to the current (anonymous) account. This is an email change on the same user, not a new sign-in, so
 * the user id and every bit of PAWS data stay exactly as they are. Supabase emails a code (and a link) to confirm it.
 */
export const startEmailLink = async (email: string): Promise<void> => {
  const client = getClientOrThrow();
  const { error } = await client.auth.updateUser({ email: email.trim() }, { emailRedirectTo: AUTH_CALLBACK });
  throwIfError(error);
};

/** Confirm the emailed code. The account stops being anonymous and keeps its id. */
export const confirmEmailLink = async (email: string, token: string): Promise<void> => {
  const client = getClientOrThrow();
  const { error } = await client.auth.verifyOtp({ email: email.trim(), token: token.trim(), type: "email_change" });
  throwIfError(error);
  await client.auth.refreshSession();
};

/** Link Apple or Google to the current user. Returns the page to open; the app finishes it in auth/callback. */
export const startProviderLink = async (provider: "apple" | "google"): Promise<string> => {
  const client = getClientOrThrow();
  const { data, error } = await client.auth.linkIdentity({ provider, options: { redirectTo: AUTH_CALLBACK, skipBrowserRedirect: true } });
  throwIfError(error);
  if (!data?.url) throw new Error("Sign-in is not available right now.");
  return data.url;
};

/** Finish a link that came back through paws://auth/callback, and refresh so the new identity shows everywhere. */
export const finishLink = async (code: string | null): Promise<void> => {
  const client = getClientOrThrow();
  if (code) {
    const { error } = await client.auth.exchangeCodeForSession(code);
    throwIfError(error);
  }
  await client.auth.refreshSession();
};
