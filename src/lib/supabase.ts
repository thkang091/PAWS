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
      },
    })
  : null;

export const getSupabaseClient = (): SupabaseClient | null => supabase;
