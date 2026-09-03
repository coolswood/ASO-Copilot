import { apps } from "@/db/schema";

/** Columns used whenever an app row is returned to a client (INSERT/UPDATE
 * `.returning(...)`). Mirrors APP_COLUMNS / findApp in src/lib/appService.ts:
 * `posthogApiKey` is a secret credential and is never selected. */
export const APP_RETURNING_COLUMNS = {
  id: apps.id,
  platform: apps.platform,
  storeId: apps.storeId,
  name: apps.name,
  developer: apps.developer,
  iconUrl: apps.iconUrl,
  url: apps.url,
  category: apps.category,
  rating: apps.rating,
  ratingCount: apps.ratingCount,
  title: apps.title,
  subtitle: apps.subtitle,
  description: apps.description,
  screenshotCount: apps.screenshotCount,
  screenshotUrls: apps.screenshotUrls,
  languageCount: apps.languageCount,
  version: apps.version,
  lastUpdated: apps.lastUpdated,
  pinned: apps.pinned,
  createdAt: apps.createdAt,
  updatedAt: apps.updatedAt,
  posthogHost: apps.posthogHost,
  posthogProjectId: apps.posthogProjectId,
  posthogConnectedAt: apps.posthogConnectedAt,
} as const;

/** Postgres.js equivalent of the old `message.includes("Unique constraint")`
 * duplicate check the Next.js routes did on Prisma errors: a unique-violation
 * is SQLSTATE 23505 (message "duplicate key value violates unique
 * constraint"). Drizzle wraps query errors in a plain Error with the original
 * PostgresError on `.cause`, so the SQLSTATE is checked through the whole
 * cause/error chain. Everything else keeps the old non-duplicate status
 * mapping (e.g. 502). */
export function isUniqueViolation(e: unknown, depth = 0): boolean {
  if (!e || typeof e !== "object" || depth > 5) return false;
  const err = e as { code?: unknown; message?: unknown; cause?: unknown; error?: unknown };
  if (err.code === "23505") return true;
  if (typeof err.message === "string" && /duplicate key|unique constraint/i.test(err.message)) {
    return true;
  }
  return isUniqueViolation(err.cause, depth + 1) || isUniqueViolation(err.error, depth + 1);
}
