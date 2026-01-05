/**
 * Minimal dev server for the static app (no dependencies).
 * Serves apps/web directly and injects config.js from env at runtime.
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const port = process.env.PORT ? Number(process.env.PORT) : 5173;
const root = path.resolve("apps/web");

function contentType(p) {
  if (p.endsWith(".html")) return "text/html; charset=utf-8";
  if (p.endsWith(".css")) return "text/css; charset=utf-8";
  if (p.endsWith(".js")) return "application/javascript; charset=utf-8";
  if (p.endsWith(".json")) return "application/json; charset=utf-8";
  if (p.endsWith(".png")) return "image/png";
  if (p.endsWith(".svg")) return "image/svg+xml";
  if (p.endsWith(".ico")) return "image/x-icon";
  return "application/octet-stream";
}

function readFileSafe(fp) {
  try { return fs.readFileSync(fp); } catch { return null; }
}

const server = http.createServer((req, res) => {
  const parsed = url.parse(req.url || "/");
  let pathname = decodeURIComponent(parsed.pathname || "/");

  if (pathname === "/") pathname = "/index.html";

  // Dynamic runtime config.js (dev)
  if (pathname === "/config.js") {
    const cfg = {
      POSTHOG_KEY: process.env.POSTHOG_KEY || "",
      POSTHOG_HOST: process.env.POSTHOG_HOST || "https://app.posthog.com",
      SUPABASE_URL: process.env.SUPABASE_URL || "",
      SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || "",
      API_BASE_URL: process.env.API_BASE_URL || ""
    };
    res.writeHead(200, { "Content-Type": "application/javascript; charset=utf-8", "Cache-Control": "no-store" });
    return res.end(`window.BLOCK_CONFIG = ${JSON.stringify(cfg)};`);
  }

  const fp = path.join(root, pathname);
  const data = readFileSafe(fp);
  if (!data) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    return res.end("Not found");
  }
  res.writeHead(200, { "Content-Type": contentType(fp) });
  res.end(data);
});

server.listen(port, () => {
  console.log(`✅ Dev server running: http://localhost:${port}`);
});
