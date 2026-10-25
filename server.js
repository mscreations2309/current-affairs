// Local web server for the current affairs page.
// Serves the site and exposes POST /api/refresh, which fetches the latest news.
// Run: node server.js   then open http://localhost:3000

const http = require("http");
const fs = require("fs");
const path = require("path");
const { update } = require("./fetch-news");

const PORT = Number(process.env.PORT) || 3000;
const ROOT = __dirname;
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

let running = null; // share one fetch if Refresh is clicked repeatedly

function send(res, status, body, type = "application/json; charset=utf-8") {
  res.writeHead(status, { "Content-Type": type, "Cache-Control": "no-store" });
  res.end(body);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === "/api/refresh" && req.method === "POST") {
    try {
      running = running || update();
      const { added, failed, db } = await running;
      send(res, 200, JSON.stringify({ added, failed, data: db }));
    } catch (e) {
      send(res, 500, JSON.stringify({ error: e.message }));
    } finally {
      running = null;
    }
    return;
  }

  // Static files, restricted to the project folder.
  const file = path.normalize(path.join(ROOT, decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname)));
  if (!file.startsWith(ROOT) || path.basename(file).startsWith(".")) return send(res, 403, "Forbidden", "text/plain");
  fs.readFile(file, (err, buf) => {
    if (err) return send(res, 404, "Not found", "text/plain");
    send(res, 200, buf, TYPES[path.extname(file)] || "application/octet-stream");
  });
});

// Bind to this computer only, so nobody else on the network can use it.
server.listen(PORT, "127.0.0.1", () => {
  console.log(`UPSC Current Affairs running at http://localhost:${PORT}`);
  console.log("Keep this window open while using the page. Press Ctrl+C to stop.");
  if (process.argv.includes("--open")) {
    require("child_process").exec(`start "" http://localhost:${PORT}`);
  }
});
