import type { Session, User } from "@supabase/supabase-js";

import { env } from "@/config/env";
import { getSupabaseClient } from "@/lib/supabase";

export type AuthSessionState = {
  session: Session;
  user: User;
};

export type AuthServiceError = {
  message: string;
  missingVariables?: string[];
};

export const restoreOrCreateAnonymousSession =
  async (): Promise<AuthSessionState> => {
    if (!env.isValid) {
      throw {
        message: env.message,
        missingVariables: env.missingVariables,
      } satisfies AuthServiceError;
    }

    const client = getSupabaseClient();

    if (!client) {
      throw {
        message: "Supabase client is not configured.",
        missingVariables: env.missingVariables,
      } satisfies AuthServiceError;
    }

    const sessionResponse = await client.auth.getSession();

    if (sessionResponse.error) {
      throw new Error(sessionResponse.error.message);
    }

    if (sessionResponse.data.session?.user) {
      return {
        session: sessionResponse.data.session,
        user: sessionResponse.data.session.user,
      };
    }

    const signInResponse = await client.auth.signInAnonymously();

    if (signInResponse.error) {
      throw new Error(signInResponse.error.message);
    }

    if (!signInResponse.data.session || !signInResponse.data.user) {
      throw new Error("Supabase did not return an anonymous session.");
    }

    return {
      session: signInResponse.data.session,
      user: signInResponse.data.user,
    };
  };

export const bootstrapUserProfile = async () => {
  const client = getSupabaseClient();

  if (!client) {
    throw new Error("Supabase environment variables are missing.");
  }

  const { data, error } = await client.rpc("bootstrap_user_profile");

  if (error) {
    throw new Error(error.message);
  }

  return data;
};

export const signOutCurrentUser = async (): Promise<void> => {
  const client = getSupabaseClient();

  if (!client) {
    return;
  }

  const { error } = await client.auth.signOut();

  if (error) {
    throw new Error(error.message);
  }
};
