import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { AppError } from "../utils/AppError";

const JWT_SECRET = process.env.JWT_SECRET || "change-me";

interface JwtPayload {
  userId: string;
  iat?: number;
  exp?: number;
}

export const authenticate = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    next(new AppError("Authorization token missing", 401));
    return;
  }

  const token = authHeader.split(" ")[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET) as JwtPayload;
    res.locals.userId = payload.userId;
    next();
  } catch (error) {
    next(new AppError("Invalid or expired token", 401));
  }
};
