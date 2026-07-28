import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  // posthogApiKey is a secret credential - omit it from every query by
  // default so it can never leak through a spread `...app` response (REST or
  // MCP). The one place that needs it (verifying/using the connection)
  // re-fetches it explicitly with `{ omit: { posthogApiKey: false } }`.
  new PrismaClient({ adapter, omit: { app: { posthogApiKey: true } } });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
