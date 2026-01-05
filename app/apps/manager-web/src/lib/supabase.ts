import { createClient } from "@supabase/supabase-js";
import { getConfig } from "../config";

const cfg = getConfig();
export const supabase = createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true },
});
