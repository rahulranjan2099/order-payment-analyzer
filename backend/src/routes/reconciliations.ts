import express from "express";
import { getReconciliations, runReconciliation } from "../controllers/reconciliationController";
import { authenticate } from "../middleware/auth";

const router = express.Router();

router.get("/:uploadId", authenticate, getReconciliations);
router.post("/:uploadId", authenticate, runReconciliation);

export default router;
