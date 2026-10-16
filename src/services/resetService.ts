import * as Notifications from "expo-notifications";

import { wipeLocalData } from "@/lib/cloudKv";
import { queryClient } from "@/lib/queryClient";
import { getClientOrThrow } from "@/services/serviceUtils";

/** Accounts that see the reset control. The server checks the same list before deleting anything. */
const RESET_ACCOUNTS = ["thkang091@gmail.com"];

export const canReset = (email: string | null | undefined) => Boolean(email && RESET_ACCOUNTS.includes(email.trim().toLowerCase()));

/**
 * Start over as a first-time user: the server deletes the account's dogs and everything under them, the plan choice
 * and synced data, and clears the onboarding flags; then this device drops its stored data, reminders and cache.
 * The sign-in stays, so onboarding runs again under the same account.
 */
export const resetAccount = async () => {
  const client = getClientOrThrow();
  const { error } = await client.functions.invoke("reset-account", { body: {} });
  if (error) {
    // Turn the server's answer into words instead of "non-2xx status code".
    const status = (error as { context?: Response }).context?.status;
    throw new Error(
      status === 404
        ? "Reset is not set up on the server yet."
        : status === 403
          ? "Reset is only available on the owner's account."
          : status === 401
            ? "Sign in again, then try the reset."
            : "Could not reset right now. Try again.",
    );
  }
  await Notifications.cancelAllScheduledNotificationsAsync().catch(() => undefined);
  await wipeLocalData();
  queryClient.clear();
};
