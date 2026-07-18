import express from "express";
import { prisma } from "../config/db";

const router = express.Router();

router.get("/", async (_req, res) => {
  try {
    const orders = await prisma.order.findMany();
    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch orders" });
  }
});

router.post("/", async (req, res) => {
  try {
    const {
      uploadId,
      orderId,
      orderDate,
      customerEmail,
      currency,
      grossAmount,
      discount,
      netAmount,
      status,
    } = req.body;

    const order = await prisma.order.create({
      data: {
        uploadId,
        orderId,
        orderDate: new Date(orderDate),
        customerEmail,
        currency,
        grossAmount: Number(grossAmount),
        discount: Number(discount),
        netAmount: Number(netAmount),
        status: status || "PENDING",
      },
    });

    res.status(201).json(order);
  } catch (error) {
    res.status(500).json({ error: "Failed to create order" });
  }
});

export default router;
