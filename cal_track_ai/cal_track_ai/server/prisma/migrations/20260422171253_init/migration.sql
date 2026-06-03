-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "name" TEXT,
    "role" TEXT NOT NULL DEFAULT 'user',
    "daily_calories" INTEGER NOT NULL DEFAULT 2000,
    "daily_protein" INTEGER NOT NULL DEFAULT 150,
    "daily_carbs" INTEGER NOT NULL DEFAULT 250,
    "daily_fats" INTEGER NOT NULL DEFAULT 65,
    "age" INTEGER,
    "height_cm" DOUBLE PRECISION,
    "current_weight_kg" DOUBLE PRECISION,
    "target_weight_kg" DOUBLE PRECISION,
    "goalType" TEXT,
    "weekly_pace_kg" DOUBLE PRECISION,
    "target_date" TEXT,
    "diet_type" TEXT,
    "onboarding_completed" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meals" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "food_name" TEXT,
    "calories" INTEGER,
    "protein" DOUBLE PRECISION,
    "carbs" DOUBLE PRECISION,
    "fats" DOUBLE PRECISION,
    "fiber" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "health_score" INTEGER NOT NULL DEFAULT 5,
    "quantity_grams" INTEGER NOT NULL DEFAULT 100,
    "ingredients" JSONB NOT NULL DEFAULT '[]',
    "meal_description" TEXT,
    "meal_type" TEXT NOT NULL DEFAULT 'snack',
    "image_base64" TEXT,
    "logged_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "meals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "water_logs" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "amount_ml" INTEGER NOT NULL,
    "logged_at" TIMESTAMPTZ NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "water_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exercises" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "exercise_name" TEXT NOT NULL,
    "duration_minutes" INTEGER NOT NULL,
    "calories_burned" INTEGER NOT NULL,
    "logged_at" TIMESTAMPTZ NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exercises_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "meals_user_id_idx" ON "meals"("user_id");

-- CreateIndex
CREATE INDEX "meals_logged_at_idx" ON "meals"("logged_at");

-- CreateIndex
CREATE INDEX "water_logs_user_id_idx" ON "water_logs"("user_id");

-- CreateIndex
CREATE INDEX "water_logs_logged_at_idx" ON "water_logs"("logged_at");

-- CreateIndex
CREATE INDEX "exercises_user_id_idx" ON "exercises"("user_id");

-- CreateIndex
CREATE INDEX "exercises_logged_at_idx" ON "exercises"("logged_at");

-- AddForeignKey
ALTER TABLE "meals" ADD CONSTRAINT "meals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "water_logs" ADD CONSTRAINT "water_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exercises" ADD CONSTRAINT "exercises_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
