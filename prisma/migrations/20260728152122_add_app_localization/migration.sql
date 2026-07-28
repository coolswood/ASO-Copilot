-- CreateTable
CREATE TABLE "AppLocalization" (
    "id" TEXT NOT NULL,
    "appId" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "title" TEXT,
    "subtitle" TEXT,
    "description" TEXT,
    "titleLocalized" BOOLEAN NOT NULL DEFAULT false,
    "score" INTEGER NOT NULL,
    "breakdown" JSONB NOT NULL,
    "issues" JSONB NOT NULL,
    "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AppLocalization_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AppLocalization_appId_locale_key" ON "AppLocalization"("appId", "locale");

-- AddForeignKey
ALTER TABLE "AppLocalization" ADD CONSTRAINT "AppLocalization_appId_fkey" FOREIGN KEY ("appId") REFERENCES "App"("id") ON DELETE CASCADE ON UPDATE CASCADE;
