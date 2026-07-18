import express from "express";
import { prisma } from "../config/db";

const router = express.Router();

router.get("/", async (_req, res) => {
  try {
    const payments = await prisma.payment.findMany();
    res.json(payments);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch payments" });
  }
});

router.post("/", async (req, res) => {
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
      data: {
        uploadId,
        transactionRef,
        orderReference,
        processedAt: new Date(processedAt),
        currency,
        amount: Number(amount),
        fee: Number(fee),
        netSettled: Number(netSettled),
        type,
        status: status || "PENDING",
      },
    });

    res.status(201).json(payment);
  } catch (error) {
    res.status(500).json({ error: "Failed to create payment" });
  }
});

export default router;
