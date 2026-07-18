import express, { Request } from "express";
import multer from "multer";
import { importCsvFiles } from "../controllers/uploadController";
import { authenticate } from "../middleware/auth";
import { AppError } from "../utils/AppError";

const router = express.Router();

const csvUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 2 },
  fileFilter: (
    _req: Request,
    file: { mimetype: string; originalname: string },
    callback: (error: Error | null, acceptFile: boolean) => void
  ) => {
    const isCsv = file.mimetype === "text/csv" || file.originalname.toLowerCase().endsWith(".csv");
    callback(isCsv ? null : new AppError("Only CSV files are accepted", 400), isCsv);
  },
});

router.post(
  "/import",
  authenticate,
  csvUpload.fields([
    { name: "ordersFile", maxCount: 1 },
    { name: "paymentsFile", maxCount: 1 },
  ]),
  importCsvFiles
);

export default router;
