CREATE TABLE "consents" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"user_id" uuid NOT NULL,
	"policy_version" varchar(20) NOT NULL,
	"method" varchar(20) NOT NULL,
	"accepted_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_consents_user_version" UNIQUE("user_id","policy_version"),
	CONSTRAINT "consents_method_check" CHECK ("consents"."method" IN ('sign_in','gate'))
);
--> statement-breakpoint
ALTER TABLE "consents" ADD CONSTRAINT "consents_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
-- Same defence in depth as every other user table (0001): RLS on now, the
-- policies arrive in phase 7 with pg_session_jwt.
ALTER TABLE public.consents ENABLE ROW LEVEL SECURITY;
