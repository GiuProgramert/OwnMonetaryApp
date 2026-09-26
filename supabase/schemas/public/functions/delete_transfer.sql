CREATE OR REPLACE FUNCTION public.delete_transfer (
  p_transfer_id uuid
)
  RETURNS void
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
declare
  v_rows integer;
begin
  delete from public.movements where transfer_id = p_transfer_id;
  get diagnostics v_rows = row_count;
  if v_rows = 0 then
    raise exception 'Transferencia no encontrada';
  end if;
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."delete_transfer"(uuid) TO PUBLIC, "anon", "authenticated", "postgres", "service_role";
