import { z } from "zod";

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(1),
});

export type RegisterRequest = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export type LoginRequest = z.infer<typeof loginSchema>;

export const mealAnalyzeSchema = z.object({
  image_base64: z.string(),
  meal_type: z.string().default("snack"),
});

export type MealAnalyzeRequest = z.infer<typeof mealAnalyzeSchema>;

export const mealSaveSchema = z.object({
  food_name: z.string(),
  calories: z.number(),
  protein: z.number(),
  carbs: z.number(),
  fats: z.number(),
  fiber: z.number().default(0),
  health_score: z.number().default(5),
  ingredients: z.array(z.string()).default([]),
  meal_description: z.string().default(""),
  meal_type: z.string().default("snack"),
  quantity_grams: z.number().default(100),
  image_base64: z.string().default(""),
  logged_at: z.string().optional(),
});

export type MealSaveRequest = z.infer<typeof mealSaveSchema>;

export const mealUpdateSchema = z.object({
  food_name: z.string().optional(),
  quantity_grams: z.number().optional(),
  calories: z.number().optional(),
  protein: z.number().optional(),
  carbs: z.number().optional(),
  fats: z.number().optional(),
  fiber: z.number().optional(),
});

export type MealUpdateRequest = z.infer<typeof mealUpdateSchema>;

export const goalsUpdateSchema = z.object({
  daily_calories: z.number().default(2000),
  daily_protein: z.number().default(150),
  daily_carbs: z.number().default(250),
  daily_fats: z.number().default(65),
});

export type GoalsUpdateRequest = z.infer<typeof goalsUpdateSchema>;

export const profileUpdateSchema = z.object({
  name: z.string().optional(),
  daily_calories: z.number().optional(),
  daily_protein: z.number().optional(),
  daily_carbs: z.number().optional(),
  daily_fats: z.number().optional(),
  age: z.number().optional(),
  height_cm: z.number().optional(),
  current_weight_kg: z.number().optional(),
  target_weight_kg: z.number().optional(),
  goal_type: z.string().optional(),
  weekly_pace_kg: z.number().optional(),
  diet_type: z.string().optional(),
  onboarding_completed: z.boolean().optional(),
});

export type ProfileUpdateRequest = z.infer<typeof profileUpdateSchema>;

export const onboardingSchema = z.object({
  goal_type: z.enum(["lose", "maintain", "gain"]),
  diet_type: z.string().min(2).max(32),
  age: z.number().min(13).max(100),
  height_cm: z.number().min(100).max(250),
  current_weight_kg: z.number().min(30).max(300),
  target_weight_kg: z.number().min(30).max(300),
  weekly_pace_kg: z.number().min(0.1).max(1.5),
});

export type OnboardingRequest = z.infer<typeof onboardingSchema>;

// Physiologically implausible above this in a single entry — catches
// unit-entry errors (e.g. oz typed into an ml field) and bad client data.
const MAX_SINGLE_WATER_LOG_ML = 5000;

// Reasonable ceiling for total daily intake before an entry is treated
// as a data quality anomaly rather than accepted as fact.
export const MAX_DAILY_WATER_ML = 15000;

export const waterLogSchema = z.object({
  amount_ml: z
    .number()
    .gt(0, "amount_ml must be positive")
    .max(MAX_SINGLE_WATER_LOG_ML, `amount_ml exceeds plausible single-entry maximum of ${MAX_SINGLE_WATER_LOG_ML}ml`),
  logged_at: z
    .string()
    .datetime({ message: "logged_at must be a valid ISO 8601 timestamp" })
    .optional()
    .refine(
      (val) => !val || new Date(val).getTime() <= Date.now() + 5 * 60 * 1000, // 5 min clock-skew tolerance
      { message: "logged_at cannot be in the future" }
    ),
});


export type WaterLogRequest = z.infer<typeof waterLogSchema>;

export const exerciseLogSchema = z.object({
  exercise_name: z.string(),
  duration_minutes: z.number().gt(0),
  calories_burned: z.number().gt(0),
  logged_at: z.string().optional(),
});

export const CONFIDENCE_THRESHOLD = 0.5;

// Rough plausibility bounds — catches obviously broken model output
// before it's trusted as fact (Art. 10 output data quality control).
const MAX_CALORIES_PER_GRAM = 9; // pure fat is ~9 kcal/g, ceiling for a whole dish
const MACRO_KCAL_TOLERANCE = 0.35; // allow 35% slack vs stated calories

interface MealEstimate {
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  fiber?: number;
  quantityGrams: number;
  confidence?: number;
}

export interface ValidationResult {
  needsReview: boolean;
  reasons: string[];
}

export function validateMealEstimate(estimate: MealEstimate): ValidationResult {
  const reasons: string[] = [];

  if (estimate.confidence !== undefined && estimate.confidence < CONFIDENCE_THRESHOLD) {
    reasons.push(`low_confidence:${estimate.confidence}`);
  }

  if (estimate.calories < 0 || estimate.protein < 0 || estimate.carbs < 0 || estimate.fats < 0) {
    reasons.push("negative_value");
  }

  if (estimate.quantityGrams > 0) {
    const caloriesPerGram = estimate.calories / estimate.quantityGrams;
    if (caloriesPerGram > MAX_CALORIES_PER_GRAM) {
      reasons.push(`implausible_density:${caloriesPerGram.toFixed(2)}`);
    }
  }

  const macroCalories =
    estimate.protein * 4 + estimate.carbs * 4 + estimate.fats * 9;
  if (estimate.calories > 0) {
    const delta = Math.abs(macroCalories - estimate.calories) / estimate.calories;
    if (delta > MACRO_KCAL_TOLERANCE) {
      reasons.push(`macro_mismatch:${(delta * 100).toFixed(0)}%`);
    }
  }

  return { needsReview: reasons.length > 0, reasons };
}


export type ExerciseLogRequest = z.infer<typeof exerciseLogSchema>;
