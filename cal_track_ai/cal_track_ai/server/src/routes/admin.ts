import { Request, Response } from "express";
import { prisma } from "../utils/prisma";
import { authMiddleware, requireAdmin } from "../middleware/auth";
import { config, logger } from "../utils/config";
import { getAiAnalysisStatus, setAiAnalysisEnabled } from "../utils/systemSettings";
import { pruneExpiredLogEvents, LOG_RETENTION_DAYS } from "../utils/eventLog";

// Human-oversight endpoints (Art. 14(2)): a kill-switch to stop the AI
// meal-analysis pipeline, and a review queue so a person can inspect and
// resolve records the automated plausibility checks flagged
// (validateMealEstimate / validateExerciseEstimate in utils/validation.ts).
// Every action here writes a ReviewAction row so oversight decisions are
// auditable, not just logged to stdout.

export async function getOversightStatus(req: Request, res: Response) {
  const status = await getAiAnalysisStatus();
  return res.json({
    ai_analysis_enabled: status.enabled,
    updated_by_user_id: status.updatedByUserId,
    updated_at: status.updatedAt,
  });
}

export async function setOversightStatus(req: Request, res: Response) {
  const { enabled, reason } = req.body ?? {};
  if (typeof enabled !== "boolean") {
    return res.status(400).json({ detail: "enabled must be a boolean" });
  }
  if (!enabled && (typeof reason !== "string" || reason.trim().length === 0)) {
    return res.status(400).json({ detail: "reason is required when stopping AI analysis" });
  }

  const adminId = req.user!.id;
  const status = await setAiAnalysisEnabled(enabled, adminId);

  await prisma.reviewAction.create({
    data: {
      entityType: "system",
      entityId: 0,
      reviewerId: adminId,
      decision: enabled ? "enabled" : "disabled",
      note: typeof reason === "string" ? reason : null,
    },
  });

  logger.warn(
    `ai_analysis_kill_switch admin_id=${adminId} enabled=${enabled} reason=${reason ?? ""}`
  );

  return res.json({
    ai_analysis_enabled: status.enabled,
    updated_by_user_id: status.updatedByUserId,
    updated_at: status.updatedAt,
  });
}

const ENTITY_TYPES = ["meal", "exercise", "water_log"] as const;
type EntityType = (typeof ENTITY_TYPES)[number];

function isEntityType(value: string): value is EntityType {
  return (ENTITY_TYPES as readonly string[]).includes(value);
}

export async function getReviewQueue(req: Request, res: Response) {
  const [meals, exercises, waterLogs] = await Promise.all([
    prisma.meal.findMany({
      where: { flaggedForReview: true },
      orderBy: { createdAt: "asc" },
      take: 100,
      include: { user: { select: { id: true, email: true } } },
    }),
    prisma.exercise.findMany({
      where: { flaggedForReview: true },
      orderBy: { createdAt: "asc" },
      take: 100,
      include: { user: { select: { id: true, email: true } } },
    }),
    prisma.waterLog.findMany({
      where: { flaggedForReview: true },
      orderBy: { createdAt: "asc" },
      take: 100,
      include: { user: { select: { id: true, email: true } } },
    }),
  ]);

  return res.json({
    items: [
      ...meals.map((m) => ({
        entity_type: "meal" as const,
        id: String(m.id),
        user_id: String(m.userId),
        user_email: m.user.email,
        summary: `${m.foodName ?? "Unknown food"} — ${m.calories ?? 0} kcal`,
        confidence: m.confidence,
        logged_at: m.loggedAt?.toISOString() ?? null,
        created_at: m.createdAt.toISOString(),
      })),
      ...exercises.map((e) => ({
        entity_type: "exercise" as const,
        id: String(e.id),
        user_id: String(e.userId),
        user_email: e.user.email,
        summary: `${e.exerciseName} — ${e.caloriesBurned} kcal / ${e.durationMinutes} min`,
        confidence: null,
        logged_at: e.loggedAt.toISOString(),
        created_at: e.createdAt.toISOString(),
      })),
      ...waterLogs.map((w) => ({
        entity_type: "water_log" as const,
        id: String(w.id),
        user_id: String(w.userId),
        user_email: w.user.email,
        summary: `${w.amountMl}ml`,
        confidence: null,
        logged_at: w.loggedAt.toISOString(),
        created_at: w.createdAt.toISOString(),
      })),
    ],
    instructions_for_use: {
      intended_use:
        "Queue of records the automated plausibility checks flagged (low model confidence, implausible calorie density, macro/calorie mismatch, or an anomalous daily total). Resolve via POST /api/admin/review-queue/:entityType/:id/decision.",
    },
  });
}

