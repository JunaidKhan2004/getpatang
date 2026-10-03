-- AlterTable
ALTER TABLE "orders" ADD COLUMN "courierName" TEXT;
ALTER TABLE "orders" ADD COLUMN "trackingNumber" TEXT;

-- AlterTable
ALTER TABLE "shops" ADD COLUMN "cnicNumber" TEXT;
ALTER TABLE "shops" ADD COLUMN "payoutAccountNumber" TEXT;
ALTER TABLE "shops" ADD COLUMN "payoutAccountTitle" TEXT;
ALTER TABLE "shops" ADD COLUMN "payoutMethod" TEXT;
ALTER TABLE "shops" ADD COLUMN "reviewNote" TEXT;
ALTER TABLE "shops" ADD COLUMN "reviewedAt" DATETIME;
ALTER TABLE "shops" ADD COLUMN "reviewedById" TEXT;
ALTER TABLE "shops" ADD COLUMN "submittedAt" DATETIME;

-- CreateTable
CREATE TABLE "shop_documents" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shopId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "uploadId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "shop_documents_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "shops" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "shop_documents_uploadId_fkey" FOREIGN KEY ("uploadId") REFERENCES "uploads" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "uploads" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerId" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "url" TEXT,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "originalName" TEXT NOT NULL,
    "isPrivate" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "uploads_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_products" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shopId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "specifications" JSONB,
    "shippingInfo" TEXT,
    "videoUrl" TEXT,
    "price" INTEGER NOT NULL,
    "compareAtPrice" INTEGER,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "sku" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "ratingAvg" REAL NOT NULL DEFAULT 0,
    "ratingCount" INTEGER NOT NULL DEFAULT 0,
    "salesCount" INTEGER NOT NULL DEFAULT 0,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "lowStockAt" INTEGER NOT NULL DEFAULT 5,
    "reviewNote" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "products_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "shops" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "products_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_products" ("categoryId", "compareAtPrice", "createdAt", "description", "id", "price", "ratingAvg", "ratingCount", "salesCount", "shippingInfo", "shopId", "sku", "slug", "specifications", "status", "stock", "title", "updatedAt", "videoUrl") SELECT "categoryId", "compareAtPrice", "createdAt", "description", "id", "price", "ratingAvg", "ratingCount", "salesCount", "shippingInfo", "shopId", "sku", "slug", "specifications", "status", "stock", "title", "updatedAt", "videoUrl" FROM "products";
DROP TABLE "products";
ALTER TABLE "new_products" RENAME TO "products";
CREATE UNIQUE INDEX "products_slug_key" ON "products"("slug");
CREATE INDEX "products_status_categoryId_idx" ON "products"("status", "categoryId");
CREATE INDEX "products_shopId_status_idx" ON "products"("shopId", "status");
CREATE INDEX "products_status_createdAt_idx" ON "products"("status", "createdAt");
CREATE INDEX "products_status_price_idx" ON "products"("status", "price");
CREATE INDEX "products_status_salesCount_idx" ON "products"("status", "salesCount");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "shop_documents_uploadId_key" ON "shop_documents"("uploadId");

-- CreateIndex
CREATE INDEX "shop_documents_shopId_idx" ON "shop_documents"("shopId");

-- CreateIndex
CREATE UNIQUE INDEX "uploads_storageKey_key" ON "uploads"("storageKey");

-- CreateIndex
CREATE INDEX "uploads_ownerId_purpose_idx" ON "uploads"("ownerId", "purpose");

-- CreateIndex
CREATE INDEX "shops_status_submittedAt_idx" ON "shops"("status", "submittedAt");
