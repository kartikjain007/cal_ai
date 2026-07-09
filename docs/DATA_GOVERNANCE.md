# Data Governance — Meal & Activity Logging

This document is the data governance reference linked from every meal analysis
response (`ai_disclosure.data_governance_doc` in `POST /api/meals/analyze`),
and applies to logged activity data more broadly. It covers the data that
flows through meal logging (images submitted for analysis, the AI-estimated
nutrition values returned, and the meal records users save) and through
activity logging (water intake and exercise entries).

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

## Water logging data quality controls

Water intake is user-entered, not AI-estimated, so the controls target
data-entry errors rather than model hallucination
(`server/src/utils/validation.ts`, `waterLogSchema`; `server/src/routes/activities.ts`):

- **Single-entry plausibility ceiling** — an individual `amount_ml` entry
  above `MAX_SINGLE_WATER_LOG_ML` (5000ml) is rejected outright at the
  schema level. This catches unit-entry mistakes (e.g. oz typed into an ml
  field) before they're stored at all.
- **Daily-total anomaly check** — on each save, `saveWater` sums the day's
  existing entries and projects the new total. If the projected total
  exceeds `MAX_DAILY_WATER_ML` (15000ml), the entry is **not rejected** —
  it's stored with `flaggedForReview: true` so implausible cumulative
  intake is auditable rather than silently accepted as fact or silently
  dropped.
- **Future-dated entries rejected** — `logged_at` cannot be more than 5
  minutes in the future (clock-skew tolerance), preventing obviously invalid
  timestamps from entering the dataset.

## Exercise logging data quality controls

Exercise entries are user-entered, not AI-estimated — the same rationale as
water logging applies (`server/src/utils/validation.ts`, `exerciseLogSchema`
and `validateExerciseEstimate()`; `server/src/routes/activities.ts`):

- **`exercise_name` bounds** — must be non-empty and under 200 characters,
  rejected outright at the schema level.
- **Single-entry duration ceiling** — an individual `duration_minutes` entry
  above `MAX_SINGLE_EXERCISE_DURATION_MINUTES` (600, i.e. 10 hours) is
  rejected outright. This catches unit-entry mistakes (e.g. hours typed into
  a minutes field) before they're stored at all.
- **Implausible calorie-burn-rate check** — `validateExerciseEstimate()`
  flags (does not reject) entries where `calories_burned / duration_minutes`
  exceeds `MAX_CALORIES_BURNED_PER_MINUTE` (25 kcal/min), a rough ceiling
  even elite endurance athletes rarely sustain. Mirrors the meal estimate's
  implausible-calorie-density check.
- **Daily-total anomaly check** — on each save, `saveExercise` sums the
  day's existing `duration_minutes` and projects the new total. If it
  exceeds `MAX_DAILY_EXERCISE_MINUTES` (720, i.e. 12 hours), the entry is
  **not rejected** — it's stored with `flaggedForReview: true`, mirroring
  the water daily-total check.
- **Future-dated entries rejected** — same 5-minute clock-skew tolerance as
  water logging.

Any of the above flag conditions sets `flaggedForReview: true` on the saved
`Exercise` record, and a `exercise_log_flagged` warning is logged
server-side with the specific reason(s), so degraded-quality entries are
auditable rather than silently accepted as fact.

## Aggregate/derived data quality controls

`GET /api/meals/today-summary` sums per-meal AI estimates into daily totals.
An aggregate inherits the quality risk of every value that feeds it, so
summing silently would launder individual flagged estimates into a
seemingly-trustworthy total. To avoid that, the response includes a
`data_quality` block (`server/src/routes/meals.ts`, `getTodaySummary`) with:

- `flagged_meal_count` / `flagged_meal_ids` — how many of the meals
  contributing to the total failed a `validateMealEstimate()` plausibility
  check, so a large or 100%-calorie total built on flagged data is visibly
  suspect rather than presented as equally reliable to a clean total.
- `confidence_level: "approximate"` and a disclaimer stating the total is
  aggregated from AI estimates, not lab-measured values.
- `accuracy_metrics` — a formal, computed accuracy signal rather than a
  fixed label (Art. 15.1), produced by the shared `computeAccuracyMetrics()`
  helper (`server/src/utils/validation.ts`). Built from the `confidence`
  score Gemini returns with each meal estimate
  (`server/src/routes/meals.ts`, `analyzeMeal`), stored per-meal
  (`Meal.confidence`), and aggregated across the meals contributing to that
  day's total:
  - `avg_confidence` / `min_confidence` — mean and minimum of the
    contributing meals' model-reported confidence (0.0–1.0), rounded to 3
    decimals.
  - `confidence_threshold` — the same `CONFIDENCE_THRESHOLD` (0.5) used by
    `validateMealEstimate()` to flag low-confidence meals, exposed so a
    client can reproduce the `meals_below_confidence_threshold` count.
  - `meals_below_confidence_threshold` / `meals_scored` /
    `meals_missing_confidence` — how many contributing meals fell below
    threshold, had a confidence score at all, and (for meals saved before
    `confidence` was persisted, or via a client that omitted it) didn't.
  - `basis` — states explicitly that this is the model's *self-reported*
    confidence, not an error rate measured against a lab-verified ground
    truth: this system has no certified nutrition dataset to validate
    estimates against (see "Data provenance" above), so `avg_confidence` is
    a monitorable proxy signal, not a precision/recall or MAE-style
    accuracy metric. This scoping is stated inline rather than left
    implicit, so the metric isn't mistaken for a validated accuracy
    guarantee.
