import bcrypt from "bcrypt";
import jwt, { JwtPayload } from "jsonwebtoken";
import { config } from "./config";
import { prisma } from "./prisma";

export function hashPassword(password: string): string {
  return bcrypt.hashSync(password, 10);
}

export function verifyPassword(plainPassword: string, hashedPassword: string): boolean {
  return bcrypt.compareSync(plainPassword, hashedPassword);
}

export function createAccessToken(userId: number, email: string): string {
  if (!config.jwtSecret) {
    throw new Error("JWT secret is not configured");
  }
  return jwt.sign(
    { sub: String(userId), email, type: "access" },
    config.jwtSecret,
    { expiresIn: "24h" }
  );
}

export function createRefreshToken(userId: number): string {
  if (!config.jwtSecret) {
    throw new Error("JWT secret is not configured");
  }
  return jwt.sign(
    { sub: String(userId), type: "refresh" },
    config.jwtSecret,
    { expiresIn: "7d" }
  );
}

export interface AuthUser {
  id: number;
  email: string;
  name: string | null;
  role: string;
  dailyCalories: number;
  dailyProtein: number;
  dailyCarbs: number;
  dailyFats: number;
  age: number | null;
  heightCm: number | null;
  currentWeightKg: number | null;
  targetWeightKg: number | null;
  goalType: string | null;
  weeklyPaceKg: number | null;
  targetDate: string | null;
  dietType: string | null;
  onboardingCompleted: boolean;
  createdAt: Date;
  updatedAt: Date | null;
}

export async function getCurrentUser(token: string): Promise<AuthUser | null> {
  try {
    if (!config.jwtSecret) {
      throw new Error("JWT secret is not configured");
    }
    const payload = jwt.verify(token, config.jwtSecret) as JwtPayload & { sub: string; type: string; email?: string };

    if (payload.type !== "access") return null;

    const userId = parseInt(payload.sub, 10);
    if (isNaN(userId)) return null;

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) return null;

    return user as AuthUser;
  } catch {
    return null;
  }
}

export function buildUserPayload(
  user: AuthUser,
  token?: string
): Record<string, unknown> {
  const payload = {
    id: String(user.id),
    email: user.email,
    name: user.name || "",
    role: user.role,
    daily_calories: user.dailyCalories,
    daily_protein: user.dailyProtein,
    daily_carbs: user.dailyCarbs,
    daily_fats: user.dailyFats,
    onboarding_completed: user.onboardingCompleted,
    goal_type: user.goalType,
    diet_type: user.dietType,
    age: user.age,
    height_cm: user.heightCm,
    current_weight_kg: user.currentWeightKg,
    target_weight_kg: user.targetWeightKg,
    weekly_pace_kg: user.weeklyPaceKg,
  };
  if (token) {
    (payload as Record<string, unknown>).token = token;
  }
  return payload;
}

export function calculateDailyGoals(
  goalType: string,
  currentWeightKg: number,
  heightCm: number,
  age: number,
  weeklyPaceKg: number
): [number, number, number, number] {
  const maintenance = Math.max(1400, Math.round(currentWeightKg * 30));
  const dailyDelta = Math.round(weeklyPaceKg * 1100);

  let dailyCalories: number;
  let proteinPerKg: number;

  if (goalType === "lose") {
    dailyCalories = Math.max(1200, maintenance - dailyDelta);
    proteinPerKg = 1.8;
  } else if (goalType === "gain") {
    dailyCalories = Math.min(4200, maintenance + dailyDelta);
    proteinPerKg = 1.7;
  } else {
    dailyCalories = maintenance;
    proteinPerKg = 1.6;
  }

  const protein = Math.max(80, Math.round(currentWeightKg * proteinPerKg));
  const fats = Math.max(40, Math.round((dailyCalories * 0.27) / 9));
  let carbs = Math.round((dailyCalories - protein * 4 - fats * 9) / 4);
  carbs = Math.max(50, carbs);

  return [dailyCalories, protein, carbs, fats];
}