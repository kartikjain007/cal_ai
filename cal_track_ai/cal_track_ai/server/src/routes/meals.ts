import { Request, Response } from "express";
import { prisma } from "../utils/prisma";
import { mealAnalyzeSchema, mealSaveSchema, mealUpdateSchema } from "../utils/validation";
import { authMiddleware } from "../middleware/auth";
import { config, logger } from "../utils/config";

export async function analyzeMeal(req: Request, res: Response) {
  const parseResult = mealAnalyzeSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ detail: parseResult.error.errors });
  }

  console.log('Gemini API key not configured', config);
  if (!config.geminiApiKey) {
    return res.status(500).json({ detail: "AI service not configured" });
  }

  const { image_base64, meal_type } = parseResult.data;

  try {
    const prompt = `You are a nutrition analysis AI. When given a food image, analyze it and return ONLY a valid JSON object (no markdown, no explanation) with these fields:
{
  "food_name": "Name of the dish/food",
  "calories": number,
  "protein": number (grams),
  "carbs": number (grams),
  "fats": number (grams),
  "fiber": number (grams),
  "health_score": number (1-10),
  "quantity_grams": number (estimated weight in grams),
  "ingredients": ["ingredient1", "ingredient2"],
  "meal_description": "Brief description of the meal"
}
Be as accurate as possible with portion estimation. Always return valid JSON only.`;

    let mimeType = "image/jpeg";
    let imageData = image_base64.trim();
    if (imageData.startsWith("data:")) {
      const parts = imageData.split(",", 2);
      imageData = parts[1];
      if (parts[0].includes(";base64")) {
        mimeType = parts[0].slice(5).split(";")[0];
      }
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${config.geminiModel}:generateContent?key=${config.geminiApiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: prompt },
                {
                  inlineData: {
                    mimeType,
                    data: imageData,
                  },
                },
                { text: "Analyze this food image and provide the nutritional information as JSON." },
              ],
            },
          ],
        }),
      }
    );

    const result = await response.json();
    logger.info(`Gemini raw response: ${JSON.stringify(result, null, 2)}`);

    const responseText =
      (result as any).candidates?.[0]?.content?.parts?.[0]?.text || "";
    logger.info(`Gemini response: ${responseText}`);

    if (!responseText) {
      logger.error("Gemini response text is empty.");
      return res.status(500).json({ detail: "Analysis failed: Empty response from AI" });
    }

    const cleanText = responseText
      .replace(/^```json/, "")
      .replace(/^```/, "")
      .replace(/```$/, "")
      .trim();

    try {
      const nutritionData = JSON.parse(cleanText) as Record<string, unknown>;
      return res.json({
        food_name: nutritionData.food_name || "Unknown Food",
        calories: nutritionData.calories || 0,
        protein: nutritionData.protein || 0,
        carbs: nutritionData.carbs || 0,
        fats: nutritionData.fats || 0,
        fiber: nutritionData.fiber || 0,
        health_score: nutritionData.health_score || 5,
        quantity_grams: nutritionData.quantity_grams || 100,
        ingredients: nutritionData.ingredients || [],
        meal_description: nutritionData.meal_description || "",
        meal_type,
      });
    } catch (e) {
      logger.error(`Failed to parse Gemini response: ${e}`);
      return res.status(500).json({ detail: `Analysis failed: Invalid response from AI` });
    }
  } catch (error) {
    logger.error(`Meal analysis failed: ${error}`);
    if (error instanceof Error) {
      return res.status(500).json({ detail: `Analysis failed: ${error.message}` });
    }
    return res.status(500).json({ detail: `Analysis failed: An unknown error occurred` });
  }
}

export async function getTodaySummary(req: Request, res: Response) {
  const { date } = req.query;
  const userId = req.user!.id;

  let target: Date;
  let nextDay: Date;

  if (date) {
    try {
      target = new Date(date as string);
      target.setUTCHours(0, 0, 0, 0);
      nextDay = new Date(target);
      nextDay.setDate(nextDay.getDate() + 1);
    } catch {
      target = new Date();
      target.setUTCHours(0, 0, 0, 0);
      nextDay = new Date(target);
      nextDay.setDate(nextDay.getDate() + 1);
    }
  } else {
    target = new Date();
    target.setUTCHours(0, 0, 0, 0);
    nextDay = new Date(target);
    nextDay.setDate(nextDay.getDate() + 1);
  }

  const meals = await prisma.meal.findMany({
    where: {
      userId,
      loggedAt: {
        gte: target,
        lt: nextDay,
      },
    },
  });

  const totals = meals.reduce(
    (acc, m) => ({
      calories: (acc.calories || 0) + (m.calories || 0),
      protein: (acc.protein || 0) + (m.protein || 0),
      carbs: (acc.carbs || 0) + (m.carbs || 0),
      fats: (acc.fats || 0) + (m.fats || 0),
    }),
    {} as Record<string, number>
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
  });
}

export async function saveMeal(req: Request, res: Response) {
  const parseResult = mealSaveSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ detail: parseResult.error.errors });
  }

  const userId = req.user!.id;
  const data = parseResult.data;

  const loggedAt = data.logged_at ? new Date(data.logged_at) : new Date();

  const meal = await prisma.meal.create({
    data: {
      userId,
      foodName: data.food_name,
      calories: data.calories,
      protein: data.protein,
      carbs: data.carbs,
      fats: data.fats,
      fiber: data.fiber,
      healthScore: data.health_score,
      quantityGrams: data.quantity_grams,
      ingredients: data.ingredients,
      mealDescription: data.meal_description,
      mealType: data.meal_type,
      imageBase64: data.image_base64,
      loggedAt,
    },
  });

  return res.json({
    id: String(meal.id),
    food_name: meal.foodName,
    calories: meal.calories,
    protein: meal.protein,
    carbs: meal.carbs,
    fats: meal.fats,
    fiber: meal.fiber,
    health_score: meal.healthScore,
    quantity_grams: meal.quantityGrams,
    ingredients: meal.ingredients,
    meal_description: meal.mealDescription,
    meal_type: meal.mealType,
    logged_at: meal.loggedAt?.toISOString(),
  });
}

export async function getMeals(req: Request, res: Response) {
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

  const meals = await prisma.meal.findMany({
    where,
    orderBy: { loggedAt: "desc" },
    take: 100,
  });

  return res.json(
    meals.map((m) => ({
      id: String(m.id),
      food_name: m.foodName,
      calories: m.calories,
      protein: m.protein,
      carbs: m.carbs,
      fats: m.fats,
      fiber: m.fiber,
      health_score: m.healthScore,
      quantity_grams: m.quantityGrams,
      meal_type: m.mealType,
      meal_description: m.mealDescription,
      ingredients: m.ingredients,
      image_base64: m.imageBase64,
      logged_at: m.loggedAt?.toISOString(),
    }))
  );
}

export async function getMealDetail(req: Request, res: Response) {
  const { mealId } = req.params;
  const userId = req.user!.id;

  const mId = parseInt(mealId, 10);
  if (isNaN(mId)) {
    return res.status(400).json({ detail: "Invalid meal ID format" });
  }

  const meal = await prisma.meal.findFirst({
    where: { id: mId, userId },
  });

  if (!meal) {
    return res.status(404).json({ detail: "Meal not found" });
  }

  return res.json({
    id: String(meal.id),
    food_name: meal.foodName,
    calories: meal.calories,
    protein: meal.protein,
    carbs: meal.carbs,
    fats: meal.fats,
    fiber: meal.fiber,
    health_score: meal.healthScore,
    quantity_grams: meal.quantityGrams,
    meal_type: meal.mealType,
    meal_description: meal.mealDescription,
    ingredients: meal.ingredients,
    image_base64: meal.imageBase64,
    logged_at: meal.loggedAt?.toISOString(),
    created_at: meal.createdAt.toISOString(),
  });
}

export async function updateMeal(req: Request, res: Response) {
  const { mealId } = req.params;
  const userId = req.user!.id;

  const mId = parseInt(mealId, 10);
  if (isNaN(mId)) {
    return res.status(400).json({ detail: "Invalid meal ID format" });
  }

  const parseResult = mealUpdateSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ detail: parseResult.error.errors });
  }

  const data = parseResult.data;

  const existing = await prisma.meal.findFirst({
    where: { id: mId, userId },
  });

  if (!existing) {
    return res.status(404).json({ detail: "Meal not found" });
  }

  const updateData: Record<string, unknown> = {};
  if (data.food_name !== undefined) updateData.foodName = data.food_name;
  if (data.quantity_grams !== undefined) updateData.quantityGrams = data.quantity_grams;
  if (data.calories !== undefined) updateData.calories = data.calories;
  if (data.protein !== undefined) updateData.protein = data.protein;
  if (data.carbs !== undefined) updateData.carbs = data.carbs;
  if (data.fats !== undefined) updateData.fats = data.fats;
  if (data.fiber !== undefined) updateData.fiber = data.fiber;

  await prisma.meal.update({
    where: { id: mId },
    data: updateData,
  });

  return res.json({ message: "Meal updated", ...updateData });
}

export async function deleteMeal(req: Request, res: Response) {
  const { mealId } = req.params;
  const userId = req.user!.id;

  const mId = parseInt(mealId, 10);
  if (isNaN(mId)) {
    return res.status(400).json({ detail: "Invalid meal ID format" });
  }

  const existing = await prisma.meal.findFirst({
    where: { id: mId, userId },
  });

  if (!existing) {
    return res.status(404).json({ detail: "Meal not found" });
  }

  await prisma.meal.delete({
    where: { id: mId },
  });

  return res.json({ message: "Meal deleted" });
}

export function registerMealRoutes(app: import("express").Express) {
  app.post("/api/meals/analyze", authMiddleware, analyzeMeal);
  app.get("/api/meals/today-summary", authMiddleware, getTodaySummary);
  app.post("/api/meals", authMiddleware, saveMeal);
  app.get("/api/meals", authMiddleware, getMeals);
  app.get("/api/meals/:mealId", authMiddleware, getMealDetail);
  app.put("/api/meals/:mealId", authMiddleware, updateMeal);
  app.delete("/api/meals/:mealId", authMiddleware, deleteMeal);
}