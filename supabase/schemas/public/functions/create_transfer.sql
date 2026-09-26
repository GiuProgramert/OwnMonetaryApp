CREATE OR REPLACE FUNCTION public.create_transfer (
  p_from_account_id uuid,
  p_to_account_id   uuid,
  p_amount          numeric,
  p_date            timestamp without time zone,
  p_description     text
)
  RETURNS uuid
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
declare
  v_transfer_id uuid := gen_random_uuid();
  -- UUID con el id fijo de movement_types para transferencias. Ver docs/plans/transfers-implementation.md.
  v_type_id     uuid := 'e7f1b48a-be01-48a5-9982-5a4d4025493c';
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

  insert into public.movements (account_id, movement_type_id, date, description, amount, type, transfer_id)
  values (p_from_account_id, v_type_id, p_date, p_description, p_amount, 'debit', v_transfer_id),
         (p_to_account_id,   v_type_id, p_date, p_description, p_amount, 'credit', v_transfer_id);

  return v_transfer_id;
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."create_transfer"(uuid, uuid, numeric, timestamp WITHOUT time zone, text) TO PUBLIC, "anon", "authenticated", "postgres", "service_role";
