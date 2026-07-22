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

// Gate on the User.role column set at signup/by an operator. Must run after
// authMiddleware so req.user is populated. Used for the human-oversight
// endpoints (Art. 14(2)) — review queue and kill-switch — so those actions
// are restricted to an authorized reviewer, not any authenticated user.
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ detail: "Admin role required" });
  }
  next();
}