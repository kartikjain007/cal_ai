import { Request, Response } from "express";
import { prisma } from "../utils/prisma";
import {
  hashPassword,
  verifyPassword,
  createAccessToken,
  createRefreshToken,
  buildUserPayload,
} from "../utils/auth";
import { registerSchema, loginSchema } from "../utils/validation";
import { authMiddleware } from "../middleware/auth";

export async function register(req: Request, res: Response) {
  const parseResult = registerSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ detail: parseResult.error.errors });
  }

  const { email, password, name } = parseResult.data;
  const normalizedEmail = email.toLowerCase().trim();

  const existing = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (existing) {
    return res.status(400).json({ detail: "Email already registered" });
  }

  const user = await prisma.user.create({
    data: {
      email: normalizedEmail,
      passwordHash: hashPassword(password),
      name,
      role: "user",
      dailyCalories: 2000,
      dailyProtein: 150,
      dailyCarbs: 250,
      dailyFats: 65,
      onboardingCompleted: false,
    },
  });

  const accessToken = createAccessToken(user.id, user.email);
  const refreshToken = createRefreshToken(user.id);

  res.cookie("access_token", accessToken, {
    httpOnly: true,
    secure: false,
    sameSite: "lax",
    maxAge: 86400,
    path: "/",
  });

  res.cookie("refresh_token", refreshToken, {
    httpOnly: true,
    secure: false,
    sameSite: "lax",
    maxAge: 604800,
    path: "/",
  });

  return res.json(buildUserPayload(user, accessToken));
}

export async function login(req: Request, res: Response) {
  const parseResult = loginSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ detail: parseResult.error.errors });
  }

  const { email, password } = parseResult.data;
  const normalizedEmail = email.toLowerCase().trim();

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (!user) {
    return res.status(401).json({ detail: "Invalid email or password" });
  }

  if (!verifyPassword(password, user.passwordHash)) {
    return res.status(401).json({ detail: "Invalid email or password" });
  }

  const accessToken = createAccessToken(user.id, user.email);
  const refreshToken = createRefreshToken(user.id);

  res.cookie("access_token", accessToken, {
    httpOnly: true,
    secure: false,
    sameSite: "lax",
    maxAge: 86400,
    path: "/",
  });

  res.cookie("refresh_token", refreshToken, {
    httpOnly: true,
    secure: false,
    sameSite: "lax",
    maxAge: 604800,
    path: "/",
  });

  return res.json(buildUserPayload(user, accessToken));
}

export function getMe(req: Request, res: Response) {
  return res.json(buildUserPayload(req.user!));
}

export function logout(_req: Request, res: Response) {
  res.clearCookie("access_token", { path: "/" });
  res.clearCookie("refresh_token", { path: "/" });
  return res.json({ message: "Logged out" });
}

export function registerAuthRoutes(app: import("express").Express) {
  app.post("/api/auth/register", register);
  app.post("/api/auth/login", login);
  app.get("/api/auth/me", authMiddleware, getMe);
  app.post("/api/auth/logout", authMiddleware, logout);
}