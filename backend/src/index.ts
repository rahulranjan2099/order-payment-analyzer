import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import connectDB, { prisma } from "./config/db";
import ordersRouter from "./routes/orders";
import paymentsRouter from "./routes/payments";
import authRouter from "./routes/auth";
import uploadsRouter from "./routes/uploads";
import dashboardRouter from "./routes/dashboard";
import reconciliationsRouter from "./routes/reconciliations";
import { errorHandler } from "./middleware/errorHandler";

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/auth", authRouter);
app.use("/api/orders", ordersRouter);
app.use("/api/payments", paymentsRouter);
app.use("/api/uploads", uploadsRouter);
app.use("/api/dashboard", dashboardRouter);
app.use("/api/reconciliations", reconciliationsRouter);
app.use(errorHandler);

const startServer = async () => {
  await connectDB();

  app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
  });
};

startServer().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});

process.on("SIGINT", async () => {
  await prisma.$disconnect();
  process.exit(0);
});
