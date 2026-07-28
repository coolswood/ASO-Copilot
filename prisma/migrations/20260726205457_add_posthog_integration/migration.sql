-- AlterTable
ALTER TABLE "App" ADD COLUMN     "posthogApiKey" TEXT,
ADD COLUMN     "posthogConnectedAt" TIMESTAMP(3),
ADD COLUMN     "posthogHost" TEXT,
ADD COLUMN     "posthogProjectId" TEXT;
