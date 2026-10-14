#!/usr/bin/env node
/**
 * One public entrance for the whole app (used by the Cloudflare tunnel).
 *
 *   /api, /socket.io, /uploads  ->  API server   (127.0.0.1:4001)
 *   everything else             ->  web app      (127.0.0.1:3300)
 *
 * Because the browser only ever talks to this one address, the tunnel's address can change
 * without rebuilding anything. Visitors' real IP addresses are passed on (X-Forwarded-For),
 * so per-IP rate limits keep working. Live updates (WebSocket) are forwarded too.
 *
 * Listens on 127.0.0.1 only: the tunnel is the way in from the internet.
 */
import http from "node:http";
import net from "node:net";

const PORT = Number(process.env.GATEWAY_PORT || 3400);
const API = { host: "127.0.0.1", port: Number(process.env.API_PORT || 4001) };
const WEB = { host: "127.0.0.1", port: Number(process.env.WEB_PORT || 3300) };

function targetFor(url = "/") {
  return /^\/(api|socket\.io|uploads)(\/|\?|$)/.test(url) ? API : WEB;
}

function forwardedHeaders(req) {
  const headers = { ...req.headers };
  const prior = req.headers["x-forwarded-for"];
  const remote = req.socket.remoteAddress ?? "";
  headers["x-forwarded-for"] = prior ? `${prior}, ${remote}` : remote;
  headers["x-forwarded-proto"] = req.headers["x-forwarded-proto"] ?? "http";
  headers["x-forwarded-host"] = req.headers["x-forwarded-host"] ?? req.headers.host ?? "";
  return headers;
}

const server = http.createServer((req, res) => {
  // One canonical address: www.example.com -> example.com (sign-in cookies and the API's
  // allowed origin are tied to one address).
  const host = String(req.headers["x-forwarded-host"] ?? req.headers.host ?? "");
  if (/^www\./i.test(host)) {
    res.writeHead(301, { Location: `https://${host.replace(/^www\./i, "")}${req.url ?? "/"}` });
    res.end();
    return;
  }
  const target = targetFor(req.url);
  const upstream = http.request(
    { ...target, method: req.method, path: req.url, headers: forwardedHeaders(req) },
    (upstreamRes) => {
      res.writeHead(upstreamRes.statusCode ?? 502, upstreamRes.headers);
      upstreamRes.pipe(res);
    },
  );
  upstream.on("error", () => {
    if (!res.headersSent) res.writeHead(502, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Nexus Forge Gaming is restarting. Try again in a moment.");
  });
  req.pipe(upstream);
});

// WebSocket (live chat, voice signalling): pass the raw connection through.
server.on("upgrade", (req, socket, head) => {
  const target = targetFor(req.url);
  const upstream = net.connect(target.port, target.host, () => {
    const headers = forwardedHeaders(req);
    const lines = [`${req.method} ${req.url} HTTP/${req.httpVersion}`];
    for (const [name, value] of Object.entries(headers)) {
      for (const v of Array.isArray(value) ? value : [value]) if (v !== undefined) lines.push(`${name}: ${v}`);
    }
    upstream.write(lines.join("\r\n") + "\r\n\r\n");
    if (head?.length) upstream.write(head);
    upstream.pipe(socket);
    socket.pipe(upstream);
  });
  const close = () => {
    socket.destroy();
    upstream.destroy();
  };
  upstream.on("error", close);
  socket.on("error", close);
});

server.keepAliveTimeout = 65_000;
server.listen(PORT, "127.0.0.1", () => {
  console.log(`[gateway] http://127.0.0.1:${PORT}  (api -> ${API.port}, web -> ${WEB.port})`);
});
