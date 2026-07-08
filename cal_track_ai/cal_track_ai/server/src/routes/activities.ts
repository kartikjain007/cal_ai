import { Request, Response } from "express";
import { randomUUID } from "crypto";
import { prisma } from "../utils/prisma";
import { authMiddleware } from "../middleware/auth";
import {
  waterLogSchema,
  exerciseLogSchema,
  validateExerciseEstimate,
  MAX_DAILY_WATER_ML,
  MAX_DAILY_EXERCISE_MINUTES,
} from "../utils/validation";
import { logger } from "../utils/config";

export async function saveWater(req: Request, res: Response) {
  const parseResult = waterLogSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ detail: parseResult.error.errors });
  }

  

  const userId = req.user!.id;
  const { amount_ml, logged_at } = parseResult.data;

  const loggedAt = logged_at ? new Date(logged_at) : new Date();

  const dayStart = new Date(loggedAt);
dayStart.setUTCHours(0, 0, 0, 0);
const dayEnd = new Date(dayStart);
dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

const dailyTotal = await prisma.waterLog.aggregate({
  where: { userId, loggedAt: { gte: dayStart, lt: dayEnd } },
  _sum: { amountMl: true },
});
const projectedTotal = (dailyTotal._sum.amountMl ?? 0) + amount_ml;

if (projectedTotal > MAX_DAILY_WATER_ML) {
  logger.warn("water_log_daily_total_anomaly", { userId, projectedTotal });
  // still store the entry (don't silently drop user data), but mark it
  // for the same review flag pattern used on meal estimates
}

const waterLog = await prisma.waterLog.create({
  data: {
    userId,
    amountMl: amount_ml,
    loggedAt: loggedAt,
    flaggedForReview: projectedTotal > MAX_DAILY_WATER_ML,
  },
});


  return res.json({
    id: String(waterLog.id),
    amount_ml: waterLog.amountMl,
    logged_at: waterLog.loggedAt.toISOString(),
    needs_review: waterLog.flaggedForReview,
    type: "water",
  });
}

export async function deleteWater(req: Request, res: Response) {
  const { logId } = req.params;
  const userId = req.user!.id;

  const id = parseInt(logId, 10);
  if (isNaN(id)) {
    return res.status(400).json({ detail: "Invalid log ID format" });
  }

  const existing = await prisma.waterLog.findFirst({
    where: { id, userId },
  });

  if (!existing) {
    return res.status(404).json({ detail: "Water log not found" });
  }

  await prisma.waterLog.delete({
    where: { id },
  });

  return res.json({ message: "Deleted" });
}

export async function getWater(req: Request, res: Response) {
  const { date } = req.query;
  const userId = req.user!.id;

  let where: Record<string, unknown> = { userId };

  if (date) {
    try {
      const targetDate = new Date(date as string);
      targetDate.setUTCHours(0, 0, 0, 0);
      const nextDay = new Date(targetDate);
      nextDay.setDate(nextDay.getDate() + 1);

      where = {
        ...where,
        loggedAt: {
          gte: targetDate,
          lt: nextDay,
        },
      };
    } catch {
      // ignore invalid date
    }
  }

  const logs = await prisma.waterLog.findMany({
    where,
    orderBy: { loggedAt: "desc" },
  });

  return res.json(
    logs.map((r) => ({
      id: String(r.id),
      amount_ml: r.amountMl,
      logged_at: r.loggedAt.toISOString(),
      needs_review: r.flaggedForReview,
      type: "water",
    }))
  );
}

