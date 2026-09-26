CREATE TABLE "public"."budget_periods" (
  "id"           uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "budget_id"    uuid                     NOT NULL,
  "period_month" date                     NOT NULL,
  "amount"       numeric(15,2)            NOT NULL,
  "created_at"   timestamp with time zone DEFAULT now(),
  "updated_at"   timestamp with time zone DEFAULT now(),
  CONSTRAINT "budget_periods_amount_check" CHECK ((amount > (0)::numeric)),
  CONSTRAINT "budget_periods_budget_month_key" UNIQUE (budget_id, period_month),
  CONSTRAINT "budget_periods_month_check" CHECK ((period_month = (date_trunc('month'::text, (period_month)::timestamp without time zone))::date)),
  CONSTRAINT "budget_periods_pkey" PRIMARY KEY (id),
  CONSTRAINT "budget_periods_budget_id_fkey" FOREIGN KEY (budget_id) REFERENCES public.budgets(id) ON DELETE CASCADE
);

ALTER TABLE "public"."budget_periods"
  ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_budget_periods_month ON public.budget_periods USING btree (period_month);

CREATE TRIGGER trigger_budget_periods_updated_at
  BEFORE UPDATE ON public.budget_periods
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."budget_periods" TO "anon", "authenticated", "postgres", "service_role";

CREATE POLICY "Users can create periods of own budgets" ON "public"."budget_periods"
  FOR INSERT
  TO "authenticated"
  WITH CHECK ((EXISTS ( SELECT 1
   FROM public.budgets b
  WHERE ((b.id = budget_periods.budget_id) AND (b.user_id = ( SELECT auth.uid() AS uid))))));

CREATE POLICY "Users can delete periods of own budgets" ON "public"."budget_periods"
  FOR DELETE
  TO "authenticated"
  USING ((EXISTS ( SELECT 1
   FROM public.budgets b
  WHERE ((b.id = budget_periods.budget_id) AND (b.user_id = ( SELECT auth.uid() AS uid))))));

CREATE POLICY "Users can update periods of own budgets" ON "public"."budget_periods"
  FOR UPDATE
  TO "authenticated"
  USING ((EXISTS ( SELECT 1
   FROM public.budgets b
  WHERE ((b.id = budget_periods.budget_id) AND (b.user_id = ( SELECT auth.uid() AS uid))))));

CREATE POLICY "Users can view periods of own budgets" ON "public"."budget_periods"
  FOR SELECT
  TO "authenticated"
  USING ((EXISTS ( SELECT 1
   FROM public.budgets b
  WHERE ((b.id = budget_periods.budget_id) AND (b.user_id = ( SELECT auth.uid() AS uid))))));
