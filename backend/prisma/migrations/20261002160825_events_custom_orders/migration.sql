-- CreateTable
CREATE TABLE "events" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "venue" TEXT NOT NULL,
    "venueAddress" TEXT,
    "startsAt" DATETIME NOT NULL,
    "endsAt" DATETIME,
    "organizerName" TEXT NOT NULL,
    "organizerContact" TEXT,
    "rules" TEXT,
    "safetyNotes" TEXT NOT NULL,
    "capacity" INTEGER,
    "registrationRequired" BOOLEAN NOT NULL DEFAULT true,
    "registrationClosesAt" DATETIME,
    "fee" INTEGER NOT NULL DEFAULT 0,
    "maxGuests" INTEGER NOT NULL DEFAULT 2,
    "bannerUrl" TEXT,
    "tournamentId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "cancelReason" TEXT,
    "createdById" TEXT NOT NULL,
    "publishedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "events_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "event_registrations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'CONFIRMED',
    "guests" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "event_registrations_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "event_registrations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "custom_designs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "design" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "custom_designs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "custom_order_requests" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "number" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "designId" TEXT,
    "designSnapshot" JSONB NOT NULL,
    "designName" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "requirements" TEXT NOT NULL,
    "budget" INTEGER,
    "deadline" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'REQUESTED',
    "quotePrice" INTEGER,
    "quoteDeliveryDays" INTEGER,
    "quoteNote" TEXT,
    "quoteValidUntil" DATETIME,
    "quotedAt" DATETIME,
    "orderId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "custom_order_requests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "custom_order_requests_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "shops" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "custom_order_requests_designId_fkey" FOREIGN KEY ("designId") REFERENCES "custom_designs" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "custom_order_requests_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "custom_order_messages" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "requestId" TEXT NOT NULL,
    "authorId" TEXT,
    "role" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "custom_order_messages_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "custom_order_requests" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "custom_order_messages_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_shops" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "logoUrl" TEXT,
    "bannerUrl" TEXT,
    "city" TEXT NOT NULL,
    "address" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "ratingAvg" REAL NOT NULL DEFAULT 0,
    "ratingCount" INTEGER NOT NULL DEFAULT 0,
    "followerCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "cnicNumber" TEXT,
    "payoutMethod" TEXT,
    "payoutAccountTitle" TEXT,
    "payoutAccountNumber" TEXT,
    "submittedAt" DATETIME,
    "reviewedAt" DATETIME,
    "reviewedById" TEXT,
    "reviewNote" TEXT,
    "acceptsCustomOrders" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "shops_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_shops" ("address", "bannerUrl", "city", "cnicNumber", "createdAt", "description", "email", "followerCount", "id", "isVerified", "logoUrl", "name", "ownerId", "payoutAccountNumber", "payoutAccountTitle", "payoutMethod", "phone", "ratingAvg", "ratingCount", "reviewNote", "reviewedAt", "reviewedById", "slug", "status", "submittedAt", "updatedAt") SELECT "address", "bannerUrl", "city", "cnicNumber", "createdAt", "description", "email", "followerCount", "id", "isVerified", "logoUrl", "name", "ownerId", "payoutAccountNumber", "payoutAccountTitle", "payoutMethod", "phone", "ratingAvg", "ratingCount", "reviewNote", "reviewedAt", "reviewedById", "slug", "status", "submittedAt", "updatedAt" FROM "shops";
DROP TABLE "shops";
ALTER TABLE "new_shops" RENAME TO "shops";
CREATE UNIQUE INDEX "shops_ownerId_key" ON "shops"("ownerId");
CREATE UNIQUE INDEX "shops_slug_key" ON "shops"("slug");
CREATE INDEX "shops_status_city_idx" ON "shops"("status", "city");
CREATE INDEX "shops_status_submittedAt_idx" ON "shops"("status", "submittedAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "events_slug_key" ON "events"("slug");

-- CreateIndex
CREATE INDEX "events_status_startsAt_idx" ON "events"("status", "startsAt");

-- CreateIndex
CREATE INDEX "events_city_startsAt_idx" ON "events"("city", "startsAt");

-- CreateIndex
CREATE INDEX "event_registrations_eventId_status_idx" ON "event_registrations"("eventId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "event_registrations_eventId_userId_key" ON "event_registrations"("eventId", "userId");

-- CreateIndex
CREATE INDEX "custom_designs_userId_updatedAt_idx" ON "custom_designs"("userId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "custom_order_requests_number_key" ON "custom_order_requests"("number");

-- CreateIndex
CREATE UNIQUE INDEX "custom_order_requests_orderId_key" ON "custom_order_requests"("orderId");

-- CreateIndex
CREATE INDEX "custom_order_requests_userId_createdAt_idx" ON "custom_order_requests"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "custom_order_requests_shopId_status_idx" ON "custom_order_requests"("shopId", "status");

-- CreateIndex
CREATE INDEX "custom_order_messages_requestId_createdAt_idx" ON "custom_order_messages"("requestId", "createdAt");