export async function decideReviewItem(req: Request, res: Response) {
  const { entityType, id } = req.params;
  const { decision, note, corrections } = req.body ?? {};

  if (!isEntityType(entityType)) {
    return res.status(400).json({ detail: `entityType must be one of: ${ENTITY_TYPES.join(", ")}` });
  }
  const entityId = parseInt(id, 10);
  if (isNaN(entityId)) {
    return res.status(400).json({ detail: "Invalid id" });
  }
  if (decision !== "approved" && decision !== "corrected" && decision !== "rejected") {
    return res.status(400).json({ detail: "decision must be one of: approved, corrected, rejected" });
  }

  const reviewerId = req.user!.id;

  const correctionData: Record<string, unknown> = {};
  if (decision === "corrected" && corrections && typeof corrections === "object") {
    if (entityType === "meal") {
      const c = corrections as Record<string, unknown>;
      if (typeof c.food_name === "string") correctionData.foodName = c.food_name;
      if (typeof c.calories === "number") correctionData.calories = c.calories;
      if (typeof c.protein === "number") correctionData.protein = c.protein;
      if (typeof c.carbs === "number") correctionData.carbs = c.carbs;
      if (typeof c.fats === "number") correctionData.fats = c.fats;
      if (typeof c.quantity_grams === "number") correctionData.quantityGrams = c.quantity_grams;
    }
  }

  let existing: { id: number } | null = null;
  if (entityType === "meal") {
    existing = await prisma.meal.findUnique({ where: { id: entityId } });
  } else if (entityType === "exercise") {
    existing = await prisma.exercise.findUnique({ where: { id: entityId } });
  } else {
    existing = await prisma.waterLog.findUnique({ where: { id: entityId } });
  }
  if (!existing) {
    return res.status(404).json({ detail: `${entityType} not found` });
  }

  if (decision === "rejected") {
    if (entityType === "meal") await prisma.meal.delete({ where: { id: entityId } });
    else if (entityType === "exercise") await prisma.exercise.delete({ where: { id: entityId } });
    else await prisma.waterLog.delete({ where: { id: entityId } });
  } else {
    const data = { ...correctionData, flaggedForReview: false };
    if (entityType === "meal") await prisma.meal.update({ where: { id: entityId }, data });
    else if (entityType === "exercise") await prisma.exercise.update({ where: { id: entityId }, data });
    else await prisma.waterLog.update({ where: { id: entityId }, data });
  }

  await prisma.reviewAction.create({
    data: {
      entityType,
      entityId,
      reviewerId,
      decision,
      note: typeof note === "string" ? note : null,
    },
  });

  logger.info(
    `review_action entity_type=${entityType} entity_id=${entityId} reviewer_id=${reviewerId} decision=${decision}`
  );

  return res.json({ message: "Review recorded", entity_type: entityType, id: String(entityId), decision });
}

// Art. 12.2 log retention: deletes log_events rows past LOG_RETENTION_DAYS.
// Triggered by the daily Vercel Cron job (vercel.json), which authenticates
// via `Authorization: Bearer $CRON_SECRET` rather than a user session — a
// cron invocation has no logged-in admin to check against. Also reachable
// by an authenticated admin for a manual/on-demand prune.
export async function pruneLogs(req: Request, res: Response) {
  const authHeader = req.headers.authorization;
  const isCron = !!config.cronSecret && authHeader === `Bearer ${config.cronSecret}`;
  const isAdmin = req.user?.role === "admin";
  if (!isCron && !isAdmin) {
    return res.status(401).json({ detail: "Not authenticated" });
  }

  const result = await pruneExpiredLogEvents();
  logger.info(`log_events_pruned count=${result.count} retention_days=${LOG_RETENTION_DAYS}`);

  return res.json({ pruned: result.count, retention_days: LOG_RETENTION_DAYS });
}

export function registerAdminRoutes(app: import("express").Express) {
  app.get("/api/admin/oversight/status", authMiddleware, requireAdmin, getOversightStatus);
  app.post("/api/admin/oversight/status", authMiddleware, requireAdmin, setOversightStatus);
  app.get("/api/admin/review-queue", authMiddleware, requireAdmin, getReviewQueue);
  app.post("/api/admin/review-queue/:entityType/:id/decision", authMiddleware, requireAdmin, decideReviewItem);
  app.get("/api/admin/logs/prune", pruneLogs);
}
