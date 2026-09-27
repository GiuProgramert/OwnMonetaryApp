CREATE TABLE "public"."debts" (
  "id"                        uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "name"                      text                     NOT NULL,
  "kind"                      text                     NOT NULL,
  "amount_mode"               text                     NOT NULL,
  "amount"                    numeric(15,2)            NOT NULL,
  "movement_type_id"          uuid                     NOT NULL,
  "first_due_date"            date                     NOT NULL,
  "total_installments"        integer,
  "initial_paid_installments" integer                  NOT NULL DEFAULT 0,
  "is_finished"               boolean                  NOT NULL DEFAULT false,
  "created_at"                timestamp with time zone DEFAULT now(),
  "updated_at"                timestamp with time zone DEFAULT now(),
  CONSTRAINT "debts_amount_check" CHECK ((amount > (0)::numeric)),
  CONSTRAINT "debts_amount_mode_check" CHECK ((amount_mode = ANY (ARRAY['fixed'::text, 'variable'::text]))),
  CONSTRAINT "debts_installments_check"
    CHECK
    ((((kind = 'service'::text) AND (total_installments IS NULL) AND (initial_paid_installments = 0)) OR ((kind = 'installments'::text) AND (total_installments > 0) AND
    (initial_paid_installments >= 0) AND (initial_paid_installments < total_installments)))),
  CONSTRAINT "debts_kind_check" CHECK ((kind = ANY (ARRAY['service'::text, 'installments'::text]))),
  CONSTRAINT "debts_pkey" PRIMARY KEY (id),
  CONSTRAINT "debts_movement_type_id_fkey" FOREIGN KEY (movement_type_id) REFERENCES public.movement_types(id) ON DELETE RESTRICT,
  "user_id"                   uuid                     NOT NULL DEFAULT auth.uid(),
  CONSTRAINT "debts_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id)
);

ALTER TABLE "public"."debts"
  ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trigger_debts_updated_at
  BEFORE UPDATE ON public.debts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."debts" TO "anon", "authenticated", "postgres", "service_role";

CREATE INDEX idx_debts_user ON public.debts USING btree (user_id);

CREATE POLICY "Users can create own debts" ON "public"."debts"
  FOR INSERT
  TO "authenticated"
  WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)));

CREATE POLICY "Users can delete own debts" ON "public"."debts"
  FOR DELETE
  TO "authenticated"
  USING ((user_id = ( SELECT auth.uid() AS uid)));

CREATE POLICY "Users can update own debts" ON "public"."debts"
  FOR UPDATE
  TO "authenticated"
  USING ((user_id = ( SELECT auth.uid() AS uid)));

CREATE POLICY "Users can view own debts" ON "public"."debts"
  FOR SELECT
  TO "authenticated"
  USING ((user_id = ( SELECT auth.uid() AS uid)));
