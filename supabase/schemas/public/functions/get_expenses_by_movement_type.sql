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
