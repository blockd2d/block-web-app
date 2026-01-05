import fs from "node:fs";
import path from "node:path";

const dist = path.resolve("dist");
const target = path.join(dist, "runtime-config.js");

const keys = ["SUPABASE_URL","SUPABASE_ANON_KEY","RAILWAY_API_BASE_URL","MAPBOX_TOKEN","POSTHOG_KEY","POSTHOG_HOST"];
const cfg = {};
for (const k of keys) {
  const v = process.env[k];
  if (v) cfg[k] = v;
}
const content = `window.__RUNTIME_CONFIG__ = ${JSON.stringify(cfg, null, 2)};\n`;
fs.writeFileSync(target, content, "utf8");
console.log("Wrote", target);
