import { DiscrepancyType, Prisma } from "@prisma/client";
import { Request, Response } from "express";
import { prisma } from "../config/db";

const asNumber = (value: Prisma.Decimal | null): number => value?.toNumber() ?? 0;

const emptyDashboard = () => ({
  upload: null,
  metrics: {
    totalOrders: 0,
    totalPayments: 0,
    totalValueReconciled: 0,
    totalValueInDispute: 0,
    moneyAtRisk: 0,
  },
  breakdown: [],
  reconciliations: [],
  discrepancies: [],
});

export const getDashboard = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = res.locals.userId as string;
    const requestedUploadId = typeof req.query.uploadId === "string" ? req.query.uploadId : undefined;
    const upload = await prisma.upload.findFirst({
      where: {
        userId,
        status: "COMPLETED",
        ...(requestedUploadId ? { id: requestedUploadId } : {}),
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        createdAt: true,
        ordersFileName: true,
        paymentsFileName: true,
        _count: { select: { orders: true, payments: true } },
      },
    });

    if (!upload) {
      if (requestedUploadId) {
        res.status(404).json({ error: "Completed upload not found" });
        return;
      }
      res.json(emptyDashboard());
      return;
    }

    // The dashboard deliberately reads only the persisted output of runReconciliation.
    const insights = await prisma.reconciliation.findMany({
      where: { uploadId: upload.id },
      include: {
        order: { select: { orderId: true, currency: true, netAmount: true } },
        payment: { select: { transactionRef: true, currency: true, amount: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    const matched = insights.filter((insight) => insight.discrepancyType === "MATCHED");
    const discrepancies = insights.filter((insight) => insight.discrepancyType !== "MATCHED");

    const totalValueReconciled = matched.reduce((total, insight) => total + asNumber(insight.order?.netAmount ?? null), 0);
    const totalValueInDispute = discrepancies
      .filter((insight) => insight.discrepancyType === "AMOUNT_MISMATCH" || insight.discrepancyType === "CURRENCY_MISMATCH")
      .reduce((total, insight) => total + asNumber(insight.amountDifference), 0);
    const moneyAtRisk = discrepancies.reduce((total, insight) => total + asNumber(insight.amountDifference), 0);
    const breakdown = Object.values(discrepancies.reduce<Record<string, { type: DiscrepancyType; count: number; valueAtRisk: number }>>((result, insight) => {
      const current = result[insight.discrepancyType] ?? { type: insight.discrepancyType, count: 0, valueAtRisk: 0 };
      current.count += 1;
      current.valueAtRisk += asNumber(insight.amountDifference);
      result[insight.discrepancyType] = current;
      return result;
    }, {})).sort((left, right) => right.valueAtRisk - left.valueAtRisk);
    const resultDashboard = {
      upload: { id: upload.id, createdAt: upload.createdAt, ordersFileName: upload.ordersFileName, paymentsFileName: upload.paymentsFileName },
      metrics: {
        totalOrders: upload._count.orders,
        totalPayments: upload._count.payments,
        totalValueReconciled,
        totalValueInDispute,
        moneyAtRisk,
      },
      breakdown,
      reconciliations: insights.map((insight) => ({
        id: insight.id,
        uploadId: insight.uploadId,
        orderDbId: insight.orderDbId,
        paymentDbId: insight.paymentDbId,
        orderId: insight.order?.orderId ?? null,
        paymentId: insight.payment?.transactionRef ?? null,
        type: insight.discrepancyType,
        severity: insight.severity,
        amountDifference: asNumber(insight.amountDifference),
        explanation: insight.explanation,
        createdAt: insight.createdAt,
      })),
      discrepancies: discrepancies
        .map((insight) => ({
          id: insight.id,
          orderId: insight.order?.orderId ?? null,
          paymentReference: insight.payment?.transactionRef ?? null,
          type: insight.discrepancyType,
          severity: insight.severity,
          amountAtRisk: asNumber(insight.amountDifference),
          currency: insight.order?.currency ?? insight.payment?.currency ?? "USD",
          createdAt: insight.createdAt,
        }))
        .sort((left, right) => right.amountAtRisk - left.amountAtRisk),
    }
    console.log('resultDashboard', resultDashboard)
    res.json(resultDashboard);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to build dashboard" });
  }
};
