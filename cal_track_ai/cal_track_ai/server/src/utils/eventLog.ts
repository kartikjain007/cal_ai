import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { logger } from "./config";

// Art. 12.2 requires flagged AI-system events to remain traceable by
// request ID for a documented retention period. 186 days (6 * 31, so a
// row is never pruned before it's been retained a full 6 calendar months
// regardless of month length) is the minimum this system commits to; see
// docs/DATA_GOVERNANCE.md.
export const LOG_RETENTION_DAYS = 186;

export type LogLevel = "info" | "warn" | "error";

interface LogEventInput {
  event: string;
  level?: LogLevel;
  requestId?: string;
  userId?: number;
  message: string;
  metadata?: Record<string, unknown>;
}

// Durable counterpart to `logger` (utils/config.ts), which only writes to
// console/stdout — not queryable after the fact, and not durable at all in
// hosting environments (e.g. Vercel serverless) where stdout isn't shipped
// anywhere by default. This keeps the existing console line (so local dev
// and any platform log capture still see it) and additionally persists a
// structured row per event, so the record survives past the process that
// wrote it and can be looked up by request_id later.
export async function logEvent({
  event,
  level = "info",
  requestId,
  userId,
  message,
  metadata,
}: LogEventInput): Promise<void> {
  const log = level === "error" ? logger.error : level === "warn" ? logger.warn : logger.info;
  log(message);

  try {
    await prisma.logEvent.create({
      data: {
        event,
        level,
        requestId,
        userId,
        message,
        metadata: (metadata as Prisma.InputJsonValue) ?? undefined,
      },
    });
  } catch (err) {
    // Durable storage is best-effort: a persistence failure must never
    // break the request it's describing. The console line above still
    // went out, so the event isn't silently lost, only not durable.
    logger.error(`Failed to persist log event "${event}":`, err);
  }
}

// Purges log_events rows past the retention window. Run on a schedule
// (see vercel.json cron -> POST /api/admin/logs/prune) rather than an
// in-process timer, since serverless instances don't stay alive long
// enough to host one.
export async function pruneExpiredLogEvents(now: Date = new Date()) {
  const cutoff = new Date(now.getTime() - LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  return prisma.logEvent.deleteMany({ where: { createdAt: { lt: cutoff } } });
}
