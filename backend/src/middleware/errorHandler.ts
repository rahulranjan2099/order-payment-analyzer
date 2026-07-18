import { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/AppError";

export const errorHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ status: err.status, message: err.message });
    return;
  }

  console.error(err);
  res.status(500).json({ status: "error", message: "Internal server error" });
};
