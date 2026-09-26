-- Presupuestos mensuales por tipo de movimiento.
-- Ver docs/plans/budgets-implementation.md. Lo gastado NO se guarda: se calcula por RPC.

-- 2.1 budgets: la configuración
create table public.budgets (
  id               uuid                     not null default gen_random_uuid(),
  user_id          uuid                     not null default auth.uid(),
  movement_type_id uuid                     not null,
  amount           numeric(15,2)            not null,
  is_active        boolean                  not null default true,
  created_at       timestamp with time zone default now(),
  updated_at       timestamp with time zone default now(),
  constraint budgets_pkey primary key (id),
  constraint budgets_user_id_fkey foreign key (user_id) references auth.users(id),
  constraint budgets_movement_type_id_fkey foreign key (movement_type_id)
    references public.movement_types(id) on delete cascade,
  constraint budgets_amount_check check (amount > 0),
  constraint budgets_user_movement_type_key unique (user_id, movement_type_id)
);

create index idx_budgets_user on public.budgets using btree (user_id);

-- 2.2 budget_periods: el histórico del tope, una fila por mes
create table public.budget_periods (
  id           uuid                     not null default gen_random_uuid(),
  budget_id    uuid                     not null,
  period_month date                     not null,
  amount       numeric(15,2)            not null,
  created_at   timestamp with time zone default now(),
  updated_at   timestamp with time zone default now(),
  constraint budget_periods_pkey primary key (id),
  constraint budget_periods_budget_id_fkey foreign key (budget_id)
    references public.budgets(id) on delete cascade,
  constraint budget_periods_amount_check check (amount > 0),
  constraint budget_periods_month_check
    check (period_month = date_trunc('month', period_month::timestamp)::date),
  constraint budget_periods_budget_month_key unique (budget_id, period_month)
);

create index idx_budget_periods_month on public.budget_periods using btree (period_month);

-- 2.3 triggers de updated_at (los únicos de esta feature)
create trigger trigger_budgets_updated_at
  before update on public.budgets
  for each row execute function public.update_updated_at();

create trigger trigger_budget_periods_updated_at
  before update on public.budget_periods
  for each row execute function public.update_updated_at();

-- 2.4 RLS
alter table public.budgets enable row level security;
alter table public.budget_periods enable row level security;

create policy "Users can view own budgets" on public.budgets
  for select to authenticated using (user_id = (select auth.uid()));

create policy "Users can create own budgets" on public.budgets
  for insert to authenticated with check (user_id = (select auth.uid()));

create policy "Users can update own budgets" on public.budgets
  for update to authenticated using (user_id = (select auth.uid()));

create policy "Users can delete own budgets" on public.budgets
  for delete to authenticated using (user_id = (select auth.uid()));

create policy "Users can view periods of own budgets" on public.budget_periods
  for select to authenticated using (exists (
    select 1 from public.budgets b
    where b.id = budget_periods.budget_id and b.user_id = (select auth.uid())
  ));

create policy "Users can create periods of own budgets" on public.budget_periods
  for insert to authenticated with check (exists (
    select 1 from public.budgets b
    where b.id = budget_periods.budget_id and b.user_id = (select auth.uid())
  ));

create policy "Users can update periods of own budgets" on public.budget_periods
  for update to authenticated using (exists (
    select 1 from public.budgets b
    where b.id = budget_periods.budget_id and b.user_id = (select auth.uid())
  ));

create policy "Users can delete periods of own budgets" on public.budget_periods
  for delete to authenticated using (exists (
    select 1 from public.budgets b
    where b.id = budget_periods.budget_id and b.user_id = (select auth.uid())
  ));

-- 2.5 grants
grant delete, insert, references, select, trigger, truncate, update
  on table public.budgets to anon, authenticated, postgres, service_role;
grant delete, insert, references, select, trigger, truncate, update
  on table public.budget_periods to anon, authenticated, postgres, service_role;

-- 2.6 ensure_budget_periods: crea las filas de período que falten (única función VOLATILE)
create or replace function public.ensure_budget_periods(p_month date default null)
returns integer
language sql
volatile
security invoker
set search_path = ''
as $$
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
$$;

grant execute on function public.ensure_budget_periods(date)
  to public, anon, authenticated, postgres, service_role;

-- 2.7 get_budget_status: estado del mes, una fila por presupuesto
create or replace function public.get_budget_status(p_month date default null)
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
security invoker
set search_path = ''
as $$
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
$$;

grant execute on function public.get_budget_status(date)
  to public, anon, authenticated, postgres, service_role;

-- 2.8 get_budget_history: histórico de un presupuesto (lee bp.amount directo, sin coalesce)
create or replace function public.get_budget_history(
  p_budget_id uuid,
  p_months    integer default 12
)
returns table (
  period_month date,
  amount_limit bigint,
  spent        bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
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
$$;

grant execute on function public.get_budget_history(uuid, integer)
  to public, anon, authenticated, postgres, service_role;
