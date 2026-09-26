CREATE OR REPLACE FUNCTION public.get_budget_history (
  p_budget_id uuid,
  p_months    integer DEFAULT 12
)
  RETURNS TABLE (
    period_month date,
    amount_limit bigint,
    spent        bigint
  )
  LANGUAGE sql
  STABLE
  SET search_path TO ''
  AS $function$
  select
    bp.period_month,
    bp.amount::bigint             as amount_limit,
    coalesce(s.spent, 0)::bigint  as spent
  from public.budget_periods bp
  join public.budgets b on b.id = bp.budget_id
  left join lateral (
    select sum(m.amount) as spent
    from public.movements m
    join public.accounts a on a.id = m.account_id
    where m.movement_type_id = b.movement_type_id
      and a.user_id = (select auth.uid())
      and m.type = 'debit'
      and m.date >= bp.period_month
      and m.date <  (bp.period_month + interval '1 month')::date
  ) s on true
  where bp.budget_id = p_budget_id
    and b.user_id = (select auth.uid())
  order by bp.period_month desc
  limit p_months;
$function$;

GRANT EXECUTE ON FUNCTION "public"."get_budget_history"(uuid, integer) TO PUBLIC, "anon", "authenticated", "postgres", "service_role";
