CREATE TYPE "public"."Platform" AS ENUM('IOS', 'ANDROID');--> statement-breakpoint
CREATE TABLE "AiCopySuggestion" (
	"id" text PRIMARY KEY NOT NULL,
	"appId" text NOT NULL,
	"locale" text NOT NULL,
	"suggestions" jsonb NOT NULL,
	"source" text NOT NULL,
	"createdAt" timestamp (3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp (3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "AppLocalization" (
	"id" text PRIMARY KEY NOT NULL,
	"appId" text NOT NULL,
	"locale" text NOT NULL,
	"title" text,
	"subtitle" text,
	"description" text,
	"titleLocalized" boolean DEFAULT false NOT NULL,
	"score" integer NOT NULL,
	"breakdown" jsonb NOT NULL,
	"issues" jsonb NOT NULL,
	"lastSyncedAt" timestamp (3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"createdAt" timestamp (3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "App" (
	"id" text PRIMARY KEY NOT NULL,
	"platform" "Platform" NOT NULL,
	"storeId" text NOT NULL,
	"name" text NOT NULL,
	"developer" text,
	"iconUrl" text,
	"url" text,
	"category" text,
	"rating" double precision,
	"ratingCount" integer,
	"title" text,
	"subtitle" text,
	"description" text,
	"screenshotCount" integer,
	"screenshotUrls" text[] DEFAULT ARRAY[]::text[],
	"languageCount" integer,
	"version" text,
	"lastUpdated" timestamp (3),
	"pinned" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp (3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp (3) NOT NULL,
	"posthogHost" text,
	"posthogProjectId" text,
	"posthogApiKey" text,
	"posthogConnectedAt" timestamp (3)
);
--> statement-breakpoint
CREATE TABLE "CompetitorRank" (
	"id" text PRIMARY KEY NOT NULL,
	"competitorId" text NOT NULL,
	"keywordId" text NOT NULL,
	"position" integer,
	"checkedAt" timestamp (3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Competitor" (
	"id" text PRIMARY KEY NOT NULL,
	"appId" text NOT NULL,
	"platform" "Platform" NOT NULL,
	"storeId" text NOT NULL,
	"name" text NOT NULL,
	"iconUrl" text,
	"rating" double precision,
	"ratingCount" integer,
	"title" text,
	"subtitle" text,
	"description" text,
	"screenshotCount" integer,
	"screenshotUrls" text[] DEFAULT ARRAY[]::text[],
	"lastUpdated" timestamp (3),
	"lastSyncedAt" timestamp (3),
	"createdAt" timestamp (3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "HealthReport" (
	"id" text PRIMARY KEY NOT NULL,
	"appId" text NOT NULL,
	"score" integer NOT NULL,
	"breakdown" jsonb NOT NULL,
	"suggestions" jsonb NOT NULL,
	"createdAt" timestamp (3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "KeywordCountryRank" (
	"id" text PRIMARY KEY NOT NULL,
	"keywordId" text NOT NULL,
	"country" text NOT NULL,
	"position" integer,
	"checkedAt" timestamp (3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "KeywordRank" (
	"id" text PRIMARY KEY NOT NULL,
	"keywordId" text NOT NULL,
	"position" integer,
	"checkedAt" timestamp (3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "KeywordSuggestion" (
	"id" text PRIMARY KEY NOT NULL,
	"appId" text NOT NULL,
	"term" text NOT NULL,
	"volume" integer,
	"difficulty" integer,
	"source" text NOT NULL,
	"createdAt" timestamp (3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Keyword" (
	"id" text PRIMARY KEY NOT NULL,
	"appId" text NOT NULL,
	"term" text NOT NULL,
	"country" text DEFAULT 'us' NOT NULL,
	"volume" integer,
	"difficulty" integer,
	"createdAt" timestamp (3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Review" (
	"id" text PRIMARY KEY NOT NULL,
	"appId" text NOT NULL,
	"externalId" text NOT NULL,
	"rating" integer,
	"title" text,
	"text" text,
	"authorName" text,
	"version" text,
	"country" text,
	"reviewedAt" timestamp (3),
	"createdAt" timestamp (3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
ALTER TABLE "AiCopySuggestion" ADD CONSTRAINT "AiCopySuggestion_appId_fkey" FOREIGN KEY ("appId") REFERENCES "public"."App"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "AppLocalization" ADD CONSTRAINT "AppLocalization_appId_fkey" FOREIGN KEY ("appId") REFERENCES "public"."App"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "CompetitorRank" ADD CONSTRAINT "CompetitorRank_competitorId_fkey" FOREIGN KEY ("competitorId") REFERENCES "public"."Competitor"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "CompetitorRank" ADD CONSTRAINT "CompetitorRank_keywordId_fkey" FOREIGN KEY ("keywordId") REFERENCES "public"."Keyword"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "Competitor" ADD CONSTRAINT "Competitor_appId_fkey" FOREIGN KEY ("appId") REFERENCES "public"."App"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "HealthReport" ADD CONSTRAINT "HealthReport_appId_fkey" FOREIGN KEY ("appId") REFERENCES "public"."App"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "KeywordCountryRank" ADD CONSTRAINT "KeywordCountryRank_keywordId_fkey" FOREIGN KEY ("keywordId") REFERENCES "public"."Keyword"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "KeywordRank" ADD CONSTRAINT "KeywordRank_keywordId_fkey" FOREIGN KEY ("keywordId") REFERENCES "public"."Keyword"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "KeywordSuggestion" ADD CONSTRAINT "KeywordSuggestion_appId_fkey" FOREIGN KEY ("appId") REFERENCES "public"."App"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "Keyword" ADD CONSTRAINT "Keyword_appId_fkey" FOREIGN KEY ("appId") REFERENCES "public"."App"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "Review" ADD CONSTRAINT "Review_appId_fkey" FOREIGN KEY ("appId") REFERENCES "public"."App"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE UNIQUE INDEX "AiCopySuggestion_appId_locale_key" ON "AiCopySuggestion" USING btree ("appId","locale");--> statement-breakpoint
CREATE UNIQUE INDEX "AppLocalization_appId_locale_key" ON "AppLocalization" USING btree ("appId","locale");--> statement-breakpoint
CREATE UNIQUE INDEX "App_platform_storeId_key" ON "App" USING btree ("platform","storeId");--> statement-breakpoint
CREATE INDEX "CompetitorRank_competitorId_keywordId_checkedAt_idx" ON "CompetitorRank" USING btree ("competitorId","keywordId","checkedAt");--> statement-breakpoint
CREATE UNIQUE INDEX "Competitor_appId_platform_storeId_key" ON "Competitor" USING btree ("appId","platform","storeId");--> statement-breakpoint
CREATE INDEX "KeywordCountryRank_keywordId_country_checkedAt_idx" ON "KeywordCountryRank" USING btree ("keywordId","country","checkedAt");--> statement-breakpoint
CREATE INDEX "KeywordRank_keywordId_checkedAt_idx" ON "KeywordRank" USING btree ("keywordId","checkedAt");--> statement-breakpoint
CREATE UNIQUE INDEX "KeywordSuggestion_appId_term_key" ON "KeywordSuggestion" USING btree ("appId","term");--> statement-breakpoint
CREATE UNIQUE INDEX "Keyword_appId_term_country_key" ON "Keyword" USING btree ("appId","term","country");--> statement-breakpoint
CREATE INDEX "Review_appId_reviewedAt_idx" ON "Review" USING btree ("appId","reviewedAt");--> statement-breakpoint
CREATE UNIQUE INDEX "Review_appId_externalId_key" ON "Review" USING btree ("appId","externalId");