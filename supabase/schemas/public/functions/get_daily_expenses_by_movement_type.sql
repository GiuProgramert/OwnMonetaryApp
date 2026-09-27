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
