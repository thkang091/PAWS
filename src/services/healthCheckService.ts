import { env } from "@/config/env";
import { getClientOrThrow } from "@/services/serviceUtils";
import { getAccountStatus } from "@/services/accountService";
import { getCurrentDog, getCurrentProfile, getProfileDashboard } from "@/services/profileService";
import { getTrainingSections } from "@/services/trainingCurriculumService";
import { getDailyQuests } from "@/services/questService";
import { getWalletSummary } from "@/services/walletService";
import { todayKey } from "@/hooks/useDailyQuests";
import type { BackendHealthCheckItem } from "@/types/domain";

const check = async (key: string, label: string, run: () => Promise<string>): Promise<BackendHealthCheckItem> => {
  try {
    return { key, label, status: "pass", message: await run() };
  } catch (error) {
    return { key, label, status: "fail", message: error instanceof Error ? error.message : "Failed" };
  }
};

export const runBackendHealthCheck = async (): Promise<BackendHealthCheckItem[]> => {
  const client = getClientOrThrow();
  const profile = await getCurrentProfile();
  const dog = await getCurrentDog();

  return Promise.all([
    check("env", "Supabase environment", async () => (env.isValid ? "Configured" : env.message)),
    check("session", "Auth session", async () => {
      const { data, error } = await client.auth.getSession();
      if (error) throw error;
      return data.session ? "Session exists" : "No session";
    }),
    check("account", "Account status", async () => {
      const status = await getAccountStatus();
      return status.isAnonymous ? "Anonymous account" : "Recoverable account";
    }),
    check("profile", "Current profile", async () => (profile ? "Profile loads" : "No profile yet")),
    check("dog", "Current dog", async () => (dog ? "Dog loads" : "No dog yet")),
    check("wallet", "Wallet RPC", async () => (dog ? `${(await getWalletSummary(dog.id)).silverBalance} Silver Coins` : "Skipped until dog exists")),
    check("dashboard", "Dashboard RPC", async () => (dog ? `Level ${(await getProfileDashboard(dog.id)).level}` : "Skipped until dog exists")),
    check("catalog", "Training curriculum", async () => `${(await getTrainingSections()).length} sections`),
    check("quests", "Daily quests", async () => (dog ? `${(await getDailyQuests(dog.id, todayKey())).length} quests` : "Skipped until dog exists")),
    check("storage", "Storage bucket", async () => {
      const { data, error } = await client.storage.from("dog-moments").list("", { limit: 1 });
      if (error) throw error;
      return `Storage query ok (${data.length})`;
    }),
    check("rls", "RLS protected table", async () => {
      const { error } = await client.from("wallet_transactions").select("id").limit(1);
      if (error) throw error;
      return "Protected table query ok";
    }),
  ]);
};
