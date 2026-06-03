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

app.get("/", (_req: Request, res: Response) => {
  res.json({ message: "Welcome to the CalTrack AI API" });
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