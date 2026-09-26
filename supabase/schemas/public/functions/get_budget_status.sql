CREATE OR REPLACE FUNCTION public.get_budget_status (
  p_month date DEFAULT NULL::date
)
  RETURNS TABLE (
    budget_id        uuid,
    movement_type_id uuid,
    name             text,
    color            text,
    amount_limit     bigint,
    spent            bigint,
    is_active        boolean
  )
  LANGUAGE sql
  STABLE
  SET search_path TO ''
  AS $function$
  with target as (
    select date_trunc('month', coalesce(p_month, current_date)::timestamp)::date as month_start
  )
  select
    b.id,
    b.movement_type_id,
    mt.name,
    mt.color,
    coalesce(bp.amount, b.amount)::bigint as amount_limit,
    coalesce(s.spent, 0)::bigint          as spent,
    b.is_active
  from public.budgets b
  cross join target t
  join public.movement_types mt on mt.id = b.movement_type_id
  left join public.budget_periods bp
    on bp.budget_id = b.id and bp.period_month = t.month_start
  left join lateral (
    select sum(m.amount) as spent
    from public.movements m
    join public.accounts a on a.id = m.account_id
    where m.movement_type_id = b.movement_type_id
      and a.user_id = (select auth.uid())
      and m.type = 'debit'
      and m.date >= t.month_start
      and m.date <  (t.month_start + interval '1 month')::date
  ) s on true
  where b.user_id = (select auth.uid())
  order by mt.name;
$function$;

GRANT EXECUTE ON FUNCTION "public"."get_budget_status"(date) TO PUBLIC, "anon", "authenticated", "postgres", "service_role";
