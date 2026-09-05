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

ALTER TABLE "public"."movement_types"
  ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trigger_movement_types_updated_at
  BEFORE UPDATE ON public.movement_types
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

CREATE POLICY "movement_types_read" ON "public"."movement_types"
  FOR SELECT
  TO "authenticated"
  USING (true);

CREATE POLICY "movement_types_write" ON "public"."movement_types"
  FOR ALL
  TO "authenticated"
  USING (true)
  WITH CHECK (true);

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."movement_types" TO "anon", "authenticated", "postgres", "service_role";
