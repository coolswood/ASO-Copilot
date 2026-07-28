-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "appId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "rating" INTEGER,
    "title" TEXT,
    "text" TEXT,
    "authorName" TEXT,
    "version" TEXT,
    "country" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Review_appId_reviewedAt_idx" ON "Review"("appId", "reviewedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Review_appId_externalId_key" ON "Review"("appId", "externalId");

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_appId_fkey" FOREIGN KEY ("appId") REFERENCES "App"("id") ON DELETE CASCADE ON UPDATE CASCADE;
