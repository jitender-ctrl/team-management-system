-- AlterTable: extra profile fields on User
ALTER TABLE "User" ADD COLUMN "bio" TEXT;
ALTER TABLE "User" ADD COLUMN "phone" TEXT;
ALTER TABLE "User" ADD COLUMN "jobTitle" TEXT;

-- CreateTable
CREATE TABLE "DailyUpdate" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "date" DATE NOT NULL DEFAULT CURRENT_DATE,
    "content" TEXT NOT NULL,
    "hoursSpent" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyUpdate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DailyUpdate_userId_date_idx" ON "DailyUpdate"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "DailyUpdate_userId_date_key" ON "DailyUpdate"("userId", "date");

-- AddForeignKey
ALTER TABLE "DailyUpdate" ADD CONSTRAINT "DailyUpdate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
