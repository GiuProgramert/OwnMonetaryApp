-- Transferencias entre cuentas propias: dos filas de movements apareadas por transfer_id.
-- Ver docs/plans/transfers-implementation.md.

alter table public.movements add column transfer_id uuid;

create index idx_movements_transfer on public.movements using btree (transfer_id);

-- create_transfer
create or replace function public.create_transfer (
  p_from_account_id uuid,
  p_to_account_id   uuid,
  p_amount          numeric,
  p_date            date,
  p_description     text
)
  returns uuid
  language plpgsql
  volatile
  security invoker
  set search_path to ''
  as $function$
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

-- update_transfer
create or replace function public.update_transfer (
  p_transfer_id     uuid,
  p_from_account_id uuid,
  p_to_account_id   uuid,
  p_amount          numeric,
  p_date            date,
  p_description     text
)
  returns void
  language plpgsql
  volatile
  security invoker
  set search_path to ''
  as $function$
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

-- delete_transfer
create or replace function public.delete_transfer (
  p_transfer_id uuid
)
  returns void
  language plpgsql
  volatile
  security invoker
  set search_path to ''
  as $function$
declare
  v_rows integer;
begin
  delete from public.movements where transfer_id = p_transfer_id;
  get diagnostics v_rows = row_count;
  if v_rows = 0 then
    raise exception 'Transferencia no encontrada';
  end if;
end;
$function$;

grant execute on function public.create_transfer(uuid, uuid, numeric, date, text) to authenticated, service_role;
grant execute on function public.update_transfer(uuid, uuid, uuid, numeric, date, text) to authenticated, service_role;
grant execute on function public.delete_transfer(uuid) to authenticated, service_role;

-- 2.7 las cinco agregaciones excluyen transferencias
create or replace function public.get_movements_totals (
  p_account_id       uuid default null::uuid,
  p_movement_type_id uuid default null::uuid,
  p_start_date       date default null::date,
  p_end_date         date default null::date
)
  returns table (income bigint, expense bigint)
  language sql
  stable
  set search_path to ''
  as $function$
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
    and (p_end_date   is null or m.date <= p_end_date);
$function$;

create or replace function public.get_expenses_by_movement_type (
  p_account_id uuid default null::uuid,
  p_start_date date default null::date,
  p_end_date   date default null::date
)
  returns table (movement_type_id uuid, name text, color text, total bigint)
  language sql
  stable
  set search_path to ''
  as $function$
  select mt.id, mt.name, mt.color, sum(m.amount)::bigint as total
  from public.movements m
  join public.accounts a on a.id = m.account_id
  join public.movement_types mt on mt.id = m.movement_type_id
  where m.type = 'debit'
    and m.transfer_id is null
    and a.user_id = (select auth.uid())
    and (p_account_id is null or m.account_id = p_account_id)
    and (p_start_date is null or m.date >= p_start_date)
    and (p_end_date   is null or m.date <= p_end_date)
  group by mt.id, mt.name, mt.color
  order by total desc;
$function$;

create or replace function public.get_monthly_flow (
  p_account_id uuid default null::uuid,
  p_start_date date default null::date,
  p_end_date   date default null::date
)
  returns table (month date, income bigint, expense bigint)
  language sql
  stable
  set search_path to ''
  as $function$
  select
    date_trunc('month', m.date::timestamp)::date as month,
    coalesce(sum(m.amount) filter (where m.type = 'credit'), 0)::bigint as income,
    coalesce(sum(m.amount) filter (where m.type = 'debit'),  0)::bigint as expense
  from public.movements m
  join public.accounts a on a.id = m.account_id
  where a.user_id = (select auth.uid())
    and m.transfer_id is null
    and (p_account_id is null or m.account_id = p_account_id)
    and (p_start_date is null or m.date >= p_start_date)
    and (p_end_date   is null or m.date <= p_end_date)
  group by 1
  order by 1;
$function$;

create or replace function public.get_budget_status (
  p_month date default null::date
)
  returns table (
    budget_id        uuid,
    movement_type_id uuid,
    name             text,
    color            text,
    amount_limit     bigint,
    spent            bigint,
    is_active        boolean
  )
  language sql
  stable
  set search_path to ''
  as $function$
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
      and m.transfer_id is null
      and m.date >= t.month_start
      and m.date <  (t.month_start + interval '1 month')::date
  ) s on true
  where b.user_id = (select auth.uid())
  order by mt.name;
$function$;

create or replace function public.get_budget_history (
  p_budget_id uuid,
  p_months    integer default 12
)
  returns table (period_month date, amount_limit bigint, spent bigint)
  language sql
  stable
  set search_path to ''
  as $function$
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
      and m.transfer_id is null
      and m.date >= bp.period_month
      and m.date <  (bp.period_month + interval '1 month')::date
  ) s on true
  where bp.budget_id = p_budget_id
    and b.user_id = (select auth.uid())
  order by bp.period_month desc
  limit p_months;
$function$;
