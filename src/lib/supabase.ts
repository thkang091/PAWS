import "react-native-url-polyfill/auto";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { env } from "@/config/env";

export const supabase: SupabaseClient | null = env.isValid
  ? createClient(env.data.supabaseUrl, env.data.supabaseAnonKey, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
        // Linking Apple or Google comes back to paws://auth/callback with a one-time code, exchanged in the app.
        flowType: "pkce",
      },
    })
  : null;

export const getSupabaseClient = (): SupabaseClient | null => supabase;
