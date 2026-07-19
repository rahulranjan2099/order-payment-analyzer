import { ExplanationSchema } from "./schema";
import { getLlm } from "./llm.service";

type ExplanationInput = {
  discrepancyType?: string;
  order?: {
    orderId?: string | null;
    netAmount?: number | null;
    currency?: string | null;
  } | null;
  payment?: {
    transactionRef?: string | null;
    amount?: number | null;
    currency?: string | null;
  } | null;
  amountDifference?: number | null;
  existingExplanation?: unknown;
  breakdown?: Array<{ type: string; count: number; valueAtRisk: number }>;
  metrics?: {
    totalOrders?: number;
    totalPayments?: number;
    moneyAtRisk?: number;
  };
};

export const explanationTool = async (reconciliation: ExplanationInput) => {
  const llm = getLlm();
  const structuredModel = llm.withStructuredOutput(ExplanationSchema);
  const orderAmount = reconciliation.order?.netAmount ?? 0;
  const paymentAmount = reconciliation.payment?.amount ?? 0;
  const currency = reconciliation.order?.currency ?? reconciliation.payment?.currency ?? "USD";
  const breakdownText = reconciliation.breakdown?.length
    ? reconciliation.breakdown.map((item) => `${item.type}: ${item.count} issues, value at risk ${item.valueAtRisk}`).join("; ")
    : "No breakdown supplied";
  const prompt = `
You are a financial reconciliation assistant.

Explain this reconciliation breakdown in concise business language for a finance operations dashboard.

Discrepancy Type:
${reconciliation.discrepancyType ?? "Summary"}

Order Amount:
${orderAmount}

Payment Amount:
${paymentAmount}

Currency:
${currency}

Breakdown:
${breakdownText}

Metrics:
${JSON.stringify(reconciliation.metrics ?? {})}

Existing context:
${JSON.stringify(reconciliation.existingExplanation ?? {})}

Return a short explanation with the likely causes, the implication for finance operations, and a recommended next step.
`;

  return structuredModel.invoke(prompt);
};

