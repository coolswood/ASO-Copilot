-- AlterTable
ALTER TABLE "Keyword" ADD COLUMN     "country" TEXT NOT NULL DEFAULT 'us';

-- DropIndex
DROP INDEX "Keyword_appId_term_key";

-- CreateIndex
CREATE UNIQUE INDEX "Keyword_appId_term_country_key" ON "Keyword"("appId", "term", "country");
