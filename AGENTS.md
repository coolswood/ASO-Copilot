# Stack notes for coding agents

This project is Bun + Vite (React 19, React Router) + Hono + Drizzle ORM + PostgreSQL — no Next.js, no Prisma. Key facts:

- `bun run typecheck` is the gate; run it before considering any change done. `bun run lint` should stay warning-clean or better.
- `bun run dev` starts Vite (UI on http://localhost:5173, proxies /api) and the Hono API on :3000 concurrently.
- DB access goes through Drizzle: schema in `src/db/schema.ts` (`@/db` re-exports the client), migrations in `drizzle/` (`bun run db:generate` / `db:migrate`).
- REST routes live in `server/routes/**`, the MCP server in `server/mcp.ts`, pages in `src/pages/**`, shared logic in `src/lib/**`.
