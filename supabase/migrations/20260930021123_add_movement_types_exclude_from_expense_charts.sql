-- movement_types.exclude_from_expense_charts: excluye un tipo (ej. "Prestado") de los cards
-- "Gastos por tipo" y "Gastos diarios por tipo" del dashboard.
--
-- El filtro va en SQL y no en JS: la agrupación en "Otros" (top 8) y los porcentajes se calculan
-- en lib/services/dashboard.ts sobre lo que devuelve la RPC. Si el tipo excluido se quitara
-- después en JS, ya habría ocupado uno de los 8 lugares del top y entrado en el total de los
-- porcentajes. Además, toda agregación del dashboard va por RPC.
--
-- Las dos RPC se redefinen con la misma firma (nombres, orden y defaults), security invoker y
-- search_path vacío; el único cambio es `and not mt.exclude_from_expense_charts` en el where.
-- Nunca security definer: correría con los permisos del dueño y devolvería movimientos de todos.

alter table public.movement_types
  add column exclude_from_expense_charts boolean not null default false;

comment on column public.movement_types.exclude_from_expense_charts is
  'Si es true, el tipo no aparece en los cards "Gastos por tipo" y "Gastos diarios por tipo" del dashboard. No afecta a saldos, totales ("Egresos"), flujo mensual ni presupuestos.';

update public.movement_types
  set exclude_from_expense_charts = true
  where name = 'Prestado';

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
    and not mt.exclude_from_expense_charts
    and a.user_id = (select auth.uid())
    and (p_account_id is null or m.account_id = p_account_id)
    and (p_start_date is null or m.date >= p_start_date)
    and (p_end_date   is null or m.date < (p_end_date + interval '1 day'))
  group by mt.id, mt.name, mt.color
  order by total desc;
$function$;

GRANT EXECUTE ON FUNCTION "public"."get_expenses_by_movement_type"(uuid, date, date) TO PUBLIC, "anon", "authenticated", "postgres", "service_role";

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
      and not mt.exclude_from_expense_charts
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
