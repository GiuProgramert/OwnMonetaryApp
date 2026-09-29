-- Con una cuenta filtrada, las transferencias cuentan en los totales: la entrante como ingreso y la
-- saliente como egreso, para que el neto refleje lo que pasó con esa cuenta. Sin filtro de cuenta
-- se siguen excluyendo: las dos patas se cancelan en el neto pero inflarían ingresos y egresos.
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
    and (m.transfer_id is null or p_account_id is not null)
    and (p_account_id       is null or m.account_id       = p_account_id)
    and (p_movement_type_id is null or m.movement_type_id = p_movement_type_id)
    and (p_start_date is null or m.date >= p_start_date)
    and (p_end_date   is null or m.date < (p_end_date + interval '1 day'));
$function$;
