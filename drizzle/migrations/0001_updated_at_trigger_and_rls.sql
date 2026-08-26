-- Everything Drizzle cannot express in the TypeScript schema.
-- This file is the practical reason versioned migrations beat `db push`:
-- `db push` diffs the TS schema against the database, and none of the below
-- appears in that schema, so it would have nowhere to come from.

-- ── updated_at ──────────────────────────────────────────────────────────────
-- Without this trigger `updated_at` is set once on INSERT and never changes
-- again, which quietly poisons every "what changed recently" query. It was a
-- real defect in the v1 schema.
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint

-- Only the three tables that actually carry updated_at.
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint

CREATE TRIGGER trg_accounts_updated BEFORE UPDATE ON public.accounts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint

CREATE TRIGGER trg_transactions_updated BEFORE UPDATE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint

-- ── Row Level Security ──────────────────────────────────────────────────────
-- Enabled as defence in depth, exactly as PROJECT_SPEC.md 3.2 frames it: the
-- primary isolation barrier is the repository layer, which takes userId as its
-- first parameter. Drizzle connects with the owning role, so these policies are
-- not what protects the data today.
--
-- The POLICIES themselves are deliberately NOT created here. They read
-- auth.user_id(), which comes from the pg_session_jwt extension, and that is
-- adopted in phase 7 together with a role that lacks BYPASSRLS. Creating a
-- policy against a function that does not exist fails at CREATE POLICY time.
-- Enabling RLS now costs nothing and means phase 7 only adds policies.
ALTER TABLE public.profiles              ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE public.accounts              ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE public.categories            ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE public.budgets               ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE public.transactions          ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE public.categorization_rules  ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE public.achievements          ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE public.api_keys              ENABLE ROW LEVEL SECURITY;
