CREATE OR REPLACE FUNCTION public.ensure_budget_periods (
  p_month date DEFAULT NULL::date
)
  RETURNS integer
  LANGUAGE sql
  SET search_path TO ''
  AS $function$
  with target as (
    select least(
      date_trunc('month', coalesce(p_month, current_date)::timestamp)::date,
      date_trunc('month', current_date::timestamp)::date
    ) as month_end
  ),
  inserted as (
    insert into public.budget_periods (budget_id, period_month, amount)
    select b.id, m.month::date, b.amount
    from public.budgets b
    cross join target t
    cross join lateral generate_series(
      date_trunc('month', b.created_at)::date,
      t.month_end,
      interval '1 month'
    ) as m(month)
    where b.user_id = (select auth.uid())
      and b.is_active
    on conflict (budget_id, period_month) do nothing
    returning 1
  )
  select count(*)::integer from inserted;
$function$;

GRANT EXECUTE ON FUNCTION "public"."ensure_budget_periods"(date) TO PUBLIC, "anon", "authenticated", "postgres", "service_role";
