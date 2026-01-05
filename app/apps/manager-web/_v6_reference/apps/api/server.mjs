import http from "node:http";
import url from "node:url";

const port = process.env.PORT ? Number(process.env.PORT) : 8080;

const server = http.createServer((req, res) => {
  const parsed = url.parse(req.url || "/");
  if (parsed.pathname === "/health") {
    res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    return res.end(JSON.stringify({ ok: true, service: "block-v6-api" }));
  }

  res.writeHead(404, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify({ error: "not_found" }));
});

server.listen(port, () => console.log(`✅ API listening on :${port}`));
