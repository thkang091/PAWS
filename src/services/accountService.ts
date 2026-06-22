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

export const sendLinkAccountEmail = async (email: string): Promise<void> => {
  const client = getClientOrThrow();
  const { error } = await client.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: false,
    },
  });
  throwIfError(error);
};
