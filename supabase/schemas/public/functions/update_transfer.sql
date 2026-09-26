CREATE OR REPLACE FUNCTION public.update_transfer (
  p_transfer_id     uuid,
  p_from_account_id uuid,
  p_to_account_id   uuid,
  p_amount          numeric,
  p_date            date,
  p_description     text
)
  RETURNS void
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
declare
  v_rows integer;
begin
  if p_from_account_id = p_to_account_id then
    raise exception 'La cuenta de destino debe ser distinta a la de origen';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'El monto debe ser mayor a cero';
  end if;
  if (select count(*) from public.accounts
      where id in (p_from_account_id, p_to_account_id)
        and user_id = (select auth.uid())) <> 2 then
    raise exception 'Cuenta de origen o destino inválida';
  end if;

  update public.movements
  set account_id = p_from_account_id, amount = p_amount, date = p_date, description = p_description
  where transfer_id = p_transfer_id and type = 'debit';
  get diagnostics v_rows = row_count;
  if v_rows <> 1 then
    raise exception 'Transferencia no encontrada';
  end if;

  update public.movements
  set account_id = p_to_account_id, amount = p_amount, date = p_date, description = p_description
  where transfer_id = p_transfer_id and type = 'credit';
  get diagnostics v_rows = row_count;
  if v_rows <> 1 then
    raise exception 'Transferencia no encontrada';
  end if;
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."update_transfer"(uuid, uuid, uuid, numeric, date, text) TO PUBLIC, "anon", "authenticated", "postgres", "service_role";
