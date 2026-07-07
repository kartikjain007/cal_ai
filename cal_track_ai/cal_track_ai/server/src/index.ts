import express, { Request, Response } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { logger } from "./utils/config";
import { connectDatabase } from "./utils/prisma";
import { registerAuthRoutes } from "./routes/auth";
import { registerMealRoutes } from "./routes/meals";
import { registerAnalyticsRoutes } from "./routes/analytics";
import { registerUserRoutes } from "./routes/user";
import { registerActivitiesRoutes } from "./routes/activities";

const app = express();

app.use(cors({
  credentials: true,
  origin: true,
}));
app.use(express.json({ limit: "10mb" }));
app.use(cookieParser());

// index.ts — add near the top, before routes are registered
import { randomUUID } from "crypto";

declare global {
  namespace Express {
    interface Request {
      requestId?: string;
    }
  }
}

app.use((req: Request, res: Response, next) => {
  req.requestId = randomUUID();
  res.setHeader("X-Request-Id", req.requestId);
  next();
});

// routes/meals.ts — inside getTodaySummary, replace the final return
const requestId = req.requestId ?? randomUUID();
const generatedAt = new Date().toISOString();

logger.info(
  `audit request_id=${requestId} user_id=${userId} action=today_summary_view date=${target.toISOString()} timestamp=${generatedAt}`
);

return res.json({
  total_calories: totals.calories || 0,
  total_protein: totals.protein || 0,
  total_carbs: totals.carbs || 0,
  total_fats: totals.fats || 0,
  meal_count: meals.length,
  goal_calories: req.user!.dailyCalories,
  goal_protein: req.user!.dailyProtein,
  goal_carbs: req.user!.dailyCarbs,
  goal_fats: req.user!.dailyFats,
  metadata: {
    request_id: requestId,
    generated_at: generatedAt,
  },
  accuracy: {
    source: "ai_estimated",
    method: "gemini_nutrition_analysis_per_meal",
    confidence_level: "approximate",
    disclaimer:
      "Totals are aggregated from AI-estimated per-meal values, not lab-measured; individual meal estimates may deviate ±15-20% from actual nutrient content.",
  },
});


app.get("/", (_req: Request, res: Response) => {
  res.json({
    message: "Welcome to the CalTrack AI API",
    intended_purpose:
      "AI-assisted nutrition estimation and meal logging for personal dietary tracking.",
    intended_use:
      "Informational self-tracking of estimated calorie/macro intake. Not a medical device and not intended to diagnose, treat, or manage any health condition (e.g. diabetes, eating disorders).",
    limitations: [
      "Nutrition values are AI-generated estimates (Gemini) from a photo/description, not lab-measured — expect variance from stated goals.",
      "Requires clear meal descriptions/images; accuracy degrades with ambiguous or incomplete input.",
      "Not validated for clinical or regulatory nutrition-reporting use.",
    ],
    version: "1.0.0",
  });
});


// Register routes synchronously so they are available immediately in Vercel Serverless environment
registerAuthRoutes(app);
registerMealRoutes(app);
registerAnalyticsRoutes(app);
registerUserRoutes(app);
registerActivitiesRoutes(app);

async function main() {
  await connectDatabase();
  logger.info("Database connected");

  if (!process.env.VERCEL) {
    const port = process.env.PORT || 3000;
    app.listen(port, () => {
      logger.info(`Server running on port ${port}`);
    });
  }
}

main().catch((err) => {
  logger.error("Failed to start server/seed admin:", err);
});

export default app;
