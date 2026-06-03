import { Request, Response, NextFunction } from "express";
import { getCurrentUser, AuthUser } from "../utils/auth";

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const authHeader = req.headers.authorization;
  let token = req.cookies?.access_token;

  if (!token && authHeader?.startsWith("Bearer ")) {
    token = authHeader.slice(7);
  }

  if (!token) {
    return res.status(401).json({ detail: "Not authenticated" });
  }

  const user = await getCurrentUser(token);

  if (!user) {
    return res.status(401).json({ detail: "Invalid token or user not found" });
  }

  req.user = user;
  next();
}