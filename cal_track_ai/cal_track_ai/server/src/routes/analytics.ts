import { Request, Response } from "express";
import { prisma } from "../utils/prisma";
import { authMiddleware } from "../middleware/auth";

export async function getWeeklyAnalytics(req: Request, res: Response) {
  const userId = req.user!.id;

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 6);
  const nextOfToday = new Date(today);
  nextOfToday.setDate(nextOfToday.getDate() + 1);

  const meals = await prisma.meal.findMany({
    where: {
      userId,
      loggedAt: {
        gte: weekAgo,
        lt: nextOfToday,
      },
    },
  });

  const mealsByDay: Record<string, typeof meals> = {};
  for (const m of meals) {
    const dayStr = m.loggedAt?.toISOString().split("T")[0] || "";
    if (!mealsByDay[dayStr]) {
      mealsByDay[dayStr] = [];
    }
    mealsByDay[dayStr].push(m);
  }

  const days = [];
  for (let i = 0; i < 7; i++) {
    const day = new Date(weekAgo);
    day.setDate(day.getDate() + i);
    const dayStr = day.toISOString().split("T")[0];
    const dayMeals = mealsByDay[dayStr] || [];

    days.push({
      date: dayStr,
      day_label: day.toLocaleDateString("en-US", { weekday: "short" }),
      calories: dayMeals.reduce((sum, m) => sum + (m.calories || 0), 0),
      protein: dayMeals.reduce((sum, m) => sum + (m.protein || 0), 0),
      carbs: dayMeals.reduce((sum, m) => sum + (m.carbs || 0), 0),
      fats: dayMeals.reduce((sum, m) => sum + (m.fats || 0), 0),
      meal_count: dayMeals.length,
    });
  }

  return res.json({ days, period: "weekly" });
}

export async function getMonthlyAnalytics(req: Request, res: Response) {
  const userId = req.user!.id;

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const monthAgo = new Date(today);
  monthAgo.setDate(monthAgo.getDate() - 29);
  const nextOfToday = new Date(today);
  nextOfToday.setDate(nextOfToday.getDate() + 1);

  const meals = await prisma.meal.findMany({
    where: {
      userId,
      loggedAt: {
        gte: monthAgo,
        lt: nextOfToday,
      },
    },
  });

  const mealsByDay: Record<string, typeof meals> = {};
  for (const m of meals) {
    const dayStr = m.loggedAt?.toISOString().split("T")[0] || "";
    if (!mealsByDay[dayStr]) {
      mealsByDay[dayStr] = [];
    }
    mealsByDay[dayStr].push(m);
  }

  const days = [];
  for (let i = 0; i < 30; i++) {
    const day = new Date(monthAgo);
    day.setDate(day.getDate() + i);
    const dayStr = day.toISOString().split("T")[0];
    const dayMeals = mealsByDay[dayStr] || [];

    days.push({
      date: dayStr,
      day_label: day.toLocaleDateString("en-US", { day: "numeric", month: "short" }),
      calories: dayMeals.reduce((sum, m) => sum + (m.calories || 0), 0),
      protein: dayMeals.reduce((sum, m) => sum + (m.protein || 0), 0),
      carbs: dayMeals.reduce((sum, m) => sum + (m.carbs || 0), 0),
      fats: dayMeals.reduce((sum, m) => sum + (m.fats || 0), 0),
      meal_count: dayMeals.length,
    });
  }

  return res.json({ days, period: "monthly" });
}

export function registerAnalyticsRoutes(app: import("express").Express) {
  app.get("/api/analytics/weekly", authMiddleware, getWeeklyAnalytics);
  app.get("/api/analytics/monthly", authMiddleware, getMonthlyAnalytics);
}