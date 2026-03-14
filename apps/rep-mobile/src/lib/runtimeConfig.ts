function normalizeEnvString(s: string): string {
  let out = String(s ?? "").trim();
  out = out.replace(/\\"/g, '"').replace(/\\'/g, "'");
  for (let i = 0; i < 3; i++) {
    const t = out.trim();
    if (t.length >= 2) {
      const a = t[0];
      const b = t[t.length - 1];
      if ((a === '"' && b === '"') || (a === "'" && b === "'")) {
        out = t.slice(1, -1);
        continue;
      }
    }
    break;
  }
  return out.trim();
}

function parseBooleanEnv(v: unknown): boolean {
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0;
  if (typeof v !== "string") return false;
  const s = normalizeEnvString(v).toLowerCase();
  return s === "true" || s === "1" || s === "yes" || s === "on";
}

export const config = {
  mockMode: parseBooleanEnv(process.env.EXPO_PUBLIC_SALES_MOCK_MODE),
  apiUrl: normalizeEnvString(process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:4000"),
  supabaseUrl: normalizeEnvString(process.env.EXPO_PUBLIC_SUPABASE_URL ?? ""),
  supabaseAnonKey: normalizeEnvString(process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? ""),
  mapboxAccessToken: normalizeEnvString(process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN ?? ""),
  mapboxStyleUrl: normalizeEnvString(process.env.EXPO_PUBLIC_MAPBOX_STYLE_URL ?? "mapbox://styles/mapbox/streets-v12")
};

export function hasApiConfig() {
  return !!config.apiUrl;
}

export function hasSupabaseConfig() {
  return !!config.supabaseUrl && !!config.supabaseAnonKey;
}
