import express from "express";
import { explainReconciliation, getReconciliations, runReconciliation } from "../controllers/reconciliationController";
import { authenticate } from "../middleware/auth";

const router = express.Router();

router.get("/:uploadId", authenticate, getReconciliations);
router.post("/:uploadId", authenticate, runReconciliation);
router.post("/:uploadId/explain", authenticate, explainReconciliation);

export default router;
