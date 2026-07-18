import express from "express";
import { authenticate } from "../middleware/auth";
import { getOrders, createOrder } from "../controllers/orderController";

const router = express.Router();

router.get("/", authenticate, getOrders);
router.post("/", authenticate, createOrder);

export default router;
