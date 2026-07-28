-- CreateTable
CREATE TABLE "KeywordCountryRank" (
    "id" TEXT NOT NULL,
    "keywordId" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "position" INTEGER,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KeywordCountryRank_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "KeywordCountryRank_keywordId_country_checkedAt_idx" ON "KeywordCountryRank"("keywordId", "country", "checkedAt");

-- AddForeignKey
ALTER TABLE "KeywordCountryRank" ADD CONSTRAINT "KeywordCountryRank_keywordId_fkey" FOREIGN KEY ("keywordId") REFERENCES "Keyword"("id") ON DELETE CASCADE ON UPDATE CASCADE;
