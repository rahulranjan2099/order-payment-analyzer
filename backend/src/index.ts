import express from "express";
import dotenv from "dotenv";
import connectDB, { prisma } from "./config/db";
import ordersRouter from "./routes/orders";
import paymentsRouter from "./routes/payments";

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/orders", ordersRouter);
app.use("/api/payments", paymentsRouter);

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
