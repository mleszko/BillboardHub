import http from "node:http";
import { Readable } from "node:stream";

import app from "../dist/server/server.js";

const host = process.env.HOST || "0.0.0.0";
const port = Number(process.env.PORT || 3000);

function canHaveBody(method) {
  return method !== "GET" && method !== "HEAD";
}

const server = http.createServer(async (req, res) => {
  try {
    const origin = `http://${req.headers.host || `${host}:${port}`}`;
    const url = new URL(req.url || "/", origin);

    const request = new Request(url, {
      method: req.method,
      headers: req.headers,
      body: canHaveBody(req.method || "GET") ? Readable.toWeb(req) : undefined,
      duplex: canHaveBody(req.method || "GET") ? "half" : undefined,
    });

    const response = await app.fetch(request);

    const headers = {};
    response.headers.forEach((value, key) => {
      headers[key] = value;
    });

    res.writeHead(response.status, headers);

    if (response.body) {
      Readable.fromWeb(response.body).pipe(res);
    } else {
      res.end();
    }
  } catch (error) {
    res.statusCode = 500;
    res.setHeader("content-type", "text/plain; charset=utf-8");
    res.end("Internal Server Error");
    console.error("[railway-ssr] request failed:", error);
  }
});

server.listen(port, host, () => {
  console.log(`[railway-ssr] listening on http://${host}:${port}`);
});
