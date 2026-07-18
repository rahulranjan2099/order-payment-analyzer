import { NextFunction, Request, Response } from "express";
import csv from "csv-parser";
import { Readable } from "stream";
import { prisma } from "../config/db";
import { AppError } from "../utils/AppError";

type CsvRow = Record<string, string>;
type UploadedCsv = { originalname: string; buffer: Buffer };

const ORDER_COLUMNS = [
  "order_id",
  "order_date",
  "customer_email",
  "currency",
  "gross_amount",
  "discount",
  "net_amount",
  "status",
];

const PAYMENT_COLUMNS = [
  "transaction_ref",
  "processed_at",
  "order_reference",
  "currency",
  "amount",
  "fee",
  "net_settled",
  "type",
  "status",
];

const getFiles = (req: Request): Record<string, UploadedCsv[]> =>
  ((req as Request & { files?: Record<string, UploadedCsv[]> }).files || {});

const assertColumns = (rows: CsvRow[], required: string[], fileLabel: string): void => {
  if (rows.length === 0) {
    throw new AppError(`${fileLabel} CSV has no data rows`, 400);
  }

  const missing = required.filter((column) => !(column in rows[0]));
  if (missing.length > 0) {
    throw new AppError(`${fileLabel} CSV is missing columns: ${missing.join(", ")}`, 400);
  }
};

const readCsv = async (file: UploadedCsv): Promise<CsvRow[]> => {
  const newline = file.buffer.indexOf(10);
  const firstLine = file.buffer
    .subarray(0, newline === -1 ? file.buffer.length : newline)
    .toString("utf8");
  const separator = firstLine.includes("\t") ? "\t" : ",";

  return new Promise((resolve, reject) => {
    const rows: CsvRow[] = [];
    Readable.from(file.buffer)
      .pipe(csv({ separator }))
      .on("data", (row: CsvRow) => rows.push(row))
      .on("error", reject)
      .on("end", () => resolve(rows));
  });
};

const requiredText = (value: string | undefined, field: string, row: number): string => {
  const text = value?.trim();
  if (!text) throw new AppError(`Row ${row}: ${field} is required`, 400);
  return text;
};

const decimal = (value: string | undefined, field: string, row: number): number => {
  const text = requiredText(value, field, row);
  const amount = Number(text);
  if (!Number.isFinite(amount)) throw new AppError(`Row ${row}: ${field} must be a number`, 400);
  return amount;
};

const date = (value: string | undefined, field: string, row: number): Date => {
  const parsed = new Date(requiredText(value, field, row));
  if (Number.isNaN(parsed.getTime())) throw new AppError(`Row ${row}: ${field} is not a valid date`, 400);
  return parsed;
};

export const importCsvFiles = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const files = getFiles(req);
  const ordersFile = files.ordersFile?.[0];
  const paymentsFile = files.paymentsFile?.[0];

  if (!ordersFile && !paymentsFile) {
    next(new AppError("Attach an ordersFile, paymentsFile, or both", 400));
    return;
  }

  let uploadId: string | undefined;

  try {
    // This happens before CSV parsing/import so every attempt has a durable upload record.
    const upload = await prisma.upload.create({
      data: {
        userId: res.locals.userId,
        ordersFileName: ordersFile?.originalname,
        paymentsFileName: paymentsFile?.originalname,
      },
    });
    uploadId = upload.id;
    const currentUploadId = upload.id;

    const [orderRows, paymentRows] = await Promise.all([
      ordersFile ? readCsv(ordersFile) : Promise.resolve([]),
      paymentsFile ? readCsv(paymentsFile) : Promise.resolve([]),
    ]);

    if (ordersFile) assertColumns(orderRows, ORDER_COLUMNS, "Orders");
    if (paymentsFile) assertColumns(paymentRows, PAYMENT_COLUMNS, "Payments");

    const orders = orderRows.map((row, index) => {
      const rowNumber = index + 2;
      return {
        uploadId: currentUploadId,
        orderId: requiredText(row.order_id, "order_id", rowNumber),
        orderDate: date(row.order_date, "order_date", rowNumber),
        customerEmail: requiredText(row.customer_email, "customer_email", rowNumber),
        currency: requiredText(row.currency, "currency", rowNumber),
        grossAmount: decimal(row.gross_amount, "gross_amount", rowNumber),
        discount: decimal(row.discount, "discount", rowNumber),
        netAmount: decimal(row.net_amount, "net_amount", rowNumber),
        status: requiredText(row.status, "status", rowNumber),
      };
    });
    const payments = paymentRows.map((row, index) => {
      const rowNumber = index + 2;
      return {
        uploadId: currentUploadId,
        transactionRef: requiredText(row.transaction_ref, "transaction_ref", rowNumber),
        orderReference: row.order_reference?.trim() || null,
        processedAt: date(row.processed_at, "processed_at", rowNumber),
        currency: requiredText(row.currency, "currency", rowNumber),
        amount: decimal(row.amount, "amount", rowNumber),
        fee: decimal(row.fee, "fee", rowNumber),
        netSettled: decimal(row.net_settled, "net_settled", rowNumber),
        type: requiredText(row.type, "type", rowNumber),
        status: requiredText(row.status, "status", rowNumber),
      };
    });

    await prisma.$transaction(async (tx) => {
      if (orders.length) await tx.order.createMany({ data: orders });
      if (payments.length) await tx.payment.createMany({ data: payments });
      await tx.upload.update({ where: { id: currentUploadId }, data: { status: "COMPLETED" } });
    });

    res.status(201).json({
      uploadId: currentUploadId,
      status: "COMPLETED",
      ordersImported: orders.length,
      paymentsImported: payments.length,
    });
  } catch (error) {
    if (uploadId) {
      await prisma.upload.update({ where: { id: uploadId }, data: { status: "FAILED" } });
    }
    next(error);
  }
};
