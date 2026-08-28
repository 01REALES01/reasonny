CREATE TABLE "telemetry_events" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"user_id" uuid NOT NULL,
	"metric" varchar(40) NOT NULL,
	"value_scaled" bigint NOT NULL,
	"rating" varchar(20),
	"route" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "telemetry_metric_check" CHECK ("telemetry_events"."metric" IN ('LCP','INP','CLS','FCP','TTFB','manual_entry_duration','dashboard_query_duration')),
	CONSTRAINT "telemetry_value_check" CHECK ("telemetry_events"."value_scaled" >= 0),
	CONSTRAINT "telemetry_rating_check" CHECK ("telemetry_events"."rating" IS NULL OR "telemetry_events"."rating" IN ('good','needs-improvement','poor'))
);
--> statement-breakpoint
ALTER TABLE "telemetry_events" ADD CONSTRAINT "telemetry_events_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_telemetry_user_metric_time" ON "telemetry_events" USING btree ("user_id","metric","created_at" DESC NULLS LAST);--> statement-breakpoint

-- ── Row Level Security ──────────────────────────────────────────────────────
-- Same posture as 0001: enabled as defence in depth, policies deferred to
-- phase 7 with pg_session_jwt. The repository layer is what isolates today.
ALTER TABLE public.telemetry_events ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

-- Closes a gap in 0001, which enabled RLS on eight of the nine tables and
-- silently skipped this one. It holds raw webhook payloads - the most
-- sensitive rows in the schema after transactions themselves, because a failed
-- ingestion keeps the entire unparsed body. Left as it was, phase 7 would have
-- added policies to every table but this, and the omission would have looked
-- deliberate to whoever read it next.
ALTER TABLE public.ingestion_failures ENABLE ROW LEVEL SECURITY;
