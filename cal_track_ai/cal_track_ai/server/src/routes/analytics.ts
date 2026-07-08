import { Request, Response } from "express";
import { randomUUID } from "crypto";
import { prisma } from "../utils/prisma";
import { authMiddleware } from "../middleware/auth";
import { computeAccuracyMetrics } from "../utils/validation";
import { logger } from "../utils/config";

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
      flagged_meal_count: dayMeals.filter((m) => m.flaggedForReview).length,
      // Art. 15.1 — per-day accuracy signal, so a low-quality day is
      // visible at the granularity it actually occurred, not just diluted
      // into a week-wide average.
      accuracy_metrics: computeAccuracyMetrics(dayMeals),
    });
  }

  // Automatic logging capability (Art. 12.1) — tie this read to a request
  // correlation ID, both in a queryable audit log line and in the response
  // body itself, mirroring getExercises/getTodaySummary.
  const requestId = req.requestId ?? randomUUID();
  const generatedAt = new Date().toISOString();
  logger.info(
    `analytics_weekly_view request_id=${requestId} user_id=${userId} day_count=${days.length} timestamp=${generatedAt}`
  );

  return res.json({
    days,
    period: "weekly",
    metadata: {
      request_id: requestId,
      generated_at: generatedAt,
    },
    data_quality: {
      source: "ai_estimated",
      method: "gemini_nutrition_analysis_per_meal",
      // Art. 15.1 — week-wide accuracy signal aggregated across every
      // contributing meal, complementing the per-day accuracy_metrics
      // above. Same shape/semantics as GET /api/meals/today-summary.
      accuracy_metrics: computeAccuracyMetrics(meals),
      flagged_meal_count: meals.filter((m) => m.flaggedForReview).length,
      disclaimer:
        "Daily totals are aggregated from AI-estimated per-meal values, not lab-measured; individual meal estimates may deviate meaningfully from actual nutrient content. See docs/DATA_GOVERNANCE.md for the full accuracy-metrics methodology.",
    },
  });
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