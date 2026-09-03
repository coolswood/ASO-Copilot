import { relations, sql } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import {
  boolean,
  doublePrecision,
  foreignKey,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// Column types/names/defaults/constraints mirror the Prisma migrations
// byte-for-byte at the DDL level (verified via drizzle-kit push no-diff):
// timestamps are Prisma's `TIMESTAMP(3)` without timezone, defaults are the
// exact catalog expressions Prisma writes, and index/FK names match. New-row
// ids use cuid2 ($defaultFn) instead of Prisma's cuid — format-compatible
// enough for the same TEXT column.
const createdAt = () =>
  timestamp("createdAt", { precision: 3, mode: "date" })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`);

export const platformEnum = pgEnum("Platform", ["IOS", "ANDROID"]);

export const apps = pgTable(
  "App",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    platform: platformEnum("platform").notNull(),
    storeId: text("storeId").notNull(),
    name: text("name").notNull(),
    // Home storefront of the app - the market the owner primarily targets.
    // Drives the fallback for the global country selector when the URL has
    // no/invalid ?country=, and the storefront used for metadata/review sync
    // in the daily tracking pass. Lowercase ISO 3166-1 alpha-2, like every
    // other `country` column.
    country: text("country").notNull().default("us"),
    developer: text("developer"),
    iconUrl: text("iconUrl"),
    url: text("url"),
    category: text("category"),
    rating: doublePrecision("rating"),
    ratingCount: integer("ratingCount"),
    title: text("title"),
    subtitle: text("subtitle"),
    description: text("description"),
    screenshotCount: integer("screenshotCount"),
    screenshotUrls: text("screenshotUrls")
      .array()
      // Lowercase `text[]` matches how PG normalizes this default in the
      // catalog, so drizzle-kit push sees no diff against Prisma's DDL.
      .default(sql`ARRAY[]::text[]`),
    languageCount: integer("languageCount"),
    version: text("version"),
    lastUpdated: timestamp("lastUpdated", { precision: 3, mode: "date" }),
    pinned: boolean("pinned").notNull().default(false),
    createdAt: createdAt(),
    // Prisma's @updatedAt: no DDL default, set by the ORM on write.
    updatedAt: timestamp("updatedAt", { precision: 3, mode: "date" })
      .notNull()
      .$onUpdate(() => new Date()),
    posthogHost: text("posthogHost"),
    posthogProjectId: text("posthogProjectId"),
    posthogApiKey: text("posthogApiKey"),
    posthogConnectedAt: timestamp("posthogConnectedAt", {
      precision: 3,
      mode: "date",
    }),
  },
  (t) => [uniqueIndex("App_platform_storeId_key").on(t.platform, t.storeId)],
);

export const appLocalizations = pgTable(
  "AppLocalization",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    appId: text("appId").notNull(),
    locale: text("locale").notNull(),
    title: text("title"),
    subtitle: text("subtitle"),
    description: text("description"),
    titleLocalized: boolean("titleLocalized").notNull().default(false),
    score: integer("score").notNull(),
    breakdown: jsonb("breakdown").$type<unknown>().notNull(),
    issues: jsonb("issues").$type<unknown>().notNull(),
    lastSyncedAt: timestamp("lastSyncedAt", { precision: 3, mode: "date" })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("AppLocalization_appId_locale_key").on(t.appId, t.locale),
    foreignKey({
      name: "AppLocalization_appId_fkey",
      columns: [t.appId],
      foreignColumns: [apps.id],
    })
      .onDelete("cascade")
      .onUpdate("cascade"),
  ],
);

export const keywords = pgTable(
  "Keyword",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    appId: text("appId").notNull(),
    term: text("term").notNull(),
    country: text("country").notNull().default("us"),
    volume: integer("volume"),
    difficulty: integer("difficulty"),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("Keyword_appId_term_country_key").on(t.appId, t.term, t.country),
    foreignKey({
      name: "Keyword_appId_fkey",
      columns: [t.appId],
      foreignColumns: [apps.id],
    })
      .onDelete("cascade")
      .onUpdate("cascade"),
  ],
);

export const keywordRanks = pgTable(
  "KeywordRank",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    keywordId: text("keywordId").notNull(),
    position: integer("position"),
    checkedAt: timestamp("checkedAt", { precision: 3, mode: "date" })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (t) => [
    index("KeywordRank_keywordId_checkedAt_idx").on(t.keywordId, t.checkedAt),
    foreignKey({
      name: "KeywordRank_keywordId_fkey",
      columns: [t.keywordId],
      foreignColumns: [keywords.id],
    })
      .onDelete("cascade")
      .onUpdate("cascade"),
  ],
);

export const keywordCountryRanks = pgTable(
  "KeywordCountryRank",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    keywordId: text("keywordId").notNull(),
    country: text("country").notNull(),
    position: integer("position"),
    checkedAt: timestamp("checkedAt", { precision: 3, mode: "date" })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (t) => [
    index("KeywordCountryRank_keywordId_country_checkedAt_idx").on(
      t.keywordId,
      t.country,
      t.checkedAt,
    ),
    foreignKey({
      name: "KeywordCountryRank_keywordId_fkey",
      columns: [t.keywordId],
      foreignColumns: [keywords.id],
    })
      .onDelete("cascade")
      .onUpdate("cascade"),
  ],
);

export const competitors = pgTable(
  "Competitor",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    appId: text("appId").notNull(),
    platform: platformEnum("platform").notNull(),
    storeId: text("storeId").notNull(),
    name: text("name").notNull(),
    // Storefront the competitor was discovered in / is compared against.
    // The same store app can be a competitor in several markets, so country
    // is part of the identity (see the unique index below).
    country: text("country").notNull().default("us"),
    iconUrl: text("iconUrl"),
    rating: doublePrecision("rating"),
    ratingCount: integer("ratingCount"),
    title: text("title"),
    subtitle: text("subtitle"),
    description: text("description"),
    screenshotCount: integer("screenshotCount"),
    screenshotUrls: text("screenshotUrls")
      .array()
      .default(sql`ARRAY[]::text[]`),
    lastUpdated: timestamp("lastUpdated", { precision: 3, mode: "date" }),
    lastSyncedAt: timestamp("lastSyncedAt", { precision: 3, mode: "date" }),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("Competitor_appId_platform_storeId_country_key").on(
      t.appId,
      t.platform,
      t.storeId,
      t.country,
    ),
    foreignKey({
      name: "Competitor_appId_fkey",
      columns: [t.appId],
      foreignColumns: [apps.id],
    })
      .onDelete("cascade")
      .onUpdate("cascade"),
  ],
);

export const competitorRanks = pgTable(
  "CompetitorRank",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    competitorId: text("competitorId").notNull(),
    keywordId: text("keywordId").notNull(),
    position: integer("position"),
    checkedAt: timestamp("checkedAt", { precision: 3, mode: "date" })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (t) => [
    index("CompetitorRank_competitorId_keywordId_checkedAt_idx").on(
      t.competitorId,
      t.keywordId,
      t.checkedAt,
    ),
    foreignKey({
      name: "CompetitorRank_competitorId_fkey",
      columns: [t.competitorId],
      foreignColumns: [competitors.id],
    })
      .onDelete("cascade")
      .onUpdate("cascade"),
    foreignKey({
      name: "CompetitorRank_keywordId_fkey",
      columns: [t.keywordId],
      foreignColumns: [keywords.id],
    })
      .onDelete("cascade")
      .onUpdate("cascade"),
  ],
);

export const healthReports = pgTable(
  "HealthReport",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    appId: text("appId").notNull(),
    score: integer("score").notNull(),
    breakdown: jsonb("breakdown").$type<unknown>().notNull(),
    suggestions: jsonb("suggestions").$type<unknown>().notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    foreignKey({
      name: "HealthReport_appId_fkey",
      columns: [t.appId],
      foreignColumns: [apps.id],
    })
      .onDelete("cascade")
      .onUpdate("cascade"),
  ],
);

export const keywordSuggestions = pgTable(
  "KeywordSuggestion",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    appId: text("appId").notNull(),
    term: text("term").notNull(),
    // Storefront the suggestion was researched for - volume/difficulty are
    // measured against a specific market's search results, so the same term
    // can carry different numbers per country (part of the unique key).
    country: text("country").notNull().default("us"),
    volume: integer("volume"),
    difficulty: integer("difficulty"),
    source: text("source").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("KeywordSuggestion_appId_term_country_key").on(t.appId, t.term, t.country),
    foreignKey({
      name: "KeywordSuggestion_appId_fkey",
      columns: [t.appId],
      foreignColumns: [apps.id],
    })
      .onDelete("cascade")
      .onUpdate("cascade"),
  ],
);

export const reviews = pgTable(
  "Review",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    appId: text("appId").notNull(),
    externalId: text("externalId").notNull(),
    rating: integer("rating"),
    title: text("title"),
    text: text("text"),
    authorName: text("authorName"),
    version: text("version"),
    country: text("country"),
    reviewedAt: timestamp("reviewedAt", { precision: 3, mode: "date" }),
    createdAt: createdAt(),
  },
  (t) => [
    index("Review_appId_reviewedAt_idx").on(t.appId, t.reviewedAt),
    uniqueIndex("Review_appId_externalId_key").on(t.appId, t.externalId),
    foreignKey({
      name: "Review_appId_fkey",
      columns: [t.appId],
      foreignColumns: [apps.id],
    })
      .onDelete("cascade")
      .onUpdate("cascade"),
  ],
);

export const aiCopySuggestions = pgTable(
  "AiCopySuggestion",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    appId: text("appId").notNull(),
    locale: text("locale").notNull(),
    suggestions: jsonb("suggestions").$type<unknown>().notNull(),
    source: text("source").notNull(),
    createdAt: createdAt(),
    updatedAt: timestamp("updatedAt", { precision: 3, mode: "date" })
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex("AiCopySuggestion_appId_locale_key").on(t.appId, t.locale),
    foreignKey({
      name: "AiCopySuggestion_appId_fkey",
      columns: [t.appId],
      foreignColumns: [apps.id],
    })
      .onDelete("cascade")
      .onUpdate("cascade"),
  ],
);

// ---------------------------------------------------------------------------
// Relations (for the db.query.* relational API)
// ---------------------------------------------------------------------------

export const appsRelations = relations(apps, ({ many }) => ({
  keywords: many(keywords),
  competitors: many(competitors),
  healthReports: many(healthReports),
  suggestions: many(keywordSuggestions),
  reviews: many(reviews),
  aiCopySuggestions: many(aiCopySuggestions),
  localizations: many(appLocalizations),
}));

export const appLocalizationsRelations = relations(appLocalizations, ({ one }) => ({
  app: one(apps, {
    fields: [appLocalizations.appId],
    references: [apps.id],
  }),
}));

export const keywordsRelations = relations(keywords, ({ one, many }) => ({
  app: one(apps, { fields: [keywords.appId], references: [apps.id] }),
  ranks: many(keywordRanks),
  competitorRanks: many(competitorRanks),
  countryRanks: many(keywordCountryRanks),
}));

export const keywordRanksRelations = relations(keywordRanks, ({ one }) => ({
  keyword: one(keywords, {
    fields: [keywordRanks.keywordId],
    references: [keywords.id],
  }),
}));

export const keywordCountryRanksRelations = relations(keywordCountryRanks, ({ one }) => ({
  keyword: one(keywords, {
    fields: [keywordCountryRanks.keywordId],
    references: [keywords.id],
  }),
}));

export const competitorsRelations = relations(competitors, ({ one, many }) => ({
  app: one(apps, { fields: [competitors.appId], references: [apps.id] }),
  ranks: many(competitorRanks),
}));

export const competitorRanksRelations = relations(competitorRanks, ({ one }) => ({
  competitor: one(competitors, {
    fields: [competitorRanks.competitorId],
    references: [competitors.id],
  }),
  keyword: one(keywords, {
    fields: [competitorRanks.keywordId],
    references: [keywords.id],
  }),
}));

export const healthReportsRelations = relations(healthReports, ({ one }) => ({
  app: one(apps, { fields: [healthReports.appId], references: [apps.id] }),
}));

export const keywordSuggestionsRelations = relations(keywordSuggestions, ({ one }) => ({
  app: one(apps, {
    fields: [keywordSuggestions.appId],
    references: [apps.id],
  }),
}));

export const reviewsRelations = relations(reviews, ({ one }) => ({
  app: one(apps, { fields: [reviews.appId], references: [apps.id] }),
}));

export const aiCopySuggestionsRelations = relations(aiCopySuggestions, ({ one }) => ({
  app: one(apps, {
    fields: [aiCopySuggestions.appId],
    references: [apps.id],
  }),
}));
