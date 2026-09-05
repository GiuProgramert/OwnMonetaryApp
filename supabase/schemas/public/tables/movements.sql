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
  CONSTRAINT "movements_account_id_fkey" FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE CASCADE,
  CONSTRAINT "movements_amount_check" CHECK ((amount > (0)::numeric)),
  CONSTRAINT "movements_movement_type_id_fkey" FOREIGN KEY (movement_type_id) REFERENCES public.movement_types(id) ON DELETE RESTRICT,
  CONSTRAINT "movements_pkey" PRIMARY KEY (id),
  CONSTRAINT "movements_type_check" CHECK (((type)::text = ANY ((ARRAY['credit'::character varying, 'debit'::character varying])::text[])))
);

ALTER TABLE "public"."movements"
  ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_movements_account ON public.movements USING btree (account_id);

CREATE INDEX idx_movements_date ON public.movements USING btree (date);

CREATE INDEX idx_movements_type ON public.movements USING btree (movement_type_id);

CREATE UNIQUE INDEX movements_account_external_id_key ON public.movements USING btree (account_id, external_id);

CREATE TRIGGER trigger_movements_updated_at
  BEFORE UPDATE ON public.movements
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER trigger_update_account_balance
  AFTER INSERT OR DELETE OR UPDATE ON public.movements
  FOR EACH ROW
  EXECUTE FUNCTION public.update_account_balance();

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."movements" TO "anon", "authenticated", "postgres", "service_role";

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
