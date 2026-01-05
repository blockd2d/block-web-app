import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const repoRoot = path.resolve(__dirname, "..");
const webSrc = path.join(repoRoot, "apps", "web");
const dist = path.join(repoRoot, "dist");

function rmrf(p) {
  if (!fs.existsSync(p)) return;
  fs.rmSync(p, { recursive: true, force: true });
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const ent of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, ent.name);
    const d = path.join(dest, ent.name);
    if (ent.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

function writeConfig() {
  const cfg = {
    POSTHOG_KEY: process.env.POSTHOG_KEY || "",
    POSTHOG_HOST: process.env.POSTHOG_HOST || "https://app.posthog.com",
    SUPABASE_URL: process.env.SUPABASE_URL || "",
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || "",
    API_BASE_URL: process.env.API_BASE_URL || ""
  };
  const out = `// Generated at build time\nwindow.BLOCK_CONFIG = ${JSON.stringify(cfg, null, 2)};\n`;
  fs.writeFileSync(path.join(dist, "config.js"), out, "utf-8");
}

rmrf(dist);
copyDir(webSrc, dist);
writeConfig();

console.log("✅ Built dist/ with runtime config.js");
