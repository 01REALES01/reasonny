CREATE TABLE "notification_prompts" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"user_id" uuid NOT NULL,
	"transaction_id" uuid NOT NULL,
	"provider" varchar(20) NOT NULL,
	"kind" varchar(20) NOT NULL,
	"chat_id" bigint NOT NULL,
	"external_message_id" bigint NOT NULL,
	"answered_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_prompt_message" UNIQUE("provider","chat_id","external_message_id"),
	CONSTRAINT "notification_prompts_provider_check" CHECK ("notification_prompts"."provider" IN ('telegram','whatsapp')),
	CONSTRAINT "notification_prompts_kind_check" CHECK ("notification_prompts"."kind" IN ('category_pick','category_name'))
);
--> statement-breakpoint
ALTER TABLE "notification_prompts" ADD CONSTRAINT "notification_prompts_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_prompts" ADD CONSTRAINT "notification_prompts_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_prompts_user" ON "notification_prompts" USING btree ("user_id","created_at" DESC NULLS LAST);