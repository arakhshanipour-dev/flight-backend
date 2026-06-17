/*
  Warnings:

  - You are about to drop the column `destination` on the `Ticket` table. All the data in the column will be lost.
  - You are about to drop the column `origin` on the `Ticket` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[iataCode]` on the table `Agency` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "Invoice" DROP CONSTRAINT "Invoice_bankCardId_fkey";

-- AlterTable
ALTER TABLE "Agency" ADD COLUMN     "iataCode" TEXT;

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "credit" DOUBLE PRECISION,
ADD COLUMN     "currencyCode" TEXT NOT NULL DEFAULT 'IRR',
ADD COLUMN     "debit" DOUBLE PRECISION,
ADD COLUMN     "markup" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "referenceNo" TEXT,
ADD COLUMN     "runningBalance" DOUBLE PRECISION,
ADD COLUMN     "salesType" TEXT NOT NULL DEFAULT 'STANDARD',
ADD COLUMN     "transactionType" TEXT,
ALTER COLUMN "bankCardId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "currencyCode" TEXT NOT NULL DEFAULT 'IRR';

-- AlterTable
ALTER TABLE "Ticket" DROP COLUMN "destination",
DROP COLUMN "origin",
ADD COLUMN     "ageType" TEXT,
ADD COLUMN     "agentCode" TEXT,
ADD COLUMN     "agentIATACode" TEXT,
ADD COLUMN     "agentName" TEXT,
ADD COLUMN     "ancillary" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "commission" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "commissionAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "credit" DOUBLE PRECISION,
ADD COLUMN     "currencyCode" TEXT NOT NULL DEFAULT 'IRR',
ADD COLUMN     "customerAirline" TEXT,
ADD COLUMN     "debit" DOUBLE PRECISION,
ADD COLUMN     "departureDate" TIMESTAMP(3),
ADD COLUMN     "destinationAirportId" TEXT,
ADD COLUMN     "discount" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "fare" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "fee" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "gender" TEXT,
ADD COLUMN     "markup" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "nationalCode" TEXT,
ADD COLUMN     "nationality" TEXT,
ADD COLUMN     "originAirportId" TEXT,
ADD COLUMN     "passengerTitle" TEXT,
ADD COLUMN     "passportNumber" TEXT,
ADD COLUMN     "pnr" TEXT,
ADD COLUMN     "referenceNo" TEXT,
ADD COLUMN     "reservationPhone" TEXT,
ADD COLUMN     "route" TEXT,
ADD COLUMN     "runningBalance" DOUBLE PRECISION,
ADD COLUMN     "salesType" TEXT NOT NULL DEFAULT 'STANDARD',
ADD COLUMN     "segment" TEXT,
ADD COLUMN     "sign" TEXT,
ADD COLUMN     "source" TEXT,
ADD COLUMN     "tax" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "totalRefund" DOUBLE PRECISION,
ADD COLUMN     "tourCode" TEXT,
ADD COLUMN     "transactionDate" TIMESTAMP(3),
ADD COLUMN     "transactionType" TEXT,
ADD COLUMN     "vat" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "agentIATACode" TEXT;

-- CreateTable
CREATE TABLE "Airport" (
    "id" TEXT NOT NULL,
    "iataCode" TEXT NOT NULL,
    "icaoCode" TEXT,
    "name" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "province" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Airport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Airport_iataCode_key" ON "Airport"("iataCode");

-- CreateIndex
CREATE UNIQUE INDEX "Airport_icaoCode_key" ON "Airport"("icaoCode");

-- CreateIndex
CREATE INDEX "Airport_iataCode_idx" ON "Airport"("iataCode");

-- CreateIndex
CREATE INDEX "Airport_city_idx" ON "Airport"("city");

-- CreateIndex
CREATE INDEX "Airport_province_idx" ON "Airport"("province");

-- CreateIndex
CREATE INDEX "Airport_type_idx" ON "Airport"("type");

-- CreateIndex
CREATE UNIQUE INDEX "Agency_iataCode_key" ON "Agency"("iataCode");

-- CreateIndex
CREATE INDEX "Invoice_referenceNo_idx" ON "Invoice"("referenceNo");

-- CreateIndex
CREATE INDEX "Ticket_pnr_idx" ON "Ticket"("pnr");

-- CreateIndex
CREATE INDEX "Ticket_ticketNumber_idx" ON "Ticket"("ticketNumber");

-- CreateIndex
CREATE INDEX "Ticket_referenceNo_idx" ON "Ticket"("referenceNo");

-- CreateIndex
CREATE INDEX "Ticket_nationalCode_idx" ON "Ticket"("nationalCode");

-- CreateIndex
CREATE INDEX "Ticket_flightDate_idx" ON "Ticket"("flightDate");

-- CreateIndex
CREATE INDEX "Ticket_transactionDate_idx" ON "Ticket"("transactionDate");

-- CreateIndex
CREATE INDEX "Ticket_agentCode_idx" ON "Ticket"("agentCode");

-- CreateIndex
CREATE INDEX "Ticket_originAirportId_idx" ON "Ticket"("originAirportId");

-- CreateIndex
CREATE INDEX "Ticket_destinationAirportId_idx" ON "Ticket"("destinationAirportId");

-- CreateIndex
CREATE INDEX "Ticket_status_idx" ON "Ticket"("status");

-- CreateIndex
CREATE INDEX "Ticket_salesType_idx" ON "Ticket"("salesType");

-- CreateIndex
CREATE INDEX "Ticket_agencyId_idx" ON "Ticket"("agencyId");

-- CreateIndex
CREATE INDEX "Ticket_userId_idx" ON "Ticket"("userId");

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_originAirportId_fkey" FOREIGN KEY ("originAirportId") REFERENCES "Airport"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_destinationAirportId_fkey" FOREIGN KEY ("destinationAirportId") REFERENCES "Airport"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_bankCardId_fkey" FOREIGN KEY ("bankCardId") REFERENCES "BankCard"("id") ON DELETE SET NULL ON UPDATE CASCADE;
