import dotenv from "dotenv";

dotenv.config();

export const config = {
  databaseUrl: process.env.DATABASE_URL,
  jwtSecret: process.env.JWT_SECRET,
  jwtAlgorithm: "HS256",
  geminiApiKey: process.env.GEMINI_API_KEY,
  geminiModel: process.env.GEMINI_MODEL,
  // Authenticates the scheduled log-retention prune job (vercel.json
  // "crons"). Vercel automatically sends `Authorization: Bearer
  // $CRON_SECRET` on cron-triggered requests when this env var is set —
  // see routes/admin.ts, pruneLogs.
  cronSecret: process.env.CRON_SECRET,
};

export const logger = {
  info: (...args: unknown[]) => console.info(`[${new Date().toISOString()}] INFO:`, ...args),
  warn: (...args: unknown[]) => console.warn(`[${new Date().toISOString()}] WARN:`, ...args),
  error: (...args: unknown[]) => console.error(`[${new Date().toISOString()}] ERROR:`, ...args),
};