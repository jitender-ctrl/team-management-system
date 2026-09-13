-- AlterEnum: add GROUP conversation type (custom, user-named group chats
-- that aren't tied to a project)
ALTER TYPE "ConversationType" ADD VALUE 'GROUP';

-- AlterTable: Conversation gets a display name (for GROUP chats) and a
-- creator (so only the creator/admins can rename or remove members later)
ALTER TABLE "Conversation" ADD COLUMN "name" TEXT;
ALTER TABLE "Conversation" ADD COLUMN "createdById" INTEGER;

-- AlterTable: Message can now be file-only (body becomes optional) and
-- carries optional file attachment metadata
ALTER TABLE "Message" ALTER COLUMN "body" DROP NOT NULL;
ALTER TABLE "Message" ADD COLUMN "fileUrl" TEXT;
ALTER TABLE "Message" ADD COLUMN "fileName" TEXT;
ALTER TABLE "Message" ADD COLUMN "fileType" TEXT;
ALTER TABLE "Message" ADD COLUMN "fileSize" INTEGER;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
