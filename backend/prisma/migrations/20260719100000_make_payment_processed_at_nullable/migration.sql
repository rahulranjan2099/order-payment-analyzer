-- Allow payment records that do not yet have a processor timestamp.
ALTER TABLE "Payment" ALTER COLUMN "processedAt" DROP NOT NULL;
