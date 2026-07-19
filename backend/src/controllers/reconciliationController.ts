import { Request, Response } from "express";
import { DiscrepancyType, Prisma, Severity } from "@prisma/client";
import { prisma } from "../config/db";

type Insight = {
  orderDbId?: string;
  paymentDbId?: string;
  discrepancyType: DiscrepancyType;
  severity: Severity;
  amountDifference?: number;
  explanation: Prisma.InputJsonValue;
};

const asNumber = (value: Prisma.Decimal): number => value.toNumber();
const difference = (left: number, right: number): number => Math.abs(left - right);
const moneyMatches = (left: number, right: number): boolean => difference(left, right) < 0.005;

const mismatchSeverity = (orderAmount: number, paymentAmount: number): Severity => {
  const ratio = orderAmount === 0 ? 1 : difference(orderAmount, paymentAmount) / Math.abs(orderAmount);
  if (ratio >= 0.1) return "HIGH";
  if (ratio >= 0.01) return "MEDIUM";
  return "LOW";
};

export const runReconciliation = async (req: Request, res: Response): Promise<void> => {
  try {
    // Fetch only an upload owned by the authenticated user, along with the records to compare.
    const upload = await prisma.upload.findFirst({
      where: { id: req.params.uploadId, userId: res.locals.userId as string },
      include: {
        orders: { orderBy: { createdAt: "asc" } },
        payments: { orderBy: { createdAt: "asc" } },
      },
    });
    if (!upload) {
      res.status(404).json({ error: "Upload not found" });
      return;
    }

    // Insights are collected first, then atomically replace this upload's prior reconciliation run.
    const insights: Insight[] = [];
    const ordersByReference = new Map<string, typeof upload.orders>();
    const paymentsByReference = new Map<string, typeof upload.payments>();

    // Group records by the business reference used to associate an order with its payment.
    for (const order of upload.orders) {
      const orders = ordersByReference.get(order.orderId) ?? [];
      orders.push(order);
      ordersByReference.set(order.orderId, orders);
    }
    for (const payment of upload.payments) {
      if (!payment.orderReference) continue;
      const payments = paymentsByReference.get(payment.orderReference) ?? [];
      payments.push(payment);
      paymentsByReference.set(payment.orderReference, payments);
    }

    for (const [orderId, matchingOrders] of ordersByReference) {
      const [primaryOrder, ...duplicateOrders] = matchingOrders;

      // Keep the first occurrence as the primary order and flag any additional records.
      for (const duplicateOrder of duplicateOrders) {
        insights.push({
          orderDbId: duplicateOrder.id,
          discrepancyType: "DUPLICATE_ORDER",
          severity: "MEDIUM",
          amountDifference: asNumber(duplicateOrder.netAmount),
          explanation: { orderId, reason: "More than one order record has this order ID" },
        });
      }

      const matchingPayments = paymentsByReference.get(orderId) ?? [];
      if (matchingPayments.length === 0) {
        // An order with no payment reference is a high-risk missing-payment insight.
        insights.push({
          orderDbId: primaryOrder.id,
          discrepancyType: "MISSING_PAYMENT",
          severity: "HIGH",
          amountDifference: asNumber(primaryOrder.netAmount),
          explanation: { orderId, expectedAmount: asNumber(primaryOrder.netAmount), currency: primaryOrder.currency },
        });
        continue;
      }

      const [primaryPayment, ...duplicatePayments] = matchingPayments;

      // The first payment is compared with the order; additional payments are duplicates.
      for (const duplicatePayment of duplicatePayments) {
        insights.push({
          orderDbId: primaryOrder.id,
          paymentDbId: duplicatePayment.id,
          discrepancyType: "DUPLICATE_PAYMENT",
          severity: "HIGH",
          amountDifference: asNumber(duplicatePayment.amount),
          explanation: { orderId, transactionRef: duplicatePayment.transactionRef, reason: "More than one payment references this order" },
        });
      }

      const orderAmount = asNumber(primaryOrder.netAmount);
      const paymentAmount = asNumber(primaryPayment.amount);
      if (primaryOrder.currency !== primaryPayment.currency) {
        // Currency differences make numerical amount comparisons unreliable.
        insights.push({
          orderDbId: primaryOrder.id,
          paymentDbId: primaryPayment.id,
          discrepancyType: "CURRENCY_MISMATCH",
          severity: "HIGH",
          amountDifference: orderAmount,
          explanation: { orderId, orderCurrency: primaryOrder.currency, paymentCurrency: primaryPayment.currency, orderAmount, paymentAmount },
        });
      } else if (!moneyMatches(orderAmount, paymentAmount)) {
        // Persist the absolute variance and determine severity from its relative size.
        insights.push({
          orderDbId: primaryOrder.id,
          paymentDbId: primaryPayment.id,
          discrepancyType: "AMOUNT_MISMATCH",
          severity: mismatchSeverity(orderAmount, paymentAmount),
          amountDifference: difference(orderAmount, paymentAmount),
          explanation: { orderId, orderAmount, paymentAmount, currency: primaryOrder.currency },
        });
      } else {
        // Exact amount and currency matches are stored too, giving every linked pair an audit record.
        insights.push({
          orderDbId: primaryOrder.id,
          paymentDbId: primaryPayment.id,
          discrepancyType: "MATCHED",
          severity: "LOW",
          amountDifference: 0,
          explanation: { orderId, orderAmount, paymentAmount, currency: primaryOrder.currency },
        });
      }
    }

    for (const payment of upload.payments) {
      if (payment.orderReference && ordersByReference.has(payment.orderReference)) continue;
      // Payments without a corresponding order are recorded independently as orphan payments.
      insights.push({
        paymentDbId: payment.id,
        discrepancyType: "ORPHAN_PAYMENT",
        severity: "HIGH",
        amountDifference: asNumber(payment.amount),
        explanation: { transactionRef: payment.transactionRef, orderReference: payment.orderReference, reason: "No order matches this payment reference" },
      });
    }

    await prisma.$transaction(async (tx) => {
      // Re-running reconciliation is idempotent: replace only this upload's previous insights.
      await tx.reconciliation.deleteMany({ where: { uploadId: upload.id } });
      if (insights.length) {
        // Each saved row carries the upload plus the optional linked order/payment database IDs.
        await tx.reconciliation.createMany({ data: insights.map((insight) => ({ uploadId: upload.id, ...insight })) });
      }
    });

    const summary = insights.reduce<Record<string, number>>((counts, insight) => {
      counts[insight.discrepancyType] = (counts[insight.discrepancyType] ?? 0) + 1;
      return counts;
    }, {});
    res.status(201).json({ uploadId: upload.id, reconciliationsCreated: insights.length, summary });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to reconcile upload" });
  }
};

export const getReconciliations = async (req: Request, res: Response): Promise<void> => {
  try {
    const upload = await prisma.upload.findFirst({ where: { id: req.params.uploadId, userId: res.locals.userId as string }, select: { id: true } });
    if (!upload) {
      res.status(404).json({ error: "Upload not found" });
      return;
    }
    const reconciliations = await prisma.reconciliation.findMany({
      where: { uploadId: upload.id },
      include: { order: true, payment: true },
      orderBy: { createdAt: "desc" },
    });
    res.json(reconciliations);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch reconciliations" });
  }
};
