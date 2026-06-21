-- CreateEnum
CREATE TYPE "BulkOperationType" AS ENUM ('BATCH_ENROLL');

-- CreateTable
CREATE TABLE "BatchStatusType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isCompletionTarget" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BatchStatusType_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BatchStatusType_name_key" ON "BatchStatusType"("name");

-- Seed default statuses (fixed UUIDs so we can backfill Batch rows below)
INSERT INTO "BatchStatusType" ("id", "name", "order", "isDefault", "isCompletionTarget", "updatedAt") VALUES
  ('28491274-68d6-4dd4-9b49-dfe6ab71cb9f', 'Active', 0, true, false, CURRENT_TIMESTAMP),
  ('05a74033-23fc-41f6-8d65-dcd7ad1780b0', 'Inactive', 1, false, false, CURRENT_TIMESTAMP),
  ('273c7952-0846-421c-bb0e-d2ab54226211', 'Completed', 2, false, true, CURRENT_TIMESTAMP),
  ('4a4083cd-a9c0-4693-9356-e90c77e960b3', 'On Hold', 3, false, false, CURRENT_TIMESTAMP),
  ('ca017dee-a825-4281-9353-a09c597af35d', 'Cancelled', 4, false, false, CURRENT_TIMESTAMP);

-- AlterTable: add nullable statusId, backfill from old enum column, then enforce NOT NULL
ALTER TABLE "Batch" ADD COLUMN "statusId" TEXT;

UPDATE "Batch" SET "statusId" = CASE "status"
  WHEN 'ACTIVE' THEN '28491274-68d6-4dd4-9b49-dfe6ab71cb9f'
  WHEN 'INACTIVE' THEN '05a74033-23fc-41f6-8d65-dcd7ad1780b0'
  WHEN 'COMPLETED' THEN '273c7952-0846-421c-bb0e-d2ab54226211'
  WHEN 'ON_HOLD' THEN '4a4083cd-a9c0-4693-9356-e90c77e960b3'
  WHEN 'CANCELLED' THEN 'ca017dee-a825-4281-9353-a09c597af35d'
END;

ALTER TABLE "Batch" ALTER COLUMN "statusId" SET NOT NULL;
ALTER TABLE "Batch" DROP COLUMN "status";
DROP TYPE "BatchStatus";

-- AddForeignKey
ALTER TABLE "Batch" ADD CONSTRAINT "Batch_statusId_fkey" FOREIGN KEY ("statusId") REFERENCES "BatchStatusType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "BulkOperation" (
    "id" TEXT NOT NULL,
    "type" "BulkOperationType" NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "undoneAt" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL,

    CONSTRAINT "BulkOperation_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "BulkOperation" ADD CONSTRAINT "BulkOperation_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
