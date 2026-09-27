-- Deudas: servicios (sin fin definido) y pagos en cuotas.
-- Ver docs/plans/debts-implementation.md.

-- 1.1: tabla debts
create table public.debts (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  name text not null,
  kind text not null check (kind in ('service', 'installments')),
  amount_mode text not null check (amount_mode in ('fixed', 'variable')),
  amount numeric(15,2) not null check (amount > 0),
  movement_type_id uuid not null,
  first_due_date date not null,
  total_installments integer null,
  initial_paid_installments integer not null default 0,
  is_finished boolean not null default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint debts_pkey primary key (id),
  constraint debts_user_id_fkey foreign key (user_id) references auth.users(id),
  constraint debts_movement_type_id_fkey foreign key (movement_type_id) references public.movement_types(id) on delete restrict,
  constraint debts_installments_check check (
    (kind = 'service' and total_installments is null and initial_paid_installments = 0)
    or
    (kind = 'installments' and total_installments > 0
      and initial_paid_installments >= 0
      and initial_paid_installments < total_installments)
  )
);

alter table public.debts enable row level security;

create trigger trigger_debts_updated_at
  before update on public.debts
  for each row
  execute function public.update_updated_at();

create index idx_debts_user on public.debts using btree (user_id);

create policy "Users can create own debts" on public.debts
  for insert
  to authenticated
  with check (user_id = (select auth.uid()));

create policy "Users can view own debts" on public.debts
  for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "Users can update own debts" on public.debts
  for update
  to authenticated
  using (user_id = (select auth.uid()));

create policy "Users can delete own debts" on public.debts
  for delete
  to authenticated
  using (user_id = (select auth.uid()));

grant delete, insert, references, select, trigger, truncate, update on table public.debts to anon, authenticated, postgres, service_role;

-- 1.2: vínculo movements -> debts
alter table public.movements
  add column debt_id uuid references public.debts(id) on delete set null;

create index idx_movements_debt on public.movements using btree (debt_id);

-- 1.2.1: una fila no puede ser a la vez pago de deuda y mitad de una transferencia
alter table public.movements
  add constraint movements_debt_or_transfer_check
  check (debt_id is null or transfer_id is null);

-- 1.3: estado calculado de cada deuda
create or replace function public.get_debts_status(p_debt_id uuid default null)
returns table (
  id uuid,
  user_id uuid,
  name text,
  kind text,
  amount_mode text,
  amount numeric,
  movement_type_id uuid,
  movement_type_name text,
  movement_type_color text,
  first_due_date date,
  total_installments integer,
  initial_paid_installments integer,
  is_finished boolean,
  created_at timestamptz,
  updated_at timestamptz,
  payments_count bigint,
  paid_amount bigint,
  paid_installments integer,
  remaining_installments integer,
  remaining_amount bigint,
  finished boolean,
  next_due_date date
)
language sql
stable
set search_path to ''
as $function$
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

grant execute on function public.get_debts_status(uuid) to authenticated, service_role;

-- 1.4: pago de una deuda (movimiento debit vinculado)
create or replace function public.create_debt_payment(
  p_debt_id uuid,
  p_account_id uuid,
  p_amount numeric,
  p_date timestamp without time zone,
  p_description text
)
returns uuid
language plpgsql
set search_path to ''
as $function$
declare
  v_movement_id uuid;
  v_debt public.debts;
  v_payments_count bigint;
begin
  select * into v_debt
  from public.debts
  where id = p_debt_id and user_id = (select auth.uid());

  if v_debt.id is null then
    raise exception 'La deuda no existe o no te pertenece';
  end if;

  if (select count(*) from public.accounts
      where id = p_account_id
        and user_id = (select auth.uid())) <> 1 then
    raise exception 'La cuenta no existe o no te pertenece';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'El monto debe ser mayor a cero';
  end if;

  select count(*) into v_payments_count
  from public.movements m
  join public.accounts a on a.id = m.account_id
  where m.debt_id = v_debt.id
    and a.user_id = (select auth.uid())
    and m.transfer_id is null;

  if v_debt.is_finished
    or (
      v_debt.kind = 'installments'
      and (v_debt.initial_paid_installments + v_payments_count::int) >= v_debt.total_installments
    )
  then
    raise exception 'La deuda ya está finalizada';
  end if;

  insert into public.movements (account_id, movement_type_id, date, description, amount, type, debt_id)
  values (p_account_id, v_debt.movement_type_id, p_date, p_description, p_amount, 'debit', v_debt.id)
  returning id into v_movement_id;

  return v_movement_id;
end;
$function$;

grant execute on function public.create_debt_payment(uuid, uuid, numeric, timestamp without time zone, text) to authenticated, service_role;
