-- CreateTable
CREATE TABLE "ClientHandlerHistory" (
    "id" SERIAL NOT NULL,
    "clientId" INTEGER NOT NULL,
    "previousHandlerId" INTEGER,
    "newHandlerId" INTEGER,
    "reason" TEXT NOT NULL,
    "changedById" INTEGER,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientHandlerHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ClientHandlerHistory_clientId_idx" ON "ClientHandlerHistory"("clientId");

-- CreateIndex
CREATE INDEX "ClientHandlerHistory_previousHandlerId_idx" ON "ClientHandlerHistory"("previousHandlerId");

-- AddForeignKey
ALTER TABLE "ClientHandlerHistory" ADD CONSTRAINT "ClientHandlerHistory_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientHandlerHistory" ADD CONSTRAINT "ClientHandlerHistory_previousHandlerId_fkey" FOREIGN KEY ("previousHandlerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientHandlerHistory" ADD CONSTRAINT "ClientHandlerHistory_newHandlerId_fkey" FOREIGN KEY ("newHandlerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientHandlerHistory" ADD CONSTRAINT "ClientHandlerHistory_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
