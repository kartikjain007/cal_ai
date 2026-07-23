-- CreateTable
CREATE TABLE "log_events" (
    "id" SERIAL NOT NULL,
    "event" TEXT NOT NULL,
    "level" TEXT NOT NULL DEFAULT 'info',
    "request_id" TEXT,
    "user_id" INTEGER,
    "message" TEXT NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "log_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "log_events_request_id_idx" ON "log_events"("request_id");

-- CreateIndex
CREATE INDEX "log_events_event_idx" ON "log_events"("event");

-- CreateIndex
CREATE INDEX "log_events_created_at_idx" ON "log_events"("created_at");
