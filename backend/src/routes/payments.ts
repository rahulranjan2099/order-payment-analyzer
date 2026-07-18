import express from "express";
import { authenticate } from "../middleware/auth";
import { getPayments, createPayment } from "../controllers/paymentController";

const router = express.Router();

router.get("/", authenticate, getPayments);
router.post("/", authenticate, createPayment);

export default router;
