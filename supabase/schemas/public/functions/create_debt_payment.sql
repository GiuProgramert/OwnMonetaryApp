CREATE OR REPLACE FUNCTION public.create_debt_payment (
  p_debt_id     uuid,
  p_account_id  uuid,
  p_amount      numeric,
  p_date        timestamp without time zone,
  p_description text
)
  RETURNS uuid
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
declare
  v_movement_id uuid;
  v_debt public.debts;
  v_payments_count bigint;
begin
  select * into v_debt
  from public.debts
  where id = p_debt_id and user_id = (select auth.uid());

  if v_debt.id is null then
    raise exception 'La deuda no existe o no te pertenece';
  end if;

  if (select count(*) from public.accounts
      where id = p_account_id
        and user_id = (select auth.uid())) <> 1 then
    raise exception 'La cuenta no existe o no te pertenece';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'El monto debe ser mayor a cero';
  end if;

  select count(*) into v_payments_count
  from public.movements m
  join public.accounts a on a.id = m.account_id
  where m.debt_id = v_debt.id
    and a.user_id = (select auth.uid())
    and m.transfer_id is null;

  if v_debt.is_finished
    or (
      v_debt.kind = 'installments'
      and (v_debt.initial_paid_installments + v_payments_count::int) >= v_debt.total_installments
    )
  then
    raise exception 'La deuda ya está finalizada';
  end if;

  insert into public.movements (account_id, movement_type_id, date, description, amount, type, debt_id)
  values (p_account_id, v_debt.movement_type_id, p_date, p_description, p_amount, 'debit', v_debt.id)
  returning id into v_movement_id;

  return v_movement_id;
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."create_debt_payment"(uuid, uuid, numeric, timestamp WITHOUT time zone, text) TO PUBLIC, "anon", "authenticated", "postgres", "service_role";
