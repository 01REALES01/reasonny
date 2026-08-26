CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"user_id" text NOT NULL,
	"name" varchar(100) NOT NULL,
	"type" varchar(30) NOT NULL,
	"currency" char(3) DEFAULT 'COP' NOT NULL,
	"initial_balance_minor" bigint DEFAULT 0 NOT NULL,
	"color" varchar(20) DEFAULT '#3B82F6' NOT NULL,
	"is_archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_accounts_name" UNIQUE("user_id","name"),
	CONSTRAINT "accounts_type_check" CHECK ("accounts"."type" IN ('checking','credit_card','savings','cash','digital_wallet'))
);
--> statement-breakpoint
CREATE TABLE "achievements" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"user_id" text NOT NULL,
	"code" varchar(50) NOT NULL,
	"period_key" varchar(10),
	"earned_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_achievement" UNIQUE NULLS NOT DISTINCT("user_id","code","period_key")
);
--> statement-breakpoint
CREATE TABLE "api_keys" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"user_id" text NOT NULL,
	"name" varchar(60) NOT NULL,
	"key_hash" char(64) NOT NULL,
	"key_prefix" varchar(16) NOT NULL,
	"last_used_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "api_keys_key_hash_unique" UNIQUE("key_hash")
);
--> statement-breakpoint
CREATE TABLE "budgets" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"user_id" text NOT NULL,
	"category_id" uuid NOT NULL,
	"period_start" date NOT NULL,
	"amount_minor" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_budget" UNIQUE("user_id","category_id","period_start"),
	CONSTRAINT "budgets_amount_check" CHECK ("budgets"."amount_minor" >= 0)
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"user_id" text NOT NULL,
	"name" varchar(80) NOT NULL,
	"icon" varchar(50) DEFAULT 'Tag' NOT NULL,
	"color" varchar(20) DEFAULT '#6B7280' NOT NULL,
	"type" varchar(10) NOT NULL,
	"created_from_seed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_categories" UNIQUE("user_id","name","type"),
	CONSTRAINT "categories_type_check" CHECK ("categories"."type" IN ('expense','income'))
);
--> statement-breakpoint
CREATE TABLE "categorization_rules" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"user_id" text NOT NULL,
	"category_id" uuid NOT NULL,
	"merchant_pattern" varchar(255) NOT NULL,
	"is_regex" boolean DEFAULT false NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"hit_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ingestion_failures" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"user_id" text,
	"source" varchar(30) NOT NULL,
	"raw_payload" jsonb NOT NULL,
	"error" text NOT NULL,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"full_name" text,
	"base_currency" char(3) DEFAULT 'COP' NOT NULL,
	"timezone" text DEFAULT 'America/Bogota' NOT NULL,
	"telegram_chat_id" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "profiles_telegram_chat_id_unique" UNIQUE("telegram_chat_id")
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"user_id" text NOT NULL,
	"account_id" uuid,
	"category_id" uuid,
	"amount_minor" bigint NOT NULL,
	"currency" char(3) NOT NULL,
	"type" varchar(10) NOT NULL,
	"status" varchar(20) DEFAULT 'confirmed' NOT NULL,
	"merchant" varchar(255) NOT NULL,
	"merchant_normalized" varchar(255),
	"note" text,
	"transaction_date" timestamp with time zone NOT NULL,
	"source" varchar(30) NOT NULL,
	"idempotency_key" uuid,
	"ocr_confidence" numeric(3, 2),
	"categorized_by" varchar(20),
	"transfer_group_id" uuid,
	"receipt_object_key" text,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "transactions_amount_check" CHECK ("transactions"."amount_minor" > 0),
	CONSTRAINT "transactions_type_check" CHECK ("transactions"."type" IN ('expense','income','transfer')),
	CONSTRAINT "transactions_status_check" CHECK ("transactions"."status" IN ('confirmed','pending_review','pending_auth','declined')),
	CONSTRAINT "transactions_merchant_check" CHECK (length(trim("transactions"."merchant")) > 0),
	CONSTRAINT "transactions_source_check" CHECK ("transactions"."source" IN ('wallet_nfc','sms_shortcut','ocr_screenshot','manual','telegram_text','csv_import')),
	CONSTRAINT "transactions_categorized_by_check" CHECK ("transactions"."categorized_by" IN ('rule_engine','telegram','shortcut_menu','manual','ocr'))
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "achievements" ADD CONSTRAINT "achievements_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categorization_rules" ADD CONSTRAINT "categorization_rules_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categorization_rules" ADD CONSTRAINT "categorization_rules_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingestion_failures" ADD CONSTRAINT "ingestion_failures_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_api_keys_user" ON "api_keys" USING btree ("user_id") WHERE "api_keys"."revoked_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_categories_user" ON "categories" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_rules_user" ON "categorization_rules" USING btree ("user_id","priority" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "idx_tx_idempotency" ON "transactions" USING btree ("user_id","idempotency_key") WHERE "transactions"."idempotency_key" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_tx_user_date" ON "transactions" USING btree ("user_id","transaction_date" DESC NULLS LAST) WHERE "transactions"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_tx_user_cat" ON "transactions" USING btree ("user_id","category_id") WHERE "transactions"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_tx_transfer" ON "transactions" USING btree ("transfer_group_id") WHERE "transactions"."transfer_group_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_tx_dedupe" ON "transactions" USING btree ("user_id","amount_minor","merchant_normalized","transaction_date") WHERE "transactions"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_tx_uncategorized" ON "transactions" USING btree ("user_id","created_at" DESC NULLS LAST) WHERE "transactions"."category_id" IS NULL AND "transactions"."deleted_at" IS NULL;