- `metadata.request_id` / `generated_at` for traceability — each summary
  response can be tied back to a specific request and point in time if a
  user disputes a total later.

A `today_summary_includes_flagged_meals` warning is logged whenever any
contributing meal is flagged, so the rate of degraded-quality summaries is
monitorable server-side, not just visible in the API response.

`GET /api/analytics/weekly` (`server/src/routes/analytics.ts`,
`getWeeklyAnalytics`) reuses the same `computeAccuracyMetrics()` helper at
two granularities, since a multi-day aggregate can hide a single bad day
inside a healthy-looking average:

- Each entry in `days[]` carries its own `accuracy_metrics` and
  `flagged_meal_count`, scoped to that day's meals only — so a
  low-confidence or heavily-flagged day is visible at the day it actually
  occurred in, not diluted into the week-wide figure.
- A top-level `data_quality.accuracy_metrics` / `flagged_meal_count`
  aggregates across every meal in the 7-day window, giving a single
  week-wide accuracy signal analogous to `today-summary`'s.

`GET /api/analytics/monthly` does not yet have this — it duplicates the
same day-bucketing logic as weekly but wasn't in scope when this was added
(see "Known limitations").

`GET /api/meals` (`server/src/routes/meals.ts`, `getMeals`) returns each
saved meal with its own `confidence` / `needs_review`, but a list of
individually-flagged records doesn't by itself show the quality of the page
as a whole. Its response was restructured from a bare array to
`{ meals, data_quality, metadata }` (a breaking change to the endpoint's
shape, with `frontend/app/(tabs)/home.tsx` updated to match) so it could
carry the same `computeAccuracyMetrics()` aggregate and `flagged_meal_count`
as today-summary/weekly, plus `metadata.request_id` for traceability. A
`meals_list_view` line is logged on every read with `request_id`,
`user_id`, `count`, and `flagged_count`.

`data_quality.training_data_provenance` on that same response restates, at
the point of use, the same scoping already established in "Data
provenance" above (Art. 10.1): this system has no in-house
training/validation/testing dataset behind these estimates, so there is no
quality/representativeness/validation-split metric for *this* system to
report — that obligation belongs to the foundation model provider. Rather
than the response being silent on training-data quality (which reads as an
unexamined gap), it states explicitly what this system does and doesn't
control, and links back to `data_governance_doc`. Not yet applied to
`today-summary` or the analytics endpoints — same rationale would apply if
extended there.

## Persisted quality signal

The `Meal` table stores `confidence` and `flaggedForReview`, and the
`WaterLog` and `Exercise` tables each store `flaggedForReview`, alongside
every saved record (see `prisma/schema.prisma`). This means data quality is
not just a one-time check at request time — flagged entries remain
queryable after the fact via `GET /api/meals`, `GET /api/activities/water`,
and `GET /api/activities/exercises` (all three return `needs_review`), so
quality regressions (e.g. a Gemini model version change producing more
implausible estimates, or a client bug causing bad water/exercise log
submissions) can be detected by monitoring the rate of flagged records over
time.

## Bias examination

This system's only AI/ML inference step is Gemini's per-meal nutrition
estimate (`POST /api/meals/analyze`) — there is no in-house trained or
fine-tuned model, and therefore no training/validation/testing dataset of
our own whose demographic or representational composition could be audited
for bias (see "Data provenance" above). Bias examination is scoped
accordingly rather than left unaddressed:

- **Meal analysis (AI-driven)** — the known limitation that "accuracy may
  be lower for mixed dishes, unfamiliar cuisines, or partially obscured
  food" (see "Known limitations" below) is this system's documented
  evidence of uneven model performance across food/cuisine categories — a
  bias-relevant signal inherited from the underlying foundation model,
  which this system does not control or retrain. It is surfaced to users
  via `ai_disclosure.limitations` on every analysis response, not hidden.
- **Water and exercise logging (user-entered, no inference)** — `amount_ml`,
  `duration_minutes`, and `calories_burned` are typed in directly by the
  user; there is no model prediction step that could encode a training-data
  bias. The plausibility checks in this document (single-entry ceilings,
  daily-total anomaly checks) are numeric range checks applied uniformly to
  every user, not learned from or conditioned on user-specific data, so
  they carry no differential-treatment risk across users. This is a
  reasoned "not applicable," not an unexamined gap.

