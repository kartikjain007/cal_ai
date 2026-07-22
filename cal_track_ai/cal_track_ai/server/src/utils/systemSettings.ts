import { prisma } from "./prisma";

// Human-oversight kill-switch (Art. 14(2)) for the AI meal-analysis
// pipeline. Absent a row, analysis is enabled by default — the switch is an
// override an admin can flip to *stop* the system, not an opt-in gate.
const AI_ANALYSIS_KEY = "ai_meal_analysis_enabled";

export interface AiAnalysisStatus {
  enabled: boolean;
  updatedByUserId: number | null;
  updatedAt: string | null;
}

export async function getAiAnalysisStatus(): Promise<AiAnalysisStatus> {
  const row = await prisma.systemSetting.findUnique({ where: { key: AI_ANALYSIS_KEY } });
  if (!row) {
    return { enabled: true, updatedByUserId: null, updatedAt: null };
  }
  return {
    enabled: row.value === "true",
    updatedByUserId: row.updatedByUserId,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function setAiAnalysisEnabled(
  enabled: boolean,
  adminUserId: number
): Promise<AiAnalysisStatus> {
  const row = await prisma.systemSetting.upsert({
    where: { key: AI_ANALYSIS_KEY },
    create: { key: AI_ANALYSIS_KEY, value: String(enabled), updatedByUserId: adminUserId },
    update: { value: String(enabled), updatedByUserId: adminUserId },
  });
  return {
    enabled: row.value === "true",
    updatedByUserId: row.updatedByUserId,
    updatedAt: row.updatedAt.toISOString(),
  };
}