export async function saveExercise(req: Request, res: Response) {
  const parseResult = exerciseLogSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ detail: parseResult.error.errors });
  }

  const userId = req.user!.id;
  const { exercise_name, duration_minutes, calories_burned, logged_at } = parseResult.data;
  const requestId = req.requestId ?? randomUUID();

  const loggedAt = logged_at ? new Date(logged_at) : new Date();

  const rateCheck = validateExerciseEstimate({
    durationMinutes: duration_minutes,
    caloriesBurned: calories_burned,
  });

  const dayStart = new Date(loggedAt);
  dayStart.setUTCHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

  const dailyTotal = await prisma.exercise.aggregate({
    where: { userId, loggedAt: { gte: dayStart, lt: dayEnd } },
    _sum: { durationMinutes: true },
  });
  const projectedDurationTotal = (dailyTotal._sum.durationMinutes ?? 0) + duration_minutes;
  const dailyAnomaly = projectedDurationTotal > MAX_DAILY_EXERCISE_MINUTES;

  const flaggedForReview = rateCheck.needsReview || dailyAnomaly;
  if (flaggedForReview) {
    logger.warn(
      `exercise_log_flagged request_id=${requestId} user_id=${userId} reasons=${rateCheck.reasons.join(",")}${
        dailyAnomaly ? `,daily_duration_anomaly:${projectedDurationTotal}` : ""
      }`
    );
  }

  const exercise = await prisma.exercise.create({
    data: {
      userId,
      exerciseName: exercise_name,
      durationMinutes: duration_minutes,
      caloriesBurned: calories_burned,
      loggedAt,
      flaggedForReview,
    },
  });

  return res.json({
    id: String(exercise.id),
    exercise_name: exercise.exerciseName,
    duration_minutes: exercise.durationMinutes,
    calories_burned: exercise.caloriesBurned,
    logged_at: exercise.loggedAt.toISOString(),
    needs_review: exercise.flaggedForReview,
    type: "exercise",
  });
}

export async function deleteExercise(req: Request, res: Response) {
  const { logId } = req.params;
  const userId = req.user!.id;

  const id = parseInt(logId, 10);
  if (isNaN(id)) {
    return res.status(400).json({ detail: "Invalid log ID format" });
  }

  const existing = await prisma.exercise.findFirst({
    where: { id, userId },
  });

  if (!existing) {
    return res.status(404).json({ detail: "Exercise not found" });
  }

  await prisma.exercise.delete({
    where: { id },
  });

  return res.json({ message: "Deleted" });
}

export async function getExercises(req: Request, res: Response) {
  const { date } = req.query;
  const userId = req.user!.id;

  let where: Record<string, unknown> = { userId };

  if (date) {
    try {
      const targetDate = new Date(date as string);
      targetDate.setUTCHours(0, 0, 0, 0);
      const nextDay = new Date(targetDate);
      nextDay.setDate(nextDay.getDate() + 1);

      where = {
        ...where,
        loggedAt: {
          gte: targetDate,
          lt: nextDay,
        },
      };
    } catch {
      // ignore invalid date
    }
  }

  const exercises = await prisma.exercise.findMany({
    where,
    orderBy: { loggedAt: "desc" },
  });

  // Automatic logging capability (Art. 12.1): every read of exercise data is
  // tied to the request's identifier so an access can be traced back to a
  // specific request/user/time later. req.requestId is assigned by the
  // global middleware in index.ts and echoed on every response as the
  // X-Request-Id header; this line is the durable, queryable record of it.
  const requestId = req.requestId ?? randomUUID();
  const flaggedCount = exercises.filter((r) => r.flaggedForReview).length;
  logger.info(
    `exercises_list_view request_id=${requestId} user_id=${userId} count=${exercises.length} flagged_count=${flaggedCount} timestamp=${new Date().toISOString()}`
  );

  return res.json(
    exercises.map((r) => ({
      id: String(r.id),
      exercise_name: r.exerciseName,
      duration_minutes: r.durationMinutes,
      calories_burned: r.caloriesBurned,
      logged_at: r.loggedAt.toISOString(),
      needs_review: r.flaggedForReview,
      type: "exercise",
    }))
  );
}

export function registerActivitiesRoutes(app: import("express").Express) {
  app.post("/api/activities/water", authMiddleware, saveWater);
  app.delete("/api/activities/water/:logId", authMiddleware, deleteWater);
  app.get("/api/activities/water", authMiddleware, getWater);
  app.post("/api/activities/exercises", authMiddleware, saveExercise);
  app.delete("/api/activities/exercises/:logId", authMiddleware, deleteExercise);
  app.get("/api/activities/exercises", authMiddleware, getExercises);
}
