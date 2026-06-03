import { Request, Response } from "express";
import { prisma } from "../utils/prisma";
import { authMiddleware } from "../middleware/auth";
import { buildUserPayload, calculateDailyGoals } from "../utils/auth";
import { goalsUpdateSchema, profileUpdateSchema, onboardingSchema } from "../utils/validation";

export async function updateGoals(req: Request, res: Response) {
  const parseResult = goalsUpdateSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ detail: parseResult.error.errors });
  }

  const userId = req.user!.id;
  const { daily_calories, daily_protein, daily_carbs, daily_fats } = parseResult.data;

  await prisma.user.update({
    where: { id: userId },
    data: {
      dailyCalories: daily_calories,
      dailyProtein: daily_protein,
      dailyCarbs: daily_carbs,
      dailyFats: daily_fats,
    },
  });

  return res.json({
    message: "Goals updated",
    daily_calories,
    daily_protein,
    daily_carbs,
    daily_fats,
  });
}

export async function updateProfile(req: Request, res: Response) {
  const parseResult = profileUpdateSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ detail: parseResult.error.errors });
  }

  const userId = req.user!.id;
  const data = parseResult.data;

  const updateFields: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) {
      const dbKey = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
      updateFields[dbKey] = value;
    }
  }

  if (Object.keys(updateFields).length > 0) {
    updateFields.updatedAt = new Date();
    await prisma.user.update({
      where: { id: userId },
      data: updateFields as Record<string, never>,
    });
  }

  const updated = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!updated) {
    return res.status(404).json({ detail: "User not found" });
  }

  return res.json(buildUserPayload(updated));
}

export async function completeOnboarding(req: Request, res: Response) {
  const parseResult = onboardingSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ detail: parseResult.error.errors });
  }

  const userId = req.user!.id;
  const data = parseResult.data;

  const [daily_calories, daily_protein, daily_carbs, daily_fats] = calculateDailyGoals(
    data.goal_type,
    data.current_weight_kg,
    data.height_cm,
    data.age,
    data.weekly_pace_kg
  );

  let targetDate: string | null = null;
  const weightDelta = Math.abs(data.current_weight_kg - data.target_weight_kg);
  
  if (data.goal_type === "maintain") {
    const target = new Date();
    target.setDate(target.getDate() + 30);
    targetDate = target.toISOString().split("T")[0];
  } else if (data.weekly_pace_kg > 0) {
    const weeks = Math.max(1, Math.round(weightDelta / data.weekly_pace_kg));
    const target = new Date();
    target.setDate(target.getDate() + weeks * 7);
    targetDate = target.toISOString().split("T")[0];
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      goalType: data.goal_type,
      dietType: data.diet_type,
      age: data.age,
      heightCm: data.height_cm,
      currentWeightKg: data.current_weight_kg,
      targetWeightKg: data.target_weight_kg,
      weeklyPaceKg: data.weekly_pace_kg,
      targetDate,
      dailyCalories: daily_calories,
      dailyProtein: daily_protein,
      dailyCarbs: daily_carbs,
      dailyFats: daily_fats,
      onboardingCompleted: true,
      updatedAt: new Date(),
    },
  });

  const updated = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!updated) {
    return res.status(404).json({ detail: "User not found" });
  }

  return res.json(buildUserPayload(updated));
}

export function registerUserRoutes(app: import("express").Express) {
  app.put("/api/user/goals", authMiddleware, updateGoals);
  app.put("/api/user/profile", authMiddleware, updateProfile);
  app.put("/api/user/onboarding", authMiddleware, completeOnboarding);
}