-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'CARD_READER', 'CREDIT');

-- AlterEnum
ALTER TYPE "PaymentStatus" ADD VALUE 'PARTIAL';

-- DropForeignKey
ALTER TABLE "Payment" DROP CONSTRAINT "Payment_bankCardId_fkey";

-- DropIndex
DROP INDEX "Payment_invoiceId_key";

-- DropIndex
DROP INDEX "Payment_trackingCode_key";

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "notes" TEXT,
ADD COLUMN     "paymentMethod" "PaymentMethod" NOT NULL DEFAULT 'CREDIT',
ADD COLUMN     "receiptNumber" TEXT,
ALTER COLUMN "bankCardId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "CashReceipt" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "receiptNumber" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "customerPhone" TEXT,
    "ticketNumbers" TEXT[],
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "paidAmount" DOUBLE PRECISION NOT NULL,
    "remainingAmount" DOUBLE PRECISION NOT NULL,
    "paymentDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "printedAt" TIMESTAMP(3),
    "printedBy" TEXT,
    "notes" TEXT,

    CONSTRAINT "CashReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CashReceipt_paymentId_key" ON "CashReceipt"("paymentId");

-- CreateIndex
CREATE UNIQUE INDEX "CashReceipt_receiptNumber_key" ON "CashReceipt"("receiptNumber");

-- CreateIndex
CREATE INDEX "CashReceipt_receiptNumber_idx" ON "CashReceipt"("receiptNumber");

-- CreateIndex
CREATE INDEX "CashReceipt_paymentDate_idx" ON "CashReceipt"("paymentDate");

-- CreateIndex
CREATE INDEX "Invoice_status_idx" ON "Invoice"("status");

-- CreateIndex
CREATE INDEX "Invoice_issuedAt_idx" ON "Invoice"("issuedAt");

-- CreateIndex
CREATE INDEX "Payment_invoiceId_idx" ON "Payment"("invoiceId");

-- CreateIndex
CREATE INDEX "Payment_trackingCode_idx" ON "Payment"("trackingCode");

-- CreateIndex
CREATE INDEX "Payment_receiptNumber_idx" ON "Payment"("receiptNumber");

-- CreateIndex
CREATE INDEX "Payment_paidAt_idx" ON "Payment"("paidAt");

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_bankCardId_fkey" FOREIGN KEY ("bankCardId") REFERENCES "BankCard"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashReceipt" ADD CONSTRAINT "CashReceipt_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
