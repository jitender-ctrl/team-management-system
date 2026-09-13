-- CreateTable
CREATE TABLE "MeetingGuest" (
    "id" SERIAL NOT NULL,
    "meetingId" INTEGER NOT NULL,
    "clientId" INTEGER,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "emailSent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MeetingGuest_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "MeetingGuest" ADD CONSTRAINT "MeetingGuest_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingGuest" ADD CONSTRAINT "MeetingGuest_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
