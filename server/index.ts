/// <reference types="bun" />
import { Hono } from "hono";
import { logger } from "hono/logger";
import apiRoutes from "./routes";
import mcpApp from "./mcp";

const app = new Hono();

app.use(logger());
app.route("/api", apiRoutes);
app.route("/api/mcp", mcpApp);

if (process.env.NODE_ENV === "production") {
  // Both the server and `vite build` are cwd-relative to the repo root.
  const distRoot = "dist";
  const indexHtml = Bun.file(`${distRoot}/index.html`);

  // Static assets from dist/. /api requests never hit this (or the SPA
  // fallback below) so unmatched API routes 404 instead of leaking the SPA.
  app.use("*", async (c, next) => {
    if (c.req.method === "GET" && !c.req.path.startsWith("/api")) {
      const rel = c.req.path.replace(/^\/+/, "");
      const segments = rel.split("/").filter(Boolean);
      if (segments.length > 0 && !segments.includes("..")) {
        const file = Bun.file(`${distRoot}/${segments.join("/")}`);
        if (await file.exists()) return new Response(file);
      }
    }
    return next();
  });

  app.get("*", async (c) => {
    if (c.req.path.startsWith("/api")) return c.text("Not Found", 404);
    if (!(await indexHtml.exists())) {
      return c.text(
        "dist/index.html not found — run `bun run build` before `bun run start`",
        500,
      );
    }
    return c.html(await indexHtml.text());
  });
}

const port = Number(process.env.PORT ?? 3000);

const server = Bun.serve({
  port,
  // Wrap rather than pass `app.fetch` directly: Bun passes its Server as the
  // second arg, which Hono would misinterpret as its Env binding.
  fetch: (req) => app.fetch(req),
});

console.log(`API server listening on http://localhost:${server.port}`);
