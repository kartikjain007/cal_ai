import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import request from "supertest";
import app from "../index";
import { prisma } from "../utils/prisma";
import { createAccessToken, hashPassword } from "../utils/auth";
import { pruneExpiredLogEvents, LOG_RETENTION_DAYS } from "../utils/eventLog";

// Evidence for the Art. 12.2 gap: "Configure durable log storage ... and
// document a retention period of at least 6 months ... Provide evidence
// that X-Request-Id-tagged log entries for meal_estimate_flagged,
// meal_save_flagged, water_log_daily_total_anomaly, exercise_log_flagged,
// and today_summary_includes_flagged_meals events are durably stored and
// retrievable by request ID."
//
// Each test below drives the real HTTP endpoint that emits one of the five
// named events, reads the X-Request-Id header the server assigned to that
// request, and then queries the log_events table by that exact request_id
// — proving the entry survived past the request/response cycle in durable
// storage (Postgres), not just console output, and is retrievable by the
// same identifier a client would use to reference the request.
describe("Art. 12.2 — durable log storage & retention", () => {
  let userId: number;
  let token: string;

  beforeAll(async () => {
    const email = `log-retention-test-${Date.now()}@example.com`;
    const user = await prisma.user.create({
      data: { email, passwordHash: hashPassword("test-password-123") },
    });
    userId = user.id;
    token = createAccessToken(user.id, user.email);

    // The AI meal-analysis kill-switch (Art. 14(2)) defaults to enabled
    // when no row exists, but pin it explicitly so this test doesn't
    // depend on whatever state a previous manual test session left it in.
    await prisma.systemSetting.upsert({
      where: { key: "ai_meal_analysis_enabled" },
      create: { key: "ai_meal_analysis_enabled", value: "true", updatedByUserId: userId },
      update: { value: "true", updatedByUserId: userId },
    });
  });

  afterAll(async () => {
    await prisma.logEvent.deleteMany({ where: { userId } });
    await prisma.meal.deleteMany({ where: { userId } });
    await prisma.waterLog.deleteMany({ where: { userId } });
    await prisma.exercise.deleteMany({ where: { userId } });
    await prisma.user.delete({ where: { id: userId } });
    await prisma.$disconnect();
  });

  async function findByRequestId(requestId: string | undefined, event: string) {
    expect(requestId, "response did not carry an X-Request-Id header").toBeTruthy();
    return prisma.logEvent.findMany({ where: { requestId, event } });
  }

  it("meal_save_flagged is durably stored and retrievable by request ID", async () => {
    const res = await request(app)
      .post("/api/meals")
      .set("Authorization", `Bearer ${token}`)
      .send({
        food_name: "Low confidence meal",
        calories: 200,
        protein: 10,
        carbs: 20,
        fats: 5,
        fiber: 2,
        quantity_grams: 150,
        confidence: 0.1, // below CONFIDENCE_THRESHOLD (0.5) -> flagged
      });

    expect(res.status).toBe(200);
    expect(res.body.needs_review).toBe(true);

    const requestId = res.headers["x-request-id"];
    const entries = await findByRequestId(requestId, "meal_save_flagged");

    expect(entries).toHaveLength(1);
    expect(entries[0].requestId).toBe(requestId);
    expect(entries[0].userId).toBe(userId);
    expect(entries[0].level).toBe("warn");
    expect(entries[0].message).toContain(`request_id=${requestId}`);
  });

  it("today_summary_includes_flagged_meals is durably stored and retrievable by request ID", async () => {
    // Relies on the flagged meal saved in the previous test still being
    // "today" for this user.
    const res = await request(app)
      .get("/api/meals/today-summary")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data_quality.flagged_meal_count).toBeGreaterThan(0);

    const requestId = res.headers["x-request-id"];
    const entries = await findByRequestId(requestId, "today_summary_includes_flagged_meals");

    expect(entries).toHaveLength(1);
    expect(entries[0].userId).toBe(userId);
  });

  it("water_log_daily_total_anomaly is durably stored and retrievable by request ID", async () => {
    // MAX_DAILY_WATER_ML is 15000ml; three 5000ml entries reach exactly
    // 15000 (not yet an anomaly, since the check is strictly-greater-than),
    // and a fourth pushes the running daily total over it.
    for (const amount_ml of [5000, 5000, 5000]) {
      const r = await request(app)
        .post("/api/activities/water")
        .set("Authorization", `Bearer ${token}`)
        .send({ amount_ml });
      expect(r.status).toBe(200);
    }

    const flaggedRes = await request(app)
      .post("/api/activities/water")
      .set("Authorization", `Bearer ${token}`)
      .send({ amount_ml: 1000 });

    expect(flaggedRes.status).toBe(200);
    expect(flaggedRes.body.needs_review).toBe(true);

    const requestId = flaggedRes.headers["x-request-id"];
    const entries = await findByRequestId(requestId, "water_log_daily_total_anomaly");

    expect(entries).toHaveLength(1);
    expect(entries[0].userId).toBe(userId);
  });

  it("exercise_log_flagged is durably stored and retrievable by request ID", async () => {
    const res = await request(app)
      .post("/api/activities/exercises")
      .set("Authorization", `Bearer ${token}`)
      .send({
        exercise_name: "Implausible burn rate",
        duration_minutes: 10,
        calories_burned: 1000, // 100 kcal/min, far above the 25 kcal/min ceiling
      });

    expect(res.status).toBe(200);
    expect(res.body.needs_review).toBe(true);

    const requestId = res.headers["x-request-id"];
    const entries = await findByRequestId(requestId, "exercise_log_flagged");

    expect(entries).toHaveLength(1);
    expect(entries[0].userId).toBe(userId);
  });

  it("meal_estimate_flagged is durably stored and retrievable by request ID", async () => {
    const fakeNutrition = {
      is_food: true,
      confidence: 0.2, // below CONFIDENCE_THRESHOLD -> flagged
      food_name: "Mystery Soup",
      calories: 200,
      protein: 10,
      carbs: 20,
      fats: 5,
      fiber: 2,
      health_score: 6,
      quantity_grams: 150,
      ingredients: [],
      meal_description: "test",
      assumptions: "",
    };

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      json: async () => ({
        candidates: [{ content: { parts: [{ text: JSON.stringify(fakeNutrition) }] } }],
      }),
    } as unknown as Response);

    try {
      const res = await request(app)
        .post("/api/meals/analyze")
        .set("Authorization", `Bearer ${token}`)
        .send({ image_base64: "dGVzdA==", meal_type: "snack" });

      expect(res.status).toBe(200);
      expect(res.body.needs_review).toBe(true);

      const requestId = res.headers["x-request-id"];
      const entries = await findByRequestId(requestId, "meal_estimate_flagged");

      expect(entries).toHaveLength(1);
      expect(entries[0].userId).toBe(userId);
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it("documents and enforces a retention window of at least 6 months", async () => {
    // 186 = 6 * 31, so a row is guaranteed to survive a full 6 calendar
    // months regardless of month length.
    expect(LOG_RETENTION_DAYS).toBeGreaterThanOrEqual(183);

    const oldRow = await prisma.logEvent.create({
      data: {
        event: "test_event_past_retention",
        level: "info",
        userId,
        message: "should be pruned",
        createdAt: new Date(Date.now() - (LOG_RETENTION_DAYS + 1) * 24 * 60 * 60 * 1000),
      },
    });
    const freshRow = await prisma.logEvent.create({
      data: { event: "test_event_within_retention", level: "info", userId, message: "should survive" },
    });

    await pruneExpiredLogEvents();

    const [oldStillThere, freshStillThere] = await Promise.all([
      prisma.logEvent.findUnique({ where: { id: oldRow.id } }),
      prisma.logEvent.findUnique({ where: { id: freshRow.id } }),
    ]);

    expect(oldStillThere).toBeNull();
    expect(freshStillThere).not.toBeNull();
  });
});
