CREATE TABLE "public"."budgets" (
  "id"               uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "movement_type_id" uuid                     NOT NULL,
  "amount"           numeric(15,2)            NOT NULL,
  "is_active"        boolean                  NOT NULL DEFAULT true,
  "created_at"       timestamp with time zone DEFAULT now(),
  "updated_at"       timestamp with time zone DEFAULT now(),
  CONSTRAINT "budgets_amount_check" CHECK ((amount > (0)::numeric)),
  CONSTRAINT "budgets_pkey" PRIMARY KEY (id),
  CONSTRAINT "budgets_movement_type_id_fkey" FOREIGN KEY (movement_type_id) REFERENCES public.movement_types(id) ON DELETE CASCADE,
  "user_id"          uuid                     NOT NULL DEFAULT auth.uid(),
  CONSTRAINT "budgets_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT "budgets_user_movement_type_key" UNIQUE (user_id, movement_type_id)
);

ALTER TABLE "public"."budgets"
  ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trigger_budgets_updated_at
  BEFORE UPDATE ON public.budgets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."budgets" TO "anon", "authenticated", "postgres", "service_role";

CREATE INDEX idx_budgets_user ON public.budgets USING btree (user_id);

CREATE POLICY "Users can create own budgets" ON "public"."budgets"
  FOR INSERT
  TO "authenticated"
  WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)));

CREATE POLICY "Users can delete own budgets" ON "public"."budgets"
  FOR DELETE
  TO "authenticated"
  USING ((user_id = ( SELECT auth.uid() AS uid)));

CREATE POLICY "Users can update own budgets" ON "public"."budgets"
  FOR UPDATE
  TO "authenticated"
  USING ((user_id = ( SELECT auth.uid() AS uid)));

CREATE POLICY "Users can view own budgets" ON "public"."budgets"
  FOR SELECT
  TO "authenticated"
  USING ((user_id = ( SELECT auth.uid() AS uid)));
