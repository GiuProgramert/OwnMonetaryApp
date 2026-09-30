CREATE TABLE "public"."movement_types" (
  "id"                          uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "name"                        character varying(100)   NOT NULL,
  "description"                 text,
  "created_at"                  timestamp with time zone DEFAULT now(),
  "updated_at"                  timestamp with time zone DEFAULT now(),
  "color"                       character varying(7)     NOT NULL DEFAULT '#6B7280'::character varying,
  "exclude_from_expense_charts" boolean                  NOT NULL DEFAULT false,
  CONSTRAINT "check_color_format" CHECK (((color)::text ~ '^#[0-9A-Fa-f]{6}$'::text)),
  CONSTRAINT "movement_types_name_key" UNIQUE (name),
  CONSTRAINT "movement_types_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."movement_types"
  ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trigger_movement_types_updated_at
  BEFORE UPDATE ON public.movement_types
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

CREATE POLICY "movement_types_delete" ON "public"."movement_types"
  FOR DELETE
  TO "authenticated"
  USING ((( SELECT auth.uid() AS uid) = 'd70b4515-6934-4111-b329-fbc57df0ce15'::uuid));

CREATE POLICY "movement_types_insert" ON "public"."movement_types"
  FOR INSERT
  TO "authenticated"
  WITH CHECK ((( SELECT auth.uid() AS uid) = 'd70b4515-6934-4111-b329-fbc57df0ce15'::uuid));

CREATE POLICY "movement_types_read" ON "public"."movement_types"
  FOR SELECT
  TO "authenticated"
  USING (true);

CREATE POLICY "movement_types_update" ON "public"."movement_types"
  FOR UPDATE
  TO "authenticated"
  USING ((( SELECT auth.uid() AS uid) = 'd70b4515-6934-4111-b329-fbc57df0ce15'::uuid));

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."movement_types" TO "anon", "authenticated", "postgres", "service_role";

COMMENT ON COLUMN "public"."movement_types"."exclude_from_expense_charts" IS 'Si es true, el tipo no aparece en los cards "Gastos por tipo" y "Gastos diarios por tipo" del dashboard. No afecta a saldos, totales ("Egresos"), flujo mensual ni presupuestos.';
