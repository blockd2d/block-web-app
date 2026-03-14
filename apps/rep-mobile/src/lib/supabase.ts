import "react-native-url-polyfill/auto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { config } from "./runtimeConfig";

let _client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (_client) return _client;
  if (!config.supabaseUrl || !config.supabaseAnonKey) return null;

  _client = createClient(config.supabaseUrl, config.supabaseAnonKey, {
    auth: {
      // We intentionally disable supabase-js built-in session persistence.
      // This app manages session storage via SecureStore in src/state.ts.
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    }
  });

  return _client;
}
