import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { fileURLToPath } from "node:url";

import app from "../dist/server/server.js";

const host = process.env.HOST || "0.0.0.0";
const port = Number(process.env.PORT || 3000);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientRoot = path.resolve(__dirname, "../dist/client");

const CONTENT_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".webp": "image/webp",
};

function canHaveBody(method) {
  return method !== "GET" && method !== "HEAD";
}

function isStaticRequest(pathname) {
  return pathname === "/favicon.png" || pathname.startsWith("/assets/");
}

function resolveStaticPath(pathname) {
  const decoded = decodeURIComponent(pathname);
  const relative = decoded.replace(/^\/+/, "");
  const absolute = path.resolve(clientRoot, relative);
  if (!absolute.startsWith(clientRoot)) {
    return null;
  }
  return absolute;
}

function serveStatic(pathname, req, res) {
  const absolutePath = resolveStaticPath(pathname);
  if (!absolutePath || !fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isFile()) {
    return false;
  }

  const ext = path.extname(absolutePath).toLowerCase();
  const contentType = CONTENT_TYPES[ext] || "application/octet-stream";
  res.statusCode = 200;
  res.setHeader("content-type", contentType);
  res.setHeader("cache-control", "public, max-age=31536000, immutable");

  if (req.method === "HEAD") {
    res.end();
    return true;
  }

  fs.createReadStream(absolutePath).pipe(res);
  return true;
}

const server = http.createServer(async (req, res) => {
  try {
    const origin = `http://${req.headers.host || `${host}:${port}`}`;
    const url = new URL(req.url || "/", origin);
    if (isStaticRequest(url.pathname) && serveStatic(url.pathname, req, res)) {
      return;
    }

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
