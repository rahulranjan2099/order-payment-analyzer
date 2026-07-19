import { Request, Response } from "express";
import { prisma } from "../config/db";

export const getPayments = async (_req: Request, res: Response): Promise<void> => {
  try {
    const payments = await prisma.payment.findMany();
    res.json(payments);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch payments" });
  }
};

export const createPayment = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      uploadId,
      transactionRef,
      orderReference,
      processedAt,
      currency,
      amount,
      fee,
      netSettled,
      type,
      status,
    } = req.body;

    const payment = await prisma.payment.create({
      // `processedAt` is omitted when absent; the nullable DB column then stores NULL.
      data: {
        uploadId,
        transactionRef,
        orderReference,
        ...(processedAt ? { processedAt: new Date(processedAt) } : {}),
        currency,
        amount: Number(amount),
        fee: Number(fee),
        netSettled: Number(netSettled),
        type,
        status: status || "PENDING",
      } as never,
    });

    res.status(201).json(payment);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to create payment" });
  }
};
