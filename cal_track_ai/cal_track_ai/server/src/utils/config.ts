import dotenv from "dotenv";

dotenv.config();

export const config = {
  databaseUrl: process.env.DATABASE_URL,
  jwtSecret: process.env.JWT_SECRET,
  jwtAlgorithm: "HS256",
  geminiApiKey: process.env.GEMINI_API_KEY,
  geminiModel: process.env.GEMINI_MODEL,
};

export const logger = {
  info: (...args: unknown[]) => console.info(`[${new Date().toISOString()}] INFO:`, ...args),
  warn: (...args: unknown[]) => console.warn(`[${new Date().toISOString()}] WARN:`, ...args),
  error: (...args: unknown[]) => console.error(`[${new Date().toISOString()}] ERROR:`, ...args),
};