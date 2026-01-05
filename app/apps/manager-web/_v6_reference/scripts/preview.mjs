/**
 * Preview dist/ after build.
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const port = process.env.PORT ? Number(process.env.PORT) : 4173;
const root = path.resolve("dist");

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

const server = http.createServer((req, res) => {
  const parsed = url.parse(req.url || "/");
  let pathname = decodeURIComponent(parsed.pathname || "/");
  if (pathname === "/") pathname = "/index.html";
  const fp = path.join(root, pathname);
  if (!fs.existsSync(fp) || fs.statSync(fp).isDirectory()) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    return res.end("Not found");
  }
  res.writeHead(200, { "Content-Type": contentType(fp) });
  res.end(fs.readFileSync(fp));
});

server.listen(port, () => console.log(`✅ Preview: http://localhost:${port}`));
