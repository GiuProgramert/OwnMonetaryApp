-- movements.date: de `date` a `timestamp` (fecha y hora local).
--
-- `timestamp` (sin zona) y no `timestamptz`: la app asume "día calendario local de Paraguay" y
-- ninguna comparación en SQL hace matemática de zonas. Con `timestamptz`, un movimiento de las
-- 22:00 del 30/09 local se guardaría como 01:00 del 01/10 UTC y las agregaciones lo contarían en
-- el mes siguiente. Ver docs/plans/movements-date-timestamp-implementation.md.
--
-- Las filas existentes quedan a las 00:00. El índice idx_movements_date se reconstruye solo.
-- El trigger de saldo no lee `date`, así que accounts.current_balance no se ve afectado.

alter table public.movements
  alter column date type timestamp using date::timestamp,
  alter column date set default localtimestamp;

comment on column public.movements.date is
  'Fecha y hora local del movimiento (sin zona: la app asume hora de Paraguay). Las filas previas al cambio de tipo quedaron a las 00:00.';

-- Fin de rango: con `timestamp`, `<= p_end_date` (castea a 00:00) perdería el último día. Los
-- parámetros siguen siendo `date`, así que CREATE OR REPLACE alcanza (no crea sobrecarga).

CREATE OR REPLACE FUNCTION public.get_movements_totals (
  p_account_id       uuid DEFAULT NULL::uuid,
  p_movement_type_id uuid DEFAULT NULL::uuid,
  p_start_date       date DEFAULT NULL::date,
  p_end_date         date DEFAULT NULL::date
)
  RETURNS TABLE (
    income  bigint,
    expense bigint
  )
  LANGUAGE sql
  STABLE
  SET search_path TO ''
  AS $function$
  select
    coalesce(sum(m.amount) filter (where m.type = 'credit'), 0)::bigint as income,
    coalesce(sum(m.amount) filter (where m.type = 'debit'),  0)::bigint as expense
  from public.movements m
  join public.accounts a on a.id = m.account_id
  where a.user_id = (select auth.uid())
    and m.transfer_id is null
    and (p_account_id       is null or m.account_id       = p_account_id)
    and (p_movement_type_id is null or m.movement_type_id = p_movement_type_id)
    and (p_start_date is null or m.date >= p_start_date)
    and (p_end_date   is null or m.date < (p_end_date + interval '1 day'));
$function$;

GRANT EXECUTE ON FUNCTION "public"."get_movements_totals"(uuid, uuid, date, date) TO PUBLIC, "anon", "authenticated", "postgres", "service_role";
CREATE OR REPLACE FUNCTION public.get_expenses_by_movement_type (
  p_account_id uuid DEFAULT NULL::uuid,
  p_start_date date DEFAULT NULL::date,
  p_end_date   date DEFAULT NULL::date
)
  RETURNS TABLE (
    movement_type_id uuid,
    name             text,
    color            text,
    total            bigint
  )
  LANGUAGE sql
  STABLE
  SET search_path TO ''
  AS $function$
  select mt.id, mt.name, mt.color, sum(m.amount)::bigint as total
  from public.movements m
  join public.accounts a on a.id = m.account_id
  join public.movement_types mt on mt.id = m.movement_type_id
  where m.type = 'debit'
    and m.transfer_id is null
    and a.user_id = (select auth.uid())
    and (p_account_id is null or m.account_id = p_account_id)
    and (p_start_date is null or m.date >= p_start_date)
    and (p_end_date   is null or m.date < (p_end_date + interval '1 day'))
  group by mt.id, mt.name, mt.color
  order by total desc;
$function$;

GRANT EXECUTE ON FUNCTION "public"."get_expenses_by_movement_type"(uuid, date, date) TO PUBLIC, "anon", "authenticated", "postgres", "service_role";
CREATE OR REPLACE FUNCTION public.get_monthly_flow (
  p_account_id uuid DEFAULT NULL::uuid,
  p_start_date date DEFAULT NULL::date,
  p_end_date   date DEFAULT NULL::date
)
  RETURNS TABLE (
    month   date,
    income  bigint,
    expense bigint
  )
  LANGUAGE sql
  STABLE
  SET search_path TO ''
  AS $function$
  select
    date_trunc('month', m.date)::date as month,
    coalesce(sum(m.amount) filter (where m.type = 'credit'), 0)::bigint as income,
    coalesce(sum(m.amount) filter (where m.type = 'debit'),  0)::bigint as expense
  from public.movements m
  join public.accounts a on a.id = m.account_id
  where a.user_id = (select auth.uid())
    and m.transfer_id is null
    and (p_account_id is null or m.account_id = p_account_id)
    and (p_start_date is null or m.date >= p_start_date)
    and (p_end_date   is null or m.date < (p_end_date + interval '1 day'))
  group by 1
  order by 1;
$function$;

GRANT EXECUTE ON FUNCTION "public"."get_monthly_flow"(uuid, date, date) TO PUBLIC, "anon", "authenticated", "postgres", "service_role";

-- create_transfer / update_transfer: cambiar el tipo de un parámetro crea una sobrecarga en vez de
-- reemplazar, así que se dropea la firma vieja antes de crear la nueva.
drop function if exists public.create_transfer(uuid, uuid, numeric, date, text);
drop function if exists public.update_transfer(uuid, uuid, uuid, numeric, date, text);

CREATE OR REPLACE FUNCTION public.create_transfer (
  p_from_account_id uuid,
  p_to_account_id   uuid,
  p_amount          numeric,
  p_date            timestamp,
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

GRANT EXECUTE ON FUNCTION "public"."create_transfer"(uuid, uuid, numeric, timestamp, text) TO PUBLIC, "anon", "authenticated", "postgres", "service_role";
CREATE OR REPLACE FUNCTION public.update_transfer (
  p_transfer_id     uuid,
  p_from_account_id uuid,
  p_to_account_id   uuid,
  p_amount          numeric,
  p_date            timestamp,
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

GRANT EXECUTE ON FUNCTION "public"."update_transfer"(uuid, uuid, uuid, numeric, timestamp, text) TO PUBLIC, "anon", "authenticated", "postgres", "service_role";

-- NO se tocan get_budget_status, get_budget_history ni ensure_budget_periods: ya comparan con
-- `>= month_start` y `< month_start + interval '1 month'`, que sobreviven al cambio de tipo.
-- Cambiarlas rompería el borde del último día del mes.
