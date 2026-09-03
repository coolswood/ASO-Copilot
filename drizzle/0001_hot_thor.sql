DROP INDEX "Competitor_appId_platform_storeId_key";--> statement-breakpoint
DROP INDEX "KeywordSuggestion_appId_term_key";--> statement-breakpoint
ALTER TABLE "App" ADD COLUMN "country" text DEFAULT 'us' NOT NULL;--> statement-breakpoint
ALTER TABLE "Competitor" ADD COLUMN "country" text DEFAULT 'us' NOT NULL;--> statement-breakpoint
ALTER TABLE "KeywordSuggestion" ADD COLUMN "country" text DEFAULT 'us' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "Competitor_appId_platform_storeId_country_key" ON "Competitor" USING btree ("appId","platform","storeId","country");--> statement-breakpoint
CREATE UNIQUE INDEX "KeywordSuggestion_appId_term_country_key" ON "KeywordSuggestion" USING btree ("appId","term","country");