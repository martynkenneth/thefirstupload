// Tiny static server for previewing dist/. Usage: node scripts/serve.mjs [port]
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Resolve dist/ from this script's location so it works from any working directory.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "dist");
const port = Number(process.argv[2]) || 4173;
const types = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".json": "application/json", ".svg": "image/svg+xml" };

http.createServer((req, res) => {
  let file = path.join(root, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (!file.startsWith(root)) return res.writeHead(403).end();
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, "index.html");
  fs.readFile(file, (err, data) => {
    if (err) return res.writeHead(404).end("Not found");
    res.writeHead(200, { "Content-Type": types[path.extname(file)] || "application/octet-stream" }).end(data);
  });
}).listen(port, () => console.log(`Serving dist/ at http://localhost:${port}`));
