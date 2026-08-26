-- Identity columns move from text to uuid, matching neon_auth.user.id, which
-- Managed Better Auth creates as a real uuid-keyed table in this database. The
-- spec had said TEXT, describing the older Stack Auth users_sync mirror that
-- does not exist here.
--
-- Hand-written, because drizzle-kit generated a bare `SET DATA TYPE uuid` with
-- no USING clause. Postgres does not cast text to uuid implicitly, so every one
-- of those statements fails - and drizzle-kit exited 1 without printing the
-- error, which is exactly the kind of silent failure the branch-first rule is
-- meant to catch.
--
-- The foreign keys have to come off first: the type of a referenced primary key
-- cannot change while constraints point at it. They are recreated identically
-- at the end, still ON DELETE CASCADE within our own schema.

ALTER TABLE "accounts"             DROP CONSTRAINT "accounts_user_id_profiles_id_fk";--> statement-breakpoint
ALTER TABLE "achievements"         DROP CONSTRAINT "achievements_user_id_profiles_id_fk";--> statement-breakpoint
ALTER TABLE "api_keys"             DROP CONSTRAINT "api_keys_user_id_profiles_id_fk";--> statement-breakpoint
ALTER TABLE "budgets"              DROP CONSTRAINT "budgets_user_id_profiles_id_fk";--> statement-breakpoint
ALTER TABLE "categories"           DROP CONSTRAINT "categories_user_id_profiles_id_fk";--> statement-breakpoint
ALTER TABLE "categorization_rules" DROP CONSTRAINT "categorization_rules_user_id_profiles_id_fk";--> statement-breakpoint
ALTER TABLE "ingestion_failures"   DROP CONSTRAINT "ingestion_failures_user_id_profiles_id_fk";--> statement-breakpoint
ALTER TABLE "transactions"         DROP CONSTRAINT "transactions_user_id_profiles_id_fk";--> statement-breakpoint

ALTER TABLE "profiles"             ALTER COLUMN "id"      SET DATA TYPE uuid USING "id"::uuid;--> statement-breakpoint
ALTER TABLE "accounts"             ALTER COLUMN "user_id" SET DATA TYPE uuid USING "user_id"::uuid;--> statement-breakpoint
ALTER TABLE "achievements"         ALTER COLUMN "user_id" SET DATA TYPE uuid USING "user_id"::uuid;--> statement-breakpoint
ALTER TABLE "api_keys"             ALTER COLUMN "user_id" SET DATA TYPE uuid USING "user_id"::uuid;--> statement-breakpoint
ALTER TABLE "budgets"              ALTER COLUMN "user_id" SET DATA TYPE uuid USING "user_id"::uuid;--> statement-breakpoint
ALTER TABLE "categories"           ALTER COLUMN "user_id" SET DATA TYPE uuid USING "user_id"::uuid;--> statement-breakpoint
ALTER TABLE "categorization_rules" ALTER COLUMN "user_id" SET DATA TYPE uuid USING "user_id"::uuid;--> statement-breakpoint
ALTER TABLE "ingestion_failures"   ALTER COLUMN "user_id" SET DATA TYPE uuid USING "user_id"::uuid;--> statement-breakpoint
ALTER TABLE "transactions"         ALTER COLUMN "user_id" SET DATA TYPE uuid USING "user_id"::uuid;--> statement-breakpoint

ALTER TABLE "accounts"             ADD CONSTRAINT "accounts_user_id_profiles_id_fk"             FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade;--> statement-breakpoint
ALTER TABLE "achievements"         ADD CONSTRAINT "achievements_user_id_profiles_id_fk"         FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade;--> statement-breakpoint
ALTER TABLE "api_keys"             ADD CONSTRAINT "api_keys_user_id_profiles_id_fk"             FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade;--> statement-breakpoint
ALTER TABLE "budgets"              ADD CONSTRAINT "budgets_user_id_profiles_id_fk"              FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade;--> statement-breakpoint
ALTER TABLE "categories"           ADD CONSTRAINT "categories_user_id_profiles_id_fk"           FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade;--> statement-breakpoint
ALTER TABLE "categorization_rules" ADD CONSTRAINT "categorization_rules_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade;--> statement-breakpoint
ALTER TABLE "ingestion_failures"   ADD CONSTRAINT "ingestion_failures_user_id_profiles_id_fk"   FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade;--> statement-breakpoint
ALTER TABLE "transactions"         ADD CONSTRAINT "transactions_user_id_profiles_id_fk"         FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade;
