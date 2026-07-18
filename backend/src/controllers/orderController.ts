import { Request, Response } from "express";
import { prisma } from "../config/db";

export const getOrders = async (_req: Request, res: Response): Promise<void> => {
  try {
    const orders = await prisma.order.findMany();
    res.json(orders);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch orders" });
  }
};

export const createOrder = async (req: Request, res: Response): Promise<void> => {
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
    console.error(error);
    res.status(500).json({ error: "Failed to create order" });
  }
};
