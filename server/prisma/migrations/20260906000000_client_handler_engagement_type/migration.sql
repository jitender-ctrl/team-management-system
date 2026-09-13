-- CreateEnum
CREATE TYPE "ClientEngagementType" AS ENUM ('PART_TIME', 'FULL_TIME');

-- AlterTable
ALTER TABLE "Client" ADD COLUMN "engagementType" "ClientEngagementType";
ALTER TABLE "Client" ADD COLUMN "handledById" INTEGER;

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_handledById_fkey" FOREIGN KEY ("handledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
