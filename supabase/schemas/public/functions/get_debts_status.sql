CREATE OR REPLACE FUNCTION public.get_debts_status (
  p_debt_id uuid DEFAULT NULL::uuid
)
  RETURNS TABLE (
    id                        uuid,
    user_id                   uuid,
    name                      text,
    kind                      text,
    amount_mode               text,
    amount                    numeric,
    movement_type_id          uuid,
    movement_type_name        text,
    movement_type_color       text,
    first_due_date            date,
    total_installments        integer,
    initial_paid_installments integer,
    is_finished               boolean,
    created_at                timestamp with time zone,
    updated_at                timestamp with time zone,
    payments_count            bigint,
    paid_amount               bigint,
    paid_installments         integer,
    remaining_installments    integer,
    remaining_amount          bigint,
    finished                  boolean,
    next_due_date             date
  )
  LANGUAGE sql
  STABLE
  SET search_path TO ''
  AS $function$
  select
    d.id,
    d.user_id,
    d.name,
    d.kind,
    d.amount_mode,
    d.amount,
    d.movement_type_id,
    mt.name as movement_type_name,
    mt.color as movement_type_color,
    d.first_due_date,
    d.total_installments,
    d.initial_paid_installments,
    d.is_finished,
    d.created_at,
    d.updated_at,
    coalesce(s.payments_count, 0) as payments_count,
    coalesce(s.paid_amount, 0) as paid_amount,
    case when d.kind = 'installments'
      then d.initial_paid_installments + coalesce(s.payments_count, 0)::int
      else null
    end as paid_installments,
    case when d.kind = 'installments'
      then greatest(
        d.total_installments - (d.initial_paid_installments + coalesce(s.payments_count, 0)::int),
        0
      )
      else null
    end as remaining_installments,
    case when d.kind = 'installments'
      then greatest(
        d.total_installments - (d.initial_paid_installments + coalesce(s.payments_count, 0)::int),
        0
      ) * d.amount::bigint
      else null
    end as remaining_amount,
    (
      d.is_finished
      or (
        d.kind = 'installments'
        and (d.initial_paid_installments + coalesce(s.payments_count, 0)::int) >= d.total_installments
      )
    ) as finished,
    case when (
      d.is_finished
      or (
        d.kind = 'installments'
        and (d.initial_paid_installments + coalesce(s.payments_count, 0)::int) >= d.total_installments
      )
    )
      then null
      -- Siempre desde first_due_date, nunca encadenado mes a mes (ver plan, 1.3).
      else (d.first_due_date + make_interval(months => coalesce(s.payments_count, 0)::int))::date
    end as next_due_date
  from public.debts d
  join public.movement_types mt on mt.id = d.movement_type_id
  left join lateral (
    select
      count(*) as payments_count,
      coalesce(sum(m.amount), 0) as paid_amount
    from public.movements m
    join public.accounts a on a.id = m.account_id
    where m.debt_id = d.id
      and a.user_id = (select auth.uid())
      and m.transfer_id is null
  ) s on true
  where d.user_id = (select auth.uid())
    and (p_debt_id is null or d.id = p_debt_id)
  order by
    (
      d.is_finished
      or (
        d.kind = 'installments'
        and (d.initial_paid_installments + coalesce(s.payments_count, 0)::int) >= d.total_installments
      )
    ) asc,
    case when (
      d.is_finished
      or (
        d.kind = 'installments'
        and (d.initial_paid_installments + coalesce(s.payments_count, 0)::int) >= d.total_installments
      )
    )
      then null
      else (d.first_due_date + make_interval(months => coalesce(s.payments_count, 0)::int))::date
    end asc,
    d.name asc;
$function$;

GRANT EXECUTE ON FUNCTION "public"."get_debts_status"(uuid) TO PUBLIC, "anon", "authenticated", "postgres", "service_role";
