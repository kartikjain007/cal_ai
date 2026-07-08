-- AlterTable
ALTER TABLE "meals" ADD COLUMN     "confidence" DOUBLE PRECISION,
ADD COLUMN     "flaggedForReview" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "water_logs" ADD COLUMN     "flaggedForReview" BOOLEAN NOT NULL DEFAULT false;
