ALTER TABLE "profiles" ADD COLUMN "location_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "home_latitude" numeric(9, 6);--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "home_longitude" numeric(9, 6);--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "latitude" numeric(9, 6);--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "longitude" numeric(9, 6);--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "location_accuracy_m" integer;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "location_source" varchar(20);--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_location_check" CHECK (("transactions"."latitude" IS NULL) = ("transactions"."longitude" IS NULL)
          AND ("transactions"."latitude" IS NULL OR ("transactions"."latitude" BETWEEN -90 AND 90))
          AND ("transactions"."longitude" IS NULL OR ("transactions"."longitude" BETWEEN -180 AND 180)));--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_location_source_check" CHECK ("transactions"."location_source" IS NULL OR "transactions"."location_source" IN ('device_pwa','shortcut','manual'));