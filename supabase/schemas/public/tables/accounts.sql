CREATE TABLE "public"."accounts" (
  "id"              uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "name"            character varying(200)   NOT NULL,
  "current_balance" numeric(15,2)            DEFAULT 0.00,
  "created_at"      timestamp with time zone DEFAULT now(),
  "updated_at"      timestamp with time zone DEFAULT now(),
  "color"           character varying(7)     NOT NULL DEFAULT '#6B7280'::character varying,
  CONSTRAINT "accounts_pkey" PRIMARY KEY (id),
  CONSTRAINT "check_color_format" CHECK (((color)::text ~ '^#[0-9A-Fa-f]{6}$'::text)),
  "user_id"         uuid                     DEFAULT auth.uid(),
  CONSTRAINT "accounts_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id)
);

ALTER TABLE "public"."accounts"
  ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trigger_accounts_updated_at
  BEFORE UPDATE ON public.accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."accounts" TO "anon", "authenticated", "postgres", "service_role";

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