## Automatic logging & traceability

Every request receives a unique `X-Request-Id` response header (assigned by
global middleware in `server/src/index.ts`, `req.requestId`), so any
response can be correlated back to a specific request server-side.
Endpoints that read or write logged activity/meal data additionally emit a
structured, queryable log line carrying that same identifier:

- `GET /api/activities/exercises` logs `exercises_list_view` with
  `request_id`, `user_id`, `count`, `flagged_count`, and a timestamp on
  every read (`server/src/routes/activities.ts`, `getExercises`).
- `POST /api/activities/exercises` logs `exercise_log_flagged` (with
  `request_id`) whenever a save trips a plausibility check.
- `POST /api/activities/water` logs `water_log_daily_total_anomaly`;
  `POST /api/meals/analyze` and `GET /api/meals/today-summary` log
  `meal_estimate_flagged` / `today_summary_includes_flagged_meals`
  respectively, each carrying `request_id` where available.
- `GET /api/analytics/weekly` logs `analytics_weekly_view` with
  `request_id`, `user_id`, `day_count`, and a timestamp, and echoes the same
  `request_id` / `generated_at` in a `metadata` block on the response body
  itself (`server/src/routes/analytics.ts`, `getWeeklyAnalytics`) — so an
  aggregate analytics response, not just a single-record read, can be
  correlated back to a specific request.

Together this gives every access and every flagged-quality event a durable,
correlatable audit trail — sufficient to reconstruct, for a disputed total
or a support request, which request produced a given response and whether
it involved a data-quality flag.

## Human-in-the-loop correction

Users can review and correct any AI-estimated meal value via `PUT
/api/meals/:mealId` before or after saving. User-submitted corrections are
not re-validated against the model's original estimate — a corrected value
is treated as ground truth from the person who observed the actual food.
This is the primary mechanism by which incorrect AI output is caught and
fixed in this system. Water and exercise log entries have no update
endpoint — a mis-entered value is corrected by deleting (`DELETE
/api/activities/water/:logId` or `DELETE /api/activities/exercises/:logId`)
and re-submitting.

## Known limitations

- Portion size and calorie/macro values are visual estimates and may differ
  meaningfully from a lab-measured value.
- Not validated for medical, clinical, or allergen-safety decisions.
- Accuracy may be lower for mixed dishes, unfamiliar cuisines, or partially
  obscured food.
- Not cross-checked against a certified nutrition database (e.g. USDA
  FoodData Central).
- Exercise `calories_burned` is user-entered (often from a third-party
  fitness tracker or a rough personal estimate), not independently measured
  by this system — plausibility checks catch obviously implausible values
  but cannot verify accuracy.
- `GET /api/analytics/monthly` does not yet expose `accuracy_metrics` or
  `metadata.request_id` — only `today-summary` and the weekly endpoint do.

## Intended use

General wellness / self-tracking reference only — not a certified nutrition
or medical measurement.

## Instructions for use — `GET /api/meals/today-summary`

This endpoint aggregates per-meal AI estimates into a daily total, which is
also returned inline as `instructions_for_use` on every response
(`server/src/routes/meals.ts`, `getTodaySummary`). This section is the
durable reference that field links back to.

- **What the output represents**: `total_calories`/`total_protein`/
  `total_carbs`/`total_fats` are the sum of AI-estimated per-meal values for
  the queried day — not a lab-measured total. Treat them as directional
  guidance against `goal_*` (e.g. "roughly on track"), not a precise figure.
- **How to read `goal_*`**: these reflect the user's current profile
  settings and may be stale if the user hasn't updated their goals recently.
- **How to read `data_quality`**: if `flagged_meal_count > 0`, at least one
  contributing meal failed a plausibility check (see "Output data quality
  controls" above). Review the meals in `flagged_meal_ids` via `GET
  /api/meals/:mealId` before treating the total as reliable.
- **How to read `data_quality.accuracy_metrics`**: `avg_confidence` /
  `min_confidence` summarize the AI's own confidence in the meals behind
  this total, not a measured error rate — see `accuracy_metrics.basis` in
  the response and "Aggregate/derived data quality controls" above. A low
  `avg_confidence` or nonzero `meals_below_confidence_threshold` is a
  prompt to review the flagged meals, not a quantified margin of error.
- **What action to take on a suspect total**: correct the underlying meal via
  `PUT /api/meals/:mealId` — there is no automated correction, a human must
  review and edit. The total updates on the next request once corrected.
- **What's excluded**: `meal_count` and the totals only include saved meals;
  an analysis the user never saved via `POST /api/meals` does not contribute.
- **Not intended for**: clinical dosing/titration decisions, regulatory
  nutrition reporting, or any use where a precise (not approximate) daily
  total is required.
