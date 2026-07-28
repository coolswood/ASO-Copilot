-- AlterTable
ALTER TABLE "App" ADD COLUMN     "languageCount" INTEGER,
ADD COLUMN     "screenshotUrls" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "Competitor" ADD COLUMN     "screenshotUrls" TEXT[] DEFAULT ARRAY[]::TEXT[];
