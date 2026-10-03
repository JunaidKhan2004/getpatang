-- CreateTable
CREATE TABLE "tournaments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "venue" TEXT NOT NULL,
    "venueAddress" TEXT,
    "startsAt" DATETIME NOT NULL,
    "endsAt" DATETIME,
    "registrationOpensAt" DATETIME NOT NULL,
    "registrationClosesAt" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "format" TEXT NOT NULL DEFAULT 'single_elimination',
    "maxParticipants" INTEGER NOT NULL,
    "minAge" INTEGER NOT NULL DEFAULT 16,
    "entryFee" INTEGER NOT NULL DEFAULT 0,
    "prizeInfo" TEXT,
    "rules" TEXT NOT NULL,
    "safetyRules" TEXT NOT NULL,
    "approvedMaterials" TEXT NOT NULL,
    "venueRestrictions" TEXT,
    "permitReference" TEXT,
    "organizerName" TEXT NOT NULL,
    "organizerContact" TEXT,
    "season" TEXT NOT NULL,
    "bannerUrl" TEXT,
    "cancelReason" TEXT,
    "createdById" TEXT NOT NULL,
    "publishedAt" DATETIME,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "tournaments_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "tournament_participants" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tournamentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "seed" INTEGER,
    "acceptedRulesAt" DATETIME NOT NULL,
    "statusNote" TEXT,
    "finalPlacement" INTEGER,
    "registeredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "tournament_participants_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "tournaments" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "tournament_participants_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "matches" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tournamentId" TEXT NOT NULL,
    "round" INTEGER NOT NULL,
    "matchNumber" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,
    "playerAId" TEXT,
    "playerBId" TEXT,
    "winnerId" TEXT,
    "scoreA" INTEGER,
    "scoreB" INTEGER,
    "isBye" BOOLEAN NOT NULL DEFAULT false,
    "isWalkover" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "scheduledAt" DATETIME,
    "location" TEXT,
    "officialId" TEXT,
    "nextMatchId" TEXT,
    "nextSlot" TEXT,
    "resultNote" TEXT,
    "disputeReason" TEXT,
    "disputedById" TEXT,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "matches_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "tournaments" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "matches_playerAId_fkey" FOREIGN KEY ("playerAId") REFERENCES "tournament_participants" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "matches_playerBId_fkey" FOREIGN KEY ("playerBId") REFERENCES "tournament_participants" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "matches_winnerId_fkey" FOREIGN KEY ("winnerId") REFERENCES "tournament_participants" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "matches_officialId_fkey" FOREIGN KEY ("officialId") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "match_results" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "matchId" TEXT NOT NULL,
    "submittedById" TEXT NOT NULL,
    "winnerId" TEXT NOT NULL,
    "scoreA" INTEGER,
    "scoreB" INTEGER,
    "isWalkover" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "evidenceUploadId" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'result',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "match_results_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "matches" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "match_results_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ranking_points" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "season" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "placement" INTEGER NOT NULL,
    "wins" INTEGER NOT NULL,
    "losses" INTEGER NOT NULL,
    "points" INTEGER NOT NULL,
    "awardedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ranking_points_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ranking_points_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "tournaments" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "tournaments_slug_key" ON "tournaments"("slug");

-- CreateIndex
CREATE INDEX "tournaments_status_startsAt_idx" ON "tournaments"("status", "startsAt");

-- CreateIndex
CREATE INDEX "tournaments_city_startsAt_idx" ON "tournaments"("city", "startsAt");

-- CreateIndex
CREATE INDEX "tournaments_season_idx" ON "tournaments"("season");

-- CreateIndex
CREATE INDEX "tournament_participants_tournamentId_status_idx" ON "tournament_participants"("tournamentId", "status");

-- CreateIndex
CREATE INDEX "tournament_participants_userId_idx" ON "tournament_participants"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "tournament_participants_tournamentId_userId_key" ON "tournament_participants"("tournamentId", "userId");

-- CreateIndex
CREATE INDEX "matches_tournamentId_round_position_idx" ON "matches"("tournamentId", "round", "position");

-- CreateIndex
CREATE INDEX "matches_officialId_status_idx" ON "matches"("officialId", "status");

-- CreateIndex
CREATE INDEX "matches_status_scheduledAt_idx" ON "matches"("status", "scheduledAt");

-- CreateIndex
CREATE UNIQUE INDEX "matches_tournamentId_matchNumber_key" ON "matches"("tournamentId", "matchNumber");

-- CreateIndex
CREATE INDEX "match_results_matchId_createdAt_idx" ON "match_results"("matchId", "createdAt");

-- CreateIndex
CREATE INDEX "ranking_points_season_city_idx" ON "ranking_points"("season", "city");

-- CreateIndex
CREATE INDEX "ranking_points_tournamentId_idx" ON "ranking_points"("tournamentId");

-- CreateIndex
CREATE UNIQUE INDEX "ranking_points_userId_tournamentId_key" ON "ranking_points"("userId", "tournamentId");
