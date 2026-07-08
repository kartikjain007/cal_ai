# Data Governance — Meal Analysis & Logging

This document is the data governance reference linked from every meal analysis
response (`ai_disclosure.data_governance_doc` in `POST /api/meals/analyze`).
It covers the data that flows through meal logging: images submitted for
analysis, the AI-estimated nutrition values returned, and the meal records
users save.

## Data provenance

Nutrition estimates are produced by a third-party foundation model (Google
Gemini, model configured via `GEMINI_MODEL`). This system does not train,
fine-tune, or curate a training dataset of its own — there is no in-house
model to govern the training/validation/testing split of. The data quality
obligations below are therefore scoped to the data this system *does*
control: what is sent to the model, what is done with its output, and what
is persisted.

## Input data quality controls

- `image_base64` submitted to `/api/meals/analyze` is validated before being
  sent to the model: it must be non-empty, under a maximum size, and either a
  `data:image/...;base64,` URI or raw base64 (`server/src/utils/validation.ts`,
  `mealAnalyzeSchema`). This rejects malformed or abusive uploads before they
  reach the model.

## Output data quality controls

Every AI-produced nutrition estimate is passed through
`validateMealEstimate()` (`server/src/utils/validation.ts`) before it is
returned to the client and again before it is persisted. This checks for:

- **Low model confidence** — flagged when the model's own confidence score
  falls below `CONFIDENCE_THRESHOLD` (0.5).
- **Negative values** — calories/protein/carbs/fats cannot be negative.
- **Implausible calorie density** — calories-per-gram above the physical
  ceiling for food (~9 kcal/g, pure fat) is flagged as a likely hallucination
  or unit error.
- **Macro/calorie mismatch** — if protein/carb/fat grams don't add up to the
  stated calorie count within a 35% tolerance, the estimate is flagged as
  internally inconsistent.

Estimates that fail any of these checks are **not discarded** — they are
returned/stored with `needs_review: true` and a machine-readable
`flag_reasons` list, so the failure mode is auditable rather than silently
hidden. This mirrors the daily-total anomaly check already applied to water
log entries (`MAX_DAILY_WATER_ML` in `server/src/routes/activities.ts`).

## Persisted quality signal

The `Meal` table stores `confidence` and `flaggedForReview` alongside every
saved meal (see `prisma/schema.prisma`). This means data quality is not just
a one-time check at request time — flagged entries remain queryable after
the fact, so quality regressions in model output (e.g. a Gemini model
version change producing more implausible estimates) can be detected by
monitoring the rate of `flaggedForReview = true` records over time.

## Human-in-the-loop correction

Users can review and correct any AI-estimated value via `PUT
/api/meals/:mealId` before or after saving. User-submitted corrections are
not re-validated against the model's original estimate — a corrected value
is treated as ground truth from the person who observed the actual food.
This is the primary mechanism by which incorrect AI output is caught and
fixed in this system.

## Known limitations

- Portion size and calorie/macro values are visual estimates and may differ
  meaningfully from a lab-measured value.
- Not validated for medical, clinical, or allergen-safety decisions.
- Accuracy may be lower for mixed dishes, unfamiliar cuisines, or partially
  obscured food.
- Not cross-checked against a certified nutrition database (e.g. USDA
  FoodData Central).

## Intended use

General wellness / self-tracking reference only — not a certified nutrition
or medical measurement.
