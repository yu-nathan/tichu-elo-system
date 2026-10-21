import http from "node:http";
import https from "node:https";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const [input, output] = process.argv.slice(2);
if (!input || !output)
  throw new Error("Usage: npm run measure:server -- <origin> <output.json>");
const url = new URL(input);
if (!["http:", "https:"].includes(url.protocol) || url.username || url.password)
  throw new Error("Use an HTTP(S) origin without credentials.");
const client = url.protocol === "https:" ? https : http;
const agent = new client.Agent({ keepAlive: true });
const rows = [];
try {
  for (let run = 1; run <= 5; run++) {
    for (const path of ["/icon.svg", "/api/dashboard", "/"]) {
      const start = performance.now();
      const row = { run, path, startedAt: new Date().toISOString() };
      await new Promise((resolve, reject) => {
        const request = client.get(
          new URL(path, url.origin),
          { agent },
          (response) => {
            row.ttfbMs = performance.now() - start;
            row.status = response.statusCode;
            row.serverTiming = response.headers["server-timing"] ?? null;
            row.rayId = response.headers["cf-ray"] ?? null;
            row.cache = response.headers["cache-control"] ?? null;
            response.resume();
            response.on("error", reject);
            response.on("end", () => {
              row.totalMs = performance.now() - start;
              resolve();
            });
          },
        );
        request.on("socket", (socket) => {
          row.reused = request.reusedSocket;
          if (request.reusedSocket) return;
          socket.once("lookup", () => {
            row.dnsMs = performance.now() - start;
          });
          socket.once("connect", () => {
            row.tcpMs = performance.now() - start;
          });
          socket.once("secureConnect", () => {
            row.tlsMs = performance.now() - start;
          });
        });
        request.setTimeout(15000, () =>
          request.destroy(new Error("Request timed out")),
        );
        request.on("error", reject);
      });
      rows.push(row);
      console.log(JSON.stringify(row));
    }
  }
} finally {
  agent.destroy();
  await mkdir(dirname(output), { recursive: true });
  // Aggregate timings and diagnostic IDs only; never response bodies or cookies.
  await writeFile(
    output,
    JSON.stringify({ origin: url.origin, rows }, null, 2) + "\n",
  );
}
