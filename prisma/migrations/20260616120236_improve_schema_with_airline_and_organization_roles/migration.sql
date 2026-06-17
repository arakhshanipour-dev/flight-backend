/*
  Warnings:

  - The `type` column on the `Airport` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `senderType` column on the `SupportTicket` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the column `flightDate` on the `Ticket` table. All the data in the column will be lost.
  - The `ageType` column on the `Ticket` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `gender` column on the `Ticket` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `salesType` column on the `Ticket` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `transactionType` column on the `Ticket` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Made the column `departureDate` on table `Ticket` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "AirportType" AS ENUM ('INTERNATIONAL', 'DOMESTIC', 'BORDER', 'PRIVATE', 'UNDER_CONSTRUCTION');

-- CreateEnum
CREATE TYPE "AgeType" AS ENUM ('ADT', 'CHD', 'INF');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE');

-- CreateEnum
CREATE TYPE "SalesType" AS ENUM ('STANDARD', 'REFUND', 'EXCHANGE');

-- CreateEnum
CREATE TYPE "TicketTransactionType" AS ENUM ('TICKET', 'CREDIT', 'REFUND');

-- CreateEnum
CREATE TYPE "SupportSenderType" AS ENUM ('AGENCY', 'ORGANIZATION', 'USER', 'SYSTEM');

-- CreateEnum
CREATE TYPE "OrganizationRole" AS ENUM ('ADMIN', 'MANAGER', 'MEMBER', 'VIEWER');

-- DropIndex
DROP INDEX "Ticket_flightDate_idx";

-- AlterTable
ALTER TABLE "Airport" ADD COLUMN     "country" TEXT NOT NULL DEFAULT 'IRAN',
ADD COLUMN     "timezone" TEXT DEFAULT 'Asia/Tehran',
DROP COLUMN "type",
ADD COLUMN     "type" "AirportType" NOT NULL DEFAULT 'DOMESTIC';

-- AlterTable
ALTER TABLE "SupportTicket" DROP COLUMN "senderType",
ADD COLUMN     "senderType" "SupportSenderType" NOT NULL DEFAULT 'USER';

-- AlterTable
ALTER TABLE "Ticket" DROP COLUMN "flightDate",
ADD COLUMN     "airlineId" TEXT,
ALTER COLUMN "price" SET DEFAULT 0,
DROP COLUMN "ageType",
ADD COLUMN     "ageType" "AgeType",
ALTER COLUMN "departureDate" SET NOT NULL,
DROP COLUMN "gender",
ADD COLUMN     "gender" "Gender",
DROP COLUMN "salesType",
ADD COLUMN     "salesType" "SalesType" NOT NULL DEFAULT 'STANDARD',
DROP COLUMN "transactionType",
ADD COLUMN     "transactionType" "TicketTransactionType";

-- CreateTable
CREATE TABLE "Airline" (
    "id" TEXT NOT NULL,
    "iataCode" TEXT NOT NULL,
    "icaoCode" TEXT,
    "name" TEXT NOT NULL,
    "country" TEXT DEFAULT 'IRAN',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Airline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationMember" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "OrganizationRole" NOT NULL DEFAULT 'MEMBER',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationMember_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Airline_iataCode_key" ON "Airline"("iataCode");

-- CreateIndex
CREATE UNIQUE INDEX "Airline_icaoCode_key" ON "Airline"("icaoCode");

-- CreateIndex
CREATE INDEX "Airline_iataCode_idx" ON "Airline"("iataCode");

-- CreateIndex
CREATE INDEX "Airline_name_idx" ON "Airline"("name");

-- CreateIndex
CREATE INDEX "OrganizationMember_role_idx" ON "OrganizationMember"("role");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationMember_organizationId_userId_key" ON "OrganizationMember"("organizationId", "userId");

-- CreateIndex
CREATE INDEX "ActivityLog_entityType_entityId_idx" ON "ActivityLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "Agency_status_idx" ON "Agency"("status");

-- CreateIndex
CREATE INDEX "Agency_iataCode_idx" ON "Agency"("iataCode");

-- CreateIndex
CREATE INDEX "AgencyPlan_agencyId_isActive_idx" ON "AgencyPlan"("agencyId", "isActive");

-- CreateIndex
CREATE INDEX "Airport_type_idx" ON "Airport"("type");

-- CreateIndex
CREATE INDEX "BankCard_status_idx" ON "BankCard"("status");

-- CreateIndex
CREATE INDEX "Invoice_agencyId_status_idx" ON "Invoice"("agencyId", "status");

-- CreateIndex
CREATE INDEX "Organization_name_idx" ON "Organization"("name");

-- CreateIndex
CREATE INDEX "Payment_status_idx" ON "Payment"("status");

-- CreateIndex
CREATE INDEX "Penalty_userId_agencyId_idx" ON "Penalty"("userId", "agencyId");

-- CreateIndex
CREATE INDEX "RegistrationRequest_status_idx" ON "RegistrationRequest"("status");

-- CreateIndex
CREATE INDEX "RegistrationRequest_contactEmail_idx" ON "RegistrationRequest"("contactEmail");

-- CreateIndex
CREATE INDEX "SupportTicket_status_priority_idx" ON "SupportTicket"("status", "priority");

-- CreateIndex
CREATE INDEX "Ticket_departureDate_idx" ON "Ticket"("departureDate");

-- CreateIndex
CREATE INDEX "Ticket_salesType_idx" ON "Ticket"("salesType");

-- CreateIndex
CREATE INDEX "Ticket_airlineId_idx" ON "Ticket"("airlineId");

-- CreateIndex
CREATE INDEX "Ticket_agencyId_status_departureDate_idx" ON "Ticket"("agencyId", "status", "departureDate");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "User_status_idx" ON "User"("status");

-- AddForeignKey
ALTER TABLE "OrganizationMember" ADD CONSTRAINT "OrganizationMember_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationMember" ADD CONSTRAINT "OrganizationMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_airlineId_fkey" FOREIGN KEY ("airlineId") REFERENCES "Airline"("id") ON DELETE SET NULL ON UPDATE CASCADE;
