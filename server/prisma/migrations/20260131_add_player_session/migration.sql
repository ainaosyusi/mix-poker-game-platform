-- CreateTable
CREATE TABLE "PlayerSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "gameVariant" TEXT NOT NULL,
    "buyIn" INTEGER NOT NULL,
    "addOns" INTEGER NOT NULL DEFAULT 0,
    "cashOut" INTEGER,
    "handsPlayed" INTEGER NOT NULL DEFAULT 0,
    "handsWon" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "PlayerSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlayerSession_userId_idx" ON "PlayerSession"("userId");

-- CreateIndex
CREATE INDEX "PlayerSession_userId_startedAt_idx" ON "PlayerSession"("userId", "startedAt");

-- AddForeignKey
ALTER TABLE "PlayerSession" ADD CONSTRAINT "PlayerSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
