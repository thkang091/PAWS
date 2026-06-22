import { useCallback, useEffect, useRef, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";

import { env } from "@/config/env";
import { getSupabaseClient } from "@/lib/supabase";
import {
  restoreOrCreateAnonymousSession,
  signOutCurrentUser,
} from "@/services/authService";

export type AuthBootstrapState = {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  error: string | null;
  configurationError: string | null;
  missingVariables: string[];
  retry: () => void;
  signOut: () => Promise<void>;
};

export const useAuthBootstrap = (): AuthBootstrapState => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(env.isValid);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const bootstrapInFlight = useRef(false);

  const retry = useCallback(() => {
    setError(null);
    bootstrapInFlight.current = false;
    setRetryCount((value) => value + 1);
  }, []);

  const signOut = useCallback(async () => {
    await signOutCurrentUser();
    setSession(null);
    setUser(null);
    bootstrapInFlight.current = false;
    retry();
  }, [retry]);

  useEffect(() => {
    if (!env.isValid) {
      setIsLoading(false);
      return;
    }

    if (bootstrapInFlight.current) {
      return;
    }

    let isMounted = true;
    bootstrapInFlight.current = true;
    setIsLoading(true);

    restoreOrCreateAnonymousSession()
      .then((authState) => {
        if (!isMounted) {
          return;
        }

        setSession(authState.session);
        setUser(authState.user);
        setError(null);
      })
      .catch((caughtError: unknown) => {
        if (!isMounted) {
          return;
        }

        const message =
          caughtError instanceof Error
            ? caughtError.message
            : "Unable to bootstrap anonymous authentication.";
        setError(message);
        bootstrapInFlight.current = false;
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [retryCount]);

  useEffect(() => {
    const client = getSupabaseClient();

    if (!client) {
      return undefined;
    }

    const { data } = client.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
    });

    return () => {
      data.subscription.unsubscribe();
    };
  }, []);

  return {
    user,
    session,
    isLoading,
    error,
    configurationError: env.isValid ? null : env.message,
    missingVariables: env.isValid ? [] : env.missingVariables,
    retry,
    signOut,
  };
};
