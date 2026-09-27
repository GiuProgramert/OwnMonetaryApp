-- get_daily_expenses_by_movement_type: gasto diario por tipo de movimiento, una fila por tipo
-- con arrays de días y montos (no una fila por (día, tipo): con 92 días x 11 tipos ya son 1012
-- filas y PostgREST corta en 1000 -- ver docs/plans/daily-expenses-implementation.md).
--
-- security invoker (el default): nunca security definer, o correría con los permisos del dueño
-- de la función y devolvería movimientos de todos los usuarios.
--
-- p_start_date / p_end_date sin default, a diferencia de las RPC hermanas: un rango abierto
-- saltearía el tope de 92 días que valida el servicio, que siempre pasa los dos.

-- Orden de parámetros: `p_start_date`/`p_end_date` primero porque no tienen default y Postgres
-- exige que los parámetros con default vayan al final de la declaración; se llama por nombre
-- desde `supabase.rpc(...)`, como el resto de las RPC del dashboard, así que el orden posicional
-- no afecta a los llamadores.
CREATE OR REPLACE FUNCTION public.get_daily_expenses_by_movement_type (
  p_start_date date,
  p_end_date   date,
  p_account_id uuid DEFAULT NULL::uuid
)
  RETURNS TABLE (
    movement_type_id uuid,
    name             text,
    color            text,
    total            bigint,
    days             date[],
    amounts          bigint[]
  )
  LANGUAGE sql
  STABLE
  SET search_path TO ''
  AS $function$
  with by_day as (
    select
      mt.id                                as movement_type_id,
      mt.name                               as name,
      mt.color                              as color,
      date_trunc('day', m.date)::date       as day,
      sum(m.amount)::bigint                 as amount
    from public.movements m
    join public.accounts a on a.id = m.account_id
    join public.movement_types mt on mt.id = m.movement_type_id
    where m.type = 'debit'
      and m.transfer_id is null
      and a.user_id = (select auth.uid())
      and (p_account_id is null or m.account_id = p_account_id)
      and m.date >= p_start_date
      and m.date < (p_end_date + interval '1 day')
    group by mt.id, mt.name, mt.color, date_trunc('day', m.date)::date
  )
  select
    movement_type_id,
    name,
    color,
    sum(amount)::bigint                            as total,
    array_agg(day    order by day)                 as days,
    array_agg(amount order by day)                  as amounts
  from by_day
  group by movement_type_id, name, color
  order by total desc;
$function$;

GRANT EXECUTE ON FUNCTION "public"."get_daily_expenses_by_movement_type"(date, date, uuid) TO PUBLIC, "anon", "authenticated", "postgres", "service_role";
