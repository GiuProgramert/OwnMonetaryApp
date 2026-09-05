-- Baseline schema migration.
--
-- Records, without executing, the state of the `public` schema as it already exists on the
-- linked remote project. Derived from the declarative export in supabase/schemas/** (produced by
-- `npm run db:pull` against the remote on 2026-09-03) plus the RPC function bodies documented in
-- docs/plans/dashboard-implementation.md (2.1-2.3), reordered here into real dependency order
-- (extensions -> schema grants -> tables -> functions -> triggers -> RLS -> policies -> grants).
--
-- This migration is registered as already applied via `supabase migration repair --status applied`
-- (plan step 3.5) and must never be pushed: every object it declares already exists remotely.

-- ============================================================================
-- Extensions
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto" SCHEMA "extensions";
COMMENT ON EXTENSION "pgcrypto" IS 'cryptographic functions';

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" SCHEMA "extensions";
COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';

-- ============================================================================
-- Schema privileges
-- ============================================================================

COMMENT ON SCHEMA "public" IS 'standard public schema';

REVOKE ALL ON SCHEMA "public" FROM PUBLIC;
GRANT USAGE ON SCHEMA "public" TO PUBLIC;

REVOKE ALL ON SCHEMA "public" FROM "anon";
GRANT USAGE ON SCHEMA "public" TO "anon";

REVOKE ALL ON SCHEMA "public" FROM "authenticated";
GRANT USAGE ON SCHEMA "public" TO "authenticated";

REVOKE ALL ON SCHEMA "public" FROM "pg_database_owner";
GRANT CREATE, USAGE ON SCHEMA "public" TO "pg_database_owner";

REVOKE ALL ON SCHEMA "public" FROM "postgres";
GRANT USAGE ON SCHEMA "public" TO "postgres";

REVOKE ALL ON SCHEMA "public" FROM "service_role";
GRANT USAGE ON SCHEMA "public" TO "service_role";

-- ============================================================================
-- Tables
-- ============================================================================

CREATE TABLE "public"."accounts" (
  "id"              uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "name"            character varying(200)   NOT NULL,
  "current_balance" numeric(15,2)            DEFAULT 0.00,
  "created_at"      timestamp with time zone DEFAULT now(),
  "updated_at"      timestamp with time zone DEFAULT now(),
  "color"           character varying(7)     NOT NULL DEFAULT '#6B7280'::character varying,
  "user_id"         uuid                     DEFAULT auth.uid(),
  CONSTRAINT "accounts_pkey" PRIMARY KEY (id),
  CONSTRAINT "check_color_format" CHECK (((color)::text ~ '^#[0-9A-Fa-f]{6}$'::text)),
  CONSTRAINT "accounts_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id)
);

ALTER TABLE "public"."accounts" ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."movement_types" (
  "id"          uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "name"        character varying(100)   NOT NULL,
  "description" text,
  "created_at"  timestamp with time zone DEFAULT now(),
  "updated_at"  timestamp with time zone DEFAULT now(),
  "color"       character varying(7)     NOT NULL DEFAULT '#6B7280'::character varying,
  CONSTRAINT "check_color_format" CHECK (((color)::text ~ '^#[0-9A-Fa-f]{6}$'::text)),
  CONSTRAINT "movement_types_name_key" UNIQUE (name),
  CONSTRAINT "movement_types_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."movement_types" ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."movements" (
  "id"               uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "account_id"       uuid                     NOT NULL,
  "movement_type_id" uuid                     NOT NULL,
  "date"             date                     NOT NULL DEFAULT CURRENT_DATE,
  "description"      text                     NOT NULL,
  "amount"           numeric(15,2)            NOT NULL,
  "type"             character varying(10)    NOT NULL,
  "created_at"       timestamp with time zone DEFAULT now(),
  "updated_at"       timestamp with time zone DEFAULT now(),
  "external_id"      text,
  CONSTRAINT "movements_pkey" PRIMARY KEY (id),
  CONSTRAINT "movements_account_id_fkey" FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE CASCADE,
  CONSTRAINT "movements_movement_type_id_fkey" FOREIGN KEY (movement_type_id) REFERENCES public.movement_types(id) ON DELETE RESTRICT,
  CONSTRAINT "movements_amount_check" CHECK ((amount > (0)::numeric)),
  CONSTRAINT "movements_type_check" CHECK (((type)::text = ANY ((ARRAY['credit'::character varying, 'debit'::character varying])::text[])))
);

ALTER TABLE "public"."movements" ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_movements_account ON public.movements USING btree (account_id);
CREATE INDEX idx_movements_date ON public.movements USING btree (date);
CREATE INDEX idx_movements_type ON public.movements USING btree (movement_type_id);
CREATE UNIQUE INDEX movements_account_external_id_key ON public.movements USING btree (account_id, external_id);

-- ============================================================================
-- Functions
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_updated_at()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_account_balance()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  AS $function$
BEGIN
  -- If INSERT or UPDATE, calculate new balance
  IF (TG_OP = 'INSERT') THEN
    UPDATE accounts
    SET current_balance = current_balance +
      CASE
        WHEN NEW.type = 'credit' THEN NEW.amount
        WHEN NEW.type = 'debit' THEN -NEW.amount
      END
    WHERE id = NEW.account_id;

  ELSIF (TG_OP = 'UPDATE') THEN
    -- Revert previous movement
    UPDATE accounts
    SET current_balance = current_balance -
      CASE
        WHEN OLD.type = 'credit' THEN OLD.amount
        WHEN OLD.type = 'debit' THEN -OLD.amount
      END
    WHERE id = OLD.account_id;

    -- Apply new movement
    UPDATE accounts
    SET current_balance = current_balance +
      CASE
        WHEN NEW.type = 'credit' THEN NEW.amount
        WHEN NEW.type = 'debit' THEN -NEW.amount
      END
    WHERE id = NEW.account_id;

  ELSIF (TG_OP = 'DELETE') THEN
    -- Revert deleted movement
    UPDATE accounts
    SET current_balance = current_balance -
      CASE
        WHEN OLD.type = 'credit' THEN OLD.amount
        WHEN OLD.type = 'debit' THEN -OLD.amount
      END
    WHERE id = OLD.account_id;

    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_expenses_by_movement_type (
  p_account_id uuid DEFAULT NULL::uuid,
  p_start_date date DEFAULT NULL::date,
  p_end_date   date DEFAULT NULL::date
)
  RETURNS TABLE (
    movement_type_id uuid,
    name             text,
    color            text,
    total            bigint
  )
  LANGUAGE sql
  STABLE
  SET search_path TO ''
  AS $function$
  select mt.id, mt.name, mt.color, sum(m.amount)::bigint as total
  from public.movements m
  join public.accounts a on a.id = m.account_id
  join public.movement_types mt on mt.id = m.movement_type_id
  where m.type = 'debit'
    and a.user_id = (select auth.uid())
    and (p_account_id is null or m.account_id = p_account_id)
    and (p_start_date is null or m.date >= p_start_date)
    and (p_end_date   is null or m.date <= p_end_date)
  group by mt.id, mt.name, mt.color
  order by total desc;
$function$;

CREATE OR REPLACE FUNCTION public.get_movements_totals (
  p_account_id       uuid DEFAULT NULL::uuid,
  p_movement_type_id uuid DEFAULT NULL::uuid,
  p_start_date       date DEFAULT NULL::date,
  p_end_date         date DEFAULT NULL::date
)
  RETURNS TABLE (
    income  bigint,
    expense bigint
  )
  LANGUAGE sql
  STABLE
  SET search_path TO ''
  AS $function$
  select
    coalesce(sum(m.amount) filter (where m.type = 'credit'), 0)::bigint as income,
    coalesce(sum(m.amount) filter (where m.type = 'debit'),  0)::bigint as expense
  from public.movements m
  join public.accounts a on a.id = m.account_id
  where a.user_id = (select auth.uid())
    and (p_account_id       is null or m.account_id       = p_account_id)
    and (p_movement_type_id is null or m.movement_type_id = p_movement_type_id)
    and (p_start_date is null or m.date >= p_start_date)
    and (p_end_date   is null or m.date <= p_end_date);
$function$;

CREATE OR REPLACE FUNCTION public.get_monthly_flow (
  p_account_id uuid DEFAULT NULL::uuid,
  p_start_date date DEFAULT NULL::date,
  p_end_date   date DEFAULT NULL::date
)
  RETURNS TABLE (
    month   date,
    income  bigint,
    expense bigint
  )
  LANGUAGE sql
  STABLE
  SET search_path TO ''
  AS $function$
  select
    date_trunc('month', m.date::timestamp)::date as month,
    coalesce(sum(m.amount) filter (where m.type = 'credit'), 0)::bigint as income,
    coalesce(sum(m.amount) filter (where m.type = 'debit'),  0)::bigint as expense
  from public.movements m
  join public.accounts a on a.id = m.account_id
  where a.user_id = (select auth.uid())
    and (p_account_id is null or m.account_id = p_account_id)
    and (p_start_date is null or m.date >= p_start_date)
    and (p_end_date   is null or m.date <= p_end_date)
  group by 1
  order by 1;
$function$;

-- ============================================================================
-- Triggers
-- ============================================================================

CREATE TRIGGER trigger_accounts_updated_at
  BEFORE UPDATE ON public.accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER trigger_movement_types_updated_at
  BEFORE UPDATE ON public.movement_types
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER trigger_movements_updated_at
  BEFORE UPDATE ON public.movements
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER trigger_update_account_balance
  AFTER INSERT OR DELETE OR UPDATE ON public.movements
  FOR EACH ROW
  EXECUTE FUNCTION public.update_account_balance();

-- ============================================================================
-- Row Level Security policies
-- ============================================================================

CREATE POLICY "Users can create in own accounts" ON "public"."accounts"
  FOR INSERT
  TO "authenticated"
  WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)));

CREATE POLICY "Users can delete own accounts" ON "public"."accounts"
  FOR DELETE
  TO PUBLIC
  USING ((auth.uid() = user_id));

CREATE POLICY "Users can update own accounts" ON "public"."accounts"
  FOR UPDATE
  TO PUBLIC
  USING ((auth.uid() = user_id));

CREATE POLICY "Users can view own accounts" ON "public"."accounts"
  FOR SELECT
  TO PUBLIC
  USING ((auth.uid() = user_id));

CREATE POLICY "movement_types_read" ON "public"."movement_types"
  FOR SELECT
  TO "authenticated"
  USING (true);

CREATE POLICY "movement_types_write" ON "public"."movement_types"
  FOR ALL
  TO "authenticated"
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete movements from own accounts" ON "public"."movements"
  FOR DELETE
  TO PUBLIC
  USING ((EXISTS ( SELECT 1
   FROM public.accounts
  WHERE ((accounts.id = movements.account_id) AND (accounts.user_id = auth.uid())))));

CREATE POLICY "Users can insert movements to own accounts" ON "public"."movements"
  FOR INSERT
  TO "authenticated"
  WITH CHECK ((EXISTS ( SELECT 1
   FROM public.accounts
  WHERE ((accounts.id = movements.account_id) AND (accounts.user_id = auth.uid())))));

CREATE POLICY "Users can update movements from own accounts" ON "public"."movements"
  FOR UPDATE
  TO PUBLIC
  USING ((EXISTS ( SELECT 1
   FROM public.accounts
  WHERE ((accounts.id = movements.account_id) AND (accounts.user_id = auth.uid())))));

CREATE POLICY "Users can view movements from own accounts" ON "public"."movements"
  FOR SELECT
  TO PUBLIC
  USING ((EXISTS ( SELECT 1
   FROM public.accounts
  WHERE ((accounts.id = movements.account_id) AND (accounts.user_id = auth.uid())))));

-- ============================================================================
-- Grants
-- ============================================================================

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."accounts" TO "anon", "authenticated", "postgres", "service_role";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."movement_types" TO "anon", "authenticated", "postgres", "service_role";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."movements" TO "anon", "authenticated", "postgres", "service_role";

GRANT EXECUTE ON FUNCTION "public"."update_updated_at"() TO PUBLIC, "anon", "authenticated", "postgres", "service_role";
GRANT EXECUTE ON FUNCTION "public"."update_account_balance"() TO PUBLIC, "anon", "authenticated", "postgres", "service_role";
GRANT EXECUTE ON FUNCTION "public"."get_expenses_by_movement_type"(uuid, date, date) TO PUBLIC, "anon", "authenticated", "postgres", "service_role";
GRANT EXECUTE ON FUNCTION "public"."get_movements_totals"(uuid, uuid, date, date) TO PUBLIC, "anon", "authenticated", "postgres", "service_role";
GRANT EXECUTE ON FUNCTION "public"."get_monthly_flow"(uuid, date, date) TO PUBLIC, "anon", "authenticated", "postgres", "service_role";

-- ============================================================================
-- Default privileges (for future objects created by role "postgres")
-- ============================================================================

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT SELECT, UPDATE, USAGE ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT SELECT, UPDATE, USAGE ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT SELECT, UPDATE, USAGE ON SEQUENCES TO "service_role";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" REVOKE ALL ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT EXECUTE ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT EXECUTE ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT EXECUTE ON FUNCTIONS TO "service_role";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLES TO "service_role";
