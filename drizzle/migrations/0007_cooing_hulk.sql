ALTER TABLE "accounts" ADD COLUMN "bank" varchar(30);--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "mask" varchar(8);--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "uq_accounts_bank_mask" UNIQUE("user_id","bank","mask");