CREATE OR REPLACE FUNCTION public.update_updated_at()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$;

GRANT EXECUTE ON FUNCTION "public"."update_updated_at"() TO PUBLIC, "anon", "authenticated", "postgres", "service_role";
