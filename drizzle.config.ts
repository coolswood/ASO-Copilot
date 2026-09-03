import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  // Prisma's migration bookkeeping table stays owned by Prisma while both
  // ORMs coexist; without this, push wants to drop it.
  tablesFilter: ["!_prisma_migrations"],
  dbCredentials: { url: process.env.DATABASE_URL! },
});
