ALTER TABLE "categorization_rules" ADD COLUMN "type" varchar(10) NOT NULL;--> statement-breakpoint
ALTER TABLE "categorization_rules" ADD CONSTRAINT "uq_rules_merchant" UNIQUE("user_id","merchant_pattern","type");--> statement-breakpoint
ALTER TABLE "categorization_rules" ADD CONSTRAINT "categorization_rules_type_check" CHECK ("categorization_rules"."type" IN ('expense','income'));