import { z } from "zod";

export const ExplanationSchema = z.object({
  summary: z.string(),
  possibleCause: z.string(),
  recommendedAction: z.string(),
  severity: z.enum(["LOW", "MEDIUM", "HIGH"]),
});