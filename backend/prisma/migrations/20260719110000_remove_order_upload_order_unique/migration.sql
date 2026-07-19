-- Permit multiple order records with the same order ID within one upload.
DROP INDEX "Order_uploadId_orderId_key";
