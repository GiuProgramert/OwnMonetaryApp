# Plan: presupuestos mensuales por tipo de movimiento

**Fecha:** 2026-09-25
**Estado:** implementado (Fases 1–5, 7.1, 7.4–7.7); pendientes: 7.2 y 7.3 (prueba manual logueado) y la Fase 6 (opcional, no hecha)

## Objetivo

El usuario puede configurar un tope de gasto mensual para cada tipo de movimiento, y ver en una
pantalla propia cuánto gastó contra ese tope en el mes: cuánto le queda, o cuánto se pasó. El tope
se renueva solo todos los meses y cada mes queda registrado con el tope que tenía en ese momento,
así que el histórico permite ver mes por mes si sobró presupuesto o si se excedió. Cargar un
movimiento nunca se bloquea ni falla por presupuesto.

## Cómo ejecutar este plan

> - **Verificá antes de arrancar que lo que este plan afirma del código siga siendo cierto.** Tiene
>   fecha; los archivos, funciones y componentes que nombra pueden haber cambiado desde entonces.
> - **Seguí el orden de las fases.** La 2 (base de datos) bloquea a la 3 (servicios), y la 3 bloquea
>   a la 4 y la 5. La 1 se puede hacer en cualquier momento antes de la 4.
> - **Si la realidad contradice al plan, pará y preguntá.** Un plan equivocado en un punto se
>   corrige en dos minutos; una solución improvisada alrededor del error se descubre semanas después.
>   Vale especialmente para la Fase 2: `npm run db:push` va **directo contra producción** y no hay
>   staging. Si algo no cierra, se para antes de pushear, no después.
> - **No amplíes el alcance.** Lo que no está en un punto, no entra — y lo que está en
>   [Fuera de alcance](#fuera-de-alcance) se descartó a propósito, con motivo. Si algo parece faltar,
>   preguntá antes de agregarlo. En particular: **no agregues un trigger que descuente el
>   presupuesto**, es la decisión central de este plan y está justificada abajo.
> - **Respetá los puntos marcados _(opcional)_:** son opcionales de verdad. Toda la Fase 6 lo es.
> - **Marcá `[x]` a medida que avanzás** y actualizá el **Estado** del encabezado. Un punto que
>   quede sin hacer se deja en `[ ]` con el motivo escrito ahí mismo — nunca se borra.
> - **Al terminar, escribí las Notas de cierre** al final del documento: qué se desvió del plan y
>   por qué, qué quedó sin hacer, qué se verificó y **qué no se pudo verificar**. Lo último es lo más
>   valioso de la sección y lo primero que se omite.

## Contexto

Lo que ya existe y **hay que reusar, no reescribir**:

- `MovementTypeSelect` (`components/movement-type-select.tsx`) — select con swatch de color.
- `AmountInput` (`components/movements/amount-input.tsx`) — input de monto ya formateado.
- `FormContainer` (`components/form-container.tsx`) y `TableSkeleton`
  (`components/table-skeleton.tsx`).
- `formatCurrency` y `formatCompactAmount` (`lib/dashboard/format.ts`).
- `revalidateMyDataAndRedirect` (`lib/services/revalidate.ts`) — el flujo post-mutación del repo.
- `notFoundDetailMessage` (`lib/constants.ts`) para los lookups por id.
- El patrón de filtro por `searchParams` + Server Component de `app/protected/movements/page.tsx` +
  `components/movements/filters.tsx`.
- Los primitivos de `components/ui/` y `ChartContainer` (`components/ui/chart.tsx`, con Recharts ya
  instalado).
- El módulo de `movement-types` completo (`lib/schemas/movement-types.ts` →
  `lib/services/movement-types.ts` / `.client.ts` → `components/movement-types/*` →
  `app/protected/movement-types/**`) como molde exacto de la estructura a replicar.

Restricciones del sistema que condicionan el diseño:

1. **`movement_types` es una tabla global sin `user_id`** (RLS `using (true)` para cualquier
   autenticado — ver `supabase/schemas/public/tables/movement_types.sql`). Los presupuestos sí son
   por usuario, así que `budgets` lleva `user_id` propio y no puede heredar pertenencia del tipo.
   Consecuencia ya documentada en [`docs/database.md`](../database.md#reglas-para-la-aplicación-1):
   cualquier usuario autenticado puede renombrar o borrar un tipo de movimiento, y eso impacta
   presupuestos de otros usuarios.
2. **PostgREST corta en 1000 filas** (`db.max_rows`). Cualquier agregación que baje filas crudas de
   `movements` y sume en JS subcuenta en silencio al pasar ese umbral. Regla vigente del repo
   (`CLAUDE.md`, sección Dashboard): **toda agregación va por función RPC en Postgres**.
3. **`accounts.current_balance` es el precedente de lo que no hay que repetir.**
   [`docs/database.md`](../database.md#3-el-saldo-es-incremental-no-calculado) documenta que el saldo
   es incremental y nunca se recomputa: cualquier diferencia queda para siempre, y el documento tiene
   queries de diagnóstico y reparación por eso. Es el argumento directo de la primera decisión de
   abajo.
4. **No hay Docker en esta máquina** ([`docs/supabase.md`](../supabase.md)), así que no hay
   `supabase db diff`: la migración se escribe a mano, y el ciclo obligatorio es
   `migration new` → editar → `db:push` (con `--dry-run` primero) → `db:pull` → `db:types`.
   ⚠️ `db:push` aplica contra producción.
5. **La RLS es la única barrera de seguridad** — `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` viaja en el
   bundle del browser. Toda tabla nueva nace con RLS activada y al menos una política, las políticas
   usan `(select auth.uid())` y nunca `auth.uid()` pelado, y toda política de `INSERT` lleva
   `with_check`.
6. **`movements` no tiene `user_id`**: la pertenencia se resuelve por `EXISTS` contra `accounts`.
   `budget_periods` copia ese modelo (indirecto, vía `budgets`).
7. **No existe el primitivo `progress`** en `components/ui/`. Hay `badge`, `button`, `card`, `chart`,
   `checkbox`, `dropdown-menu`, `input`, `label`, `select`, `skeleton` y `table`.
8. **Las fechas se formatean en hora local, nunca con `toISOString()`** — está documentado en
   `lib/dashboard/date-range.ts`: en Paraguay (UTC−3) `toISOString()` devuelve el día anterior.

## Decisiones tomadas

- **Lo gastado se calcula, no se guarda.** No hay columna `spent` ni trigger que descuente: una
  función RPC suma `movements` por tipo y mes al momento de leer. La alternativa (guardar el saldo
  del presupuesto y descontarlo con un trigger sobre `movements`) es el mismo patrón de
  `accounts.current_balance`, con su costo ya documentado (restricción 3): el `UPDATE` de un
  movimiento tendría que revertir el viejo y aplicar el nuevo, y además **mover plata entre dos
  presupuestos distintos** cuando cambia el `movement_type_id` y **entre dos meses distintos** cuando
  cambia la `date`; y `bulkCreateMovements` (`lib/services/movements.client.ts`, upsert de 200 filas)
  dispararía el trigger fila por fila. Cualquier agujero en esa lógica queda como descuadre
  permanente. Contrapartida aceptada: cada lectura de la pantalla de presupuestos paga una
  agregación en Postgres en vez de leer una columna.
- **Lo que sí se guarda por mes es el límite**, en `budget_periods`. No es derivable: si en marzo el
  tope era 2.000.000 y hoy se baja a 1.000.000, el histórico de marzo tiene que seguir diciendo
  2.000.000. Esa tabla es además el lugar natural para un ajuste puntual de un mes ("en octubre me
  voy de viaje, subo Comida solo ese mes"). Contrapartida: hay filas que alguien tiene que crear
  cada mes → decisión siguiente.
- **Las filas del mes se crean de forma perezosa**, con una RPC (`ensure_budget_periods`) que corre
  al abrir la pantalla y rellena todos los meses faltantes de una. Contra `pg_cron`: no agrega
  infraestructura nueva, el job de `pg_cron` correría como `postgres` salteando la RLS, y en esta
  máquina no hay forma de probarlo en local (restricción 4). Contra derivar todo de una config
  versionada con `valid_from`/`valid_to`: esa opción no permite un ajuste puntual por mes y es más
  difícil de leer. Contrapartida aceptada: los meses existen recién cuando alguien abre la pantalla,
  y la creación de filas ocurre durante un render de Server Component (ver ⚠️ en el punto 3.2).
- **El presupuesto cuenta solo movimientos `debit`**, igual que `get_expenses_by_movement_type`. Así
  el número de "gasté en Comida este mes" es el mismo en el dashboard y en presupuestos. Se pierde:
  una devolución cargada como `credit` sobre el mismo tipo **no** devuelve presupuesto. Si eso
  molesta en el uso real, el cambio es una línea en dos RPC (`debit` → neto `debit − credit`), pero
  entonces hay que cambiar también el dashboard o aceptar que los dos números difieran.
- **El presupuesto es global, no por cuenta.** Un presupuesto es sobre en qué se gasta, no sobre con
  qué cuenta se pagó. Consecuencia concreta: **la pantalla de presupuestos no tiene filtro de
  cuenta** y las RPC de este plan no reciben `p_account_id`, a diferencia de las tres del dashboard.
- **Un presupuesto por tipo de movimiento por usuario** (único `(user_id, movement_type_id)`). Dos
  presupuestos sobre el mismo tipo no tienen semántica clara: ¿el tope es la suma, o el menor?
- **Pausar un presupuesto es `is_active = false`, no borrarlo.** Borrar se lleva el histórico
  (`ON DELETE CASCADE` de `budget_periods`), y eso es exactamente lo que esta feature existe para no
  perder. Consecuencia: `get_budget_status` **no** filtra por `is_active` — devuelve el flag y la UI
  muestra los pausados apagados al final. Si filtrara, un presupuesto pausado desaparecería de la
  pantalla y no habría forma de llegar a su histórico ni de reactivarlo.
- **El mes es siempre el mes calendario**, identificado por su día 1 (`period_month date`), igual que
  lo que devuelve `get_monthly_flow`. La pantalla no usa `DateRangeFilter` ni `resolveDateRange`: un
  presupuesto contra un rango arbitrario de fechas ("del 12 de marzo al 4 de mayo") no significa nada.

## Arquitectura

```
                       ┌──────────────────┐
                       │  movement_types  │  (global, sin user_id)
                       └────────▲─────────┘
                                │ movement_type_id
        user_id ┌───────────────┴──────┐
  auth.users ◄──┤       budgets        │  CONFIG: tope vigente, is_active
                └───────────▲──────────┘
                            │ budget_id (CASCADE)
                ┌───────────┴──────────┐
                │   budget_periods     │  HISTÓRICO: (mes, tope de ese mes)
                └──────────────────────┘     ← una fila por mes, creada por
                                               ensure_budget_periods()

  Lo gastado NO se guarda en ninguna de las dos. Sale de:

     movements (type='debit', movement_type_id, date dentro del mes)
       └─ join accounts → user_id     ← el scope de usuario, porque
                                        movements no tiene user_id

  Lectura de la pantalla:
     ensure_budget_periods(mes)  →  crea filas faltantes   (VOLATILE)
     get_budget_status(mes)      →  tope + gastado por presupuesto (STABLE)
     get_budget_history(id, n)   →  tope + gastado de los últimos n meses
```

Archivos nuevos:

```
supabase/migrations/<timestamp>_add_budgets.sql
lib/schemas/budgets.ts
lib/services/budgets.ts
lib/services/budgets.client.ts
lib/budgets/month.ts
components/ui/progress.tsx                 (via shadcn)
components/budgets/create-form.tsx
components/budgets/edit-form.tsx
components/budgets/delete-form.tsx
components/budgets/budget-progress.tsx
components/budgets/table.tsx
components/budgets/month-filter.tsx
components/budgets/totals.tsx
components/budgets/history-chart.tsx
app/protected/budgets/page.tsx
app/protected/budgets/create/page.tsx
app/protected/budgets/edit/[id]/page.tsx
app/protected/budgets/delete/[id]/page.tsx
app/protected/budgets/[id]/page.tsx
```

## Fase 1 — Primitivas

- [x] **1.1** `npx shadcn@latest add progress` → instala `components/ui/progress.tsx` (style
  `new-york`, base `neutral`, sin prefijo, según `components.json`). Es el único primitivo que falta;
  `card`, `table`, `input`, `label`, `button`, `select`, `skeleton` y `chart` ya están.

## Fase 2 — Base de datos

Toda la fase es **una sola migración**: `npx supabase migration new add_budgets`, y se escribe el SQL
a mano en el archivo que crea (restricción 4). Los puntos 2.1 a 2.7 son secciones de ese archivo, en
ese orden — tablas, índices, triggers, RLS, grants, funciones —, que es el orden de dependencias que
necesita un `CREATE` lineal.

> Las dos funciones de lectura siguen la misma forma que las tres del dashboard: **`security
> invoker`** (el default, y lo que hace que la RLS del usuario siga aplicando dentro de la función) y
> **`set search_path = ''`** con todo schema-calificado. ⚠️ `security definer` acá sería un agujero:
> la función correría con los permisos del dueño y devolvería los presupuestos y movimientos de
> **todos** los usuarios.

- [x] **2.1** Tabla `public.budgets` — la configuración.

  ```sql
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
  ```

  `numeric(15,2)` para igualar `movements.amount` y `accounts.current_balance`. `ON DELETE CASCADE`
  contra `movement_types` y no `RESTRICT`: un presupuesto sin tipo no significa nada. (En la práctica
  casi nunca se va a disparar, porque `movements.movement_type_id` es `ON DELETE RESTRICT` y un tipo
  con movimientos no se puede borrar.)

- [x] **2.2** Tabla `public.budget_periods` — el histórico del **tope**, un registro por mes.

  ```sql
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
  ```

  ⚠️ El `CHECK` que fuerza `period_month` al día 1 del mes no es decorativo: el único
  `(budget_id, period_month)` es lo que hace idempotente el `on conflict do nothing` del punto 2.6 y
  el `upsert` del punto 3.4. Si entra un `2026-03-15`, se crea una fila duplicada del mismo mes y el
  histórico empieza a mostrar dos filas de marzo. El `::timestamp` explícito es necesario para que la
  expresión sea inmutable y Postgres la acepte en un `CHECK`.

  ⚠️ **No hay columna `spent`.** Es la decisión central del plan. Si al implementar parece que falta,
  releé la primera viñeta de [Decisiones tomadas](#decisiones-tomadas) antes de agregarla.

- [x] **2.3** Triggers de `updated_at` en las dos tablas, reusando la función existente
  `public.update_updated_at()`:

  ```sql
  create trigger trigger_budgets_updated_at
    before update on public.budgets
    for each row execute function public.update_updated_at();

  create trigger trigger_budget_periods_updated_at
    before update on public.budget_periods
    for each row execute function public.update_updated_at();
  ```

  Son los únicos triggers de esta feature. Regla vigente de
  [`docs/database.md`](../database.md#reglas-para-la-aplicación): nunca escribir `updated_at` desde
  la app.

- [x] **2.4** RLS. `budgets` con pertenencia **directa**; `budget_periods` con pertenencia
  **indirecta** vía `EXISTS` contra `budgets`, el mismo modelo que `movements` contra `accounts`
  (restricción 6). Siempre `(select auth.uid())`, nunca `auth.uid()` pelado, y `with_check` en los
  dos `INSERT`.

  ```sql
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
  ```

  ⚠️ Una política de `budget_periods` que solo referencie columnas de `budget_periods` **no está
  scopeando por dueño** — es el mismo error que sería posible en `movements`. La subconsulta es
  obligatoria.

- [x] **2.5** Grants, en el mismo estilo que las tablas existentes:

  ```sql
  grant delete, insert, references, select, trigger, truncate, update
    on table public.budgets to anon, authenticated, postgres, service_role;
  grant delete, insert, references, select, trigger, truncate, update
    on table public.budget_periods to anon, authenticated, postgres, service_role;
  ```

  Los grants no aflojan nada: con RLS activada y políticas que exigen `auth.uid()`, `anon` no ve
  ninguna fila (ver [`docs/database.md`](../database.md#4-to-public-no-es-lo-mismo-que-público)).

- [x] **2.6** Función `ensure_budget_periods(p_month date)` — crea las filas de período que falten.

  ```sql
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
  ```

  ⚠️ Los dos límites del `generate_series` son el punto delicado, y las dos direcciones importan:

  - **Piso = el mes en que se creó el presupuesto.** Sin eso, abrir el histórico de un mes anterior
    a la creación del presupuesto inventaría filas retroactivas con el tope de hoy — o sea,
    fabricaría histórico falso, que es justo lo contrario de para qué existe la tabla.
  - **Techo = el mes actual** (de ahí el `least`). Sin eso, navegar a un mes futuro congelaría hoy
    el tope de un mes que todavía no pasó, y editar el presupuesto después ya no lo afectaría.
    Para un mes futuro sin fila, `get_budget_status` cae al tope configurado (el `coalesce` del
    punto 2.7), que es lo correcto: es una proyección, no un registro.

  Es la única función `VOLATILE` del repo — las tres del dashboard son `STABLE` — porque escribe.
  Filtra `is_active`: un presupuesto pausado no acumula meses.

- [x] **2.7** Función `get_budget_status(p_month date)` — el estado del mes, una fila por
  presupuesto.

  ```sql
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
  ```

  Notas de diseño que no se leen del SQL:

  - **No filtra `is_active`**, lo devuelve como columna. Ver la decisión correspondiente: filtrarlo
    haría desaparecer los presupuestos pausados de la pantalla, sin forma de llegar a su histórico ni
    de reactivarlos.
  - El `join accounts` **es el scope de usuario** de lo gastado, porque `movements` no tiene
    `user_id` (restricción 6). No es un join decorativo: sacarlo suma los movimientos de todos los
    usuarios.
  - `m.date >= inicio and m.date < inicio + 1 mes`, no `between` con fin de mes calculado: evita
    tener que pensar en febrero y en los meses de 31 días.
  - `solo type = 'debit'`, por la decisión de arriba.

- [x] **2.8** Función `get_budget_history(p_budget_id uuid, p_months integer)` — el histórico de un
  presupuesto.

  ```sql
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
  ```

  ⚠️ Esta función lee `bp.amount` directo, **sin `coalesce` contra `b.amount`**: el histórico tiene
  que mostrar el tope que regía en ese mes, no el actual. Es la diferencia de fondo con 2.7 y la
  razón por la que `budget_periods` existe. **No unificar las dos funciones.**

  No filtra `is_active`: el histórico de un presupuesto pausado se sigue pudiendo consultar.

- [x] **2.9** Aplicar: `npx supabase db push --linked --dry-run` primero y **leer la salida**, después
  `npm run db:push`, después `npm run db:pull`, después `npm run db:types`, y commitear
  `supabase/schemas/**` + `lib/supabase/database.types.ts` junto con la migración. ⚠️ Esto va directo
  contra producción, no hay staging (restricción 4). ⚠️ `db:types` usa `>`, que trunca el archivo
  antes de correr: si falla (token vencido, red caída) el archivo queda vacío y el build se rompe —
  la solución es volver a correr el comando, no editar el archivo a mano.

## Fase 3 — Schemas y servicios

Depende de la Fase 2 completa: sin los tipos regenerados de 2.9, `.rpc("get_budget_status", …)` no
tipa.

- [x] **3.1** `lib/schemas/budgets.ts` — a mano con Zod, como el resto de `lib/schemas/*`
  (no derivar de los tipos generados; el porqué está en [`docs/supabase.md`](../supabase.md)):

  - `budgetSchema` = `{ movement_type_id: z.uuid("Tipo de movimiento inválido"), amount: z.int().positive("El monto debe ser un número entero positivo"), is_active: z.boolean() }`. `z.int()` para
    igualar `movementSchema`, que ya trata los guaraníes como enteros.
  - `createBudget = z.infer<typeof budgetSchema>`.
  - `Budget` = `{ id, user_id, movement_type_id, amount, is_active, created_at, updated_at, movement_types: Pick<MovementType, "name" | "color"> }` — la forma joineada que devuelve el
    servicio, igual que `Movement` embebe `accounts` y `movement_types`.
  - `BudgetStatus` = `{ budget_id, movement_type_id, name, color, amount_limit, spent, is_active }` +
    los derivados que calcula el servicio: `remaining` (`amount_limit - spent`, puede ser negativo) y
    `percentage` (`spent / amount_limit * 100`).
  - `BudgetHistoryRow` = `{ period_month, monthLabel, amount_limit, spent, remaining }`.
  - `BudgetFilter` = `{ month: string | undefined }` (`YYYY-MM`).

- [x] **3.2** `lib/services/budgets.ts` — **server-only** (`createClient` de `lib/supabase/server`),
  con `supabase.auth.getUser()` y `.eq("user_id", …)` como el resto:

  - `getBudgets()` → lista para la tabla de configuración, con
    `select("…, movement_types!inner(name,color)")` y orden por `movement_types(name)`.
  - `getBudgetById(id)` → para las páginas de edit/delete/histórico; devuelve `null` cuando
    `error.details === notFoundDetailMessage` (patrón de `lib/constants.ts`).
  - `getBudgetStatus(month)` → llama **primero** `ensure_budget_periods` y **después**
    `get_budget_status`, y agrega `remaining` y `percentage` a cada fila.
  - `getBudgetHistory(id, months = 12)` → llama `get_budget_history` y agrega `monthLabel` y
    `remaining`.

  ⚠️ El orden de las dos RPC en `getBudgetStatus` no se puede invertir: si `get_budget_status` corre
  antes, el mes en curso todavía no tiene fila y el tope sale del `coalesce` contra `b.amount` — no se
  rompe nada visible, pero el mes nunca queda registrado en el histórico y el bug aparece meses
  después, cuando se cambie el tope.

  ⚠️ `ensure_budget_periods` **escribe** durante el render de un Server Component. Hoy funciona
  porque la página es dinámica (tiene `searchParams`). Si alguna vez se envuelve esta lectura en un
  cache de Next, la escritura deja de correr o corre una sola vez: no cachear `getBudgetStatus`.

- [x] **3.3** `lib/services/budgets.client.ts` — **client-only** (`createClient` de
  `lib/supabase/client`), con `safeParse` previo aunque el form ya haya validado:
  `createBudget(params)`, `updateBudgetClient(id, params)`, `deleteBudget(id)`.

- [x] **3.4** `updateBudgetClient` también reescribe la fila de `budget_periods` **del mes en curso**
  con el monto nuevo, vía
  `upsert({ budget_id, period_month, amount }, { onConflict: "budget_id,period_month" })`.

  ⚠️ **Solo el mes en curso, nunca los meses pasados.** Editar el tope hoy tiene que verse reflejado
  en el mes que se está viviendo, pero reescribir marzo destruye el histórico, que es el objetivo de
  la feature. ⚠️ El `onConflict` depende del único `(budget_id, period_month)` del punto 2.2: sin esa
  restricción, PostgREST rechaza el `upsert`.

  El mes en curso se calcula en hora local con el helper de 3.5, no con `toISOString()`
  (restricción 8): un `upsert` el día 1 a las 22:00 en Paraguay escribiría el mes siguiente.

- [x] **3.5** `lib/budgets/month.ts` — helpers de mes calendario, en hora local:
  `resolveMonth({ month })` (default: mes actual, formato `YYYY-MM`), `monthToDate(month)`
  (`YYYY-MM-01`, lo que reciben las RPC), `shiftMonth(month, delta)` (para la navegación de 4.6),
  `getMonthLabel(month)` (`"Octubre 2026"`) y `isCurrentMonth(month)`.

  No reusar `resolveDateRange` de `lib/dashboard/date-range.ts`: devuelve un rango y acá el dominio
  es un mes calendario (ver la última decisión). Tampoco reusar `MONTH_LABELS` de
  `lib/services/dashboard.ts`: es privado de ese módulo y son abreviaturas (`Ene`, `Feb`) — acá hace
  falta el nombre completo.

## Fase 4 — Componentes (`components/budgets/`)

- [x] **4.1** `create-form.tsx` — `"use client"`, `react-hook-form` + `zodResolver(budgetSchema)`,
  con `MovementTypeSelect` y `AmountInput` (ambos ya existen). Al terminar,
  `revalidateMyDataAndRedirect("/protected/budgets")`.

  ⚠️ El único `(user_id, movement_type_id)` de 2.1 hace fallar el insert si ya hay un presupuesto
  para ese tipo. Hay que mostrar un mensaje entendible ("Ya existe un presupuesto para este tipo de
  movimiento") en vez del error crudo de Postgres.

- [x] **4.2** `edit-form.tsx` — mismo esquema, precargado, más el checkbox de `is_active` (primitivo
  `checkbox` ya instalado) con una ayuda que explique que pausar conserva el histórico. Llama a
  `updateBudgetClient` (3.4).

- [x] **4.3** `delete-form.tsx` — molde de `components/movement-types/delete-form.tsx`. ⚠️ El texto
  tiene que decir que el borrado **se lleva todo el histórico** del presupuesto (`ON DELETE CASCADE`
  de 2.2) y que para dejar de usarlo sin perder el histórico está pausarlo.

- [x] **4.4** `budget-progress.tsx` — la barra: `Progress` (1.1) con el color del tipo de movimiento,
  y debajo gastado / tope / restante con `formatCurrency`. Tres estados, porque el caso interesante
  es justamente el que se sale del rango normal:

  - normal — barra con el color del tipo;
  - cerca del tope (≥ 80 %) — barra ámbar;
  - excedido (`spent > amount_limit`) — barra roja **al 100 %** y el restante en negativo y en rojo.

  ⚠️ `Progress` clampea el valor: si se le pasa 130 dibuja igual una barra llena, así que el exceso
  hay que comunicarlo con el color y el número, no con el largo de la barra. ⚠️ Con `amount_limit`
  en 0 el porcentaje divide por cero — no puede pasar por el `CHECK (amount > 0)`, pero el cálculo
  igual tiene que defenderse.

  Un presupuesto con `is_active = false` se renderiza apagado, con un `Badge` "Pausado" y sin barra.

- [x] **4.5** `table.tsx` — Server Component `async` que llama `getBudgetStatus(month)` y renderiza
  una fila por presupuesto: swatch + nombre del tipo, tope, gastado, restante, la barra de 4.4, y
  acciones (histórico / editar / eliminar), con el mismo estilo de links-icono de
  `components/movement-types/table.tsx`. Los pausados van al final. Estado vacío: "No hay
  presupuestos configurados aún."

- [x] **4.6** `month-filter.tsx` — `"use client"`: botones mes anterior / mes siguiente,
  `<input type="month">` y un botón "Mes actual". Escribe `?month=YYYY-MM` en la URL con
  `router.push`, igual que `components/movements/filters.tsx`. Usa `shiftMonth` de 3.5.

- [x] **4.7** `totals.tsx` — Server Component con tres cards (total presupuestado / total gastado /
  restante del mes), al estilo de `components/movements/totals.tsx`.

  ⚠️ Acá **sí** se suma en JS, y es correcto: las filas que suma son las que ya agregó
  `get_budget_status` (una por presupuesto, decenas como máximo), no filas crudas de `movements`. El
  límite de 1000 filas de la restricción 2 no aplica. Dejar esto escrito en un comentario en el
  archivo, porque contradice a primera vista la regla de `CLAUDE.md`.

- [x] **4.8** `history-chart.tsx` — `"use client"` con `ChartContainer` (`components/ui/chart.tsx`):
  barras verticales de tope vs gastado, un par por mes, con `formatCompactAmount` en el eje Y. Solo
  dibuja datos ya agregados que recibe por props, como el resto de los gráficos del repo. Verticales
  y no horizontales, al revés que `expenses-by-type-chart.tsx`: acá las etiquetas del eje X son
  meses (`Oct 2026`), que son cortos.

## Fase 5 — Páginas y rutas

- [x] **5.1** `app/protected/budgets/page.tsx` — lee `searchParams.month`, lo resuelve con
  `resolveMonth` (3.5), y renderiza: título + botón "Nuevo", `month-filter` (4.6), `totals` (4.7) en
  un `<Suspense fallback={null}>` y `table` (4.5) en un `<Suspense fallback={<TableSkeleton />}>`.
  Mismo armado que `app/protected/movements/page.tsx`.

- [x] **5.2** `create/page.tsx`, `edit/[id]/page.tsx` y `delete/[id]/page.tsx` — wrappers finos con
  `FormContainer`; edit y delete resuelven el registro con `getBudgetById` y llaman `notFound()` si
  no existe, igual que las páginas de `movement-types`.

- [x] **5.3** `app/protected/budgets/[id]/page.tsx` — histórico de un presupuesto: `getBudgetById` +
  `getBudgetHistory(id, 12)`, el gráfico de 4.8 y una tabla mes por mes (mes, tope, gastado,
  diferencia) con la diferencia en verde si sobró y en rojo si se excedió. Usa `FormContainer` con
  `wide` para aprovechar el ancho.

  ⚠️ Solo aparecen los meses que tienen fila en `budget_periods`. Con `ensure_budget_periods`
  rellenando desde el mes de creación (2.6) eso cubre todo el historial real, pero un presupuesto
  recién creado muestra **un solo mes**, y eso está bien: no hay histórico que mostrar todavía. El
  estado vacío del gráfico tiene que decirlo en vez de dibujar un gráfico de una barra.

  ⚠️ La ruta `[id]` convive con `create`, `edit` y `delete` bajo `/protected/budgets`. Next resuelve
  primero los segmentos estáticos, así que no hay conflicto — pero no agregar un
  `/protected/budgets/history` más adelante sin revisar esto.

- [x] **5.4** Entrada "Presupuestos" en `navItems` de `components/sidebar.tsx`, con `href`
  `/protected/budgets` e icono `Target` de lucide, después de "Tipos de movimientos".

## Fase 6 — Integración con lo existente _(toda la fase es opcional)_

Esta fase no la pidió el usuario: son agregados propuestos al planificar. Nada de la Fase 5 depende
de ella, y se puede saltear completa.

- [ ] **6.1** _(opcional, no hecho: no se pidió)_ Card "Presupuestos del mes" en `app/protected/page.tsx`: las 4 barras más
  cargadas del mes actual + link a `/protected/budgets`. ⚠️ El dashboard filtra por rango de fechas
  arbitrario y esta card es de mes calendario — el título tiene que decir "del mes" explícitamente,
  igual que "Distribución del saldo actual" aclara que ignora el filtro.

- [ ] **6.2** _(opcional, no hecho: no se pidió)_ En `components/movements/create-form.tsx`, al elegir un tipo con
  presupuesto y `type = 'debit'`, mostrar "Te quedan Gs. X de <Tipo> este mes". ⚠️ Puramente
  informativo: no bloquea, no deshabilita el botón y no valida nada. Un presupuesto excedido no puede
  impedir cargar un movimiento — es requisito explícito.

## Fase 7 — Cierre

- [x] **7.1** `npm run lint` y `npm run build`. Donde suele romper: los tipos de `.rpc(...)`, que
  salen de `lib/supabase/database.types.ts` — si `db:types` (2.9) no corrió o quedó truncado, el
  build falla acá.

- [ ] **7.2** _(pendiente: requiere sesión logueada en un navegador, que no tuve; ver Notas de cierre)_ Probar los bordes, logueado en la app:

  1. Mes sin ningún movimiento del tipo → gastado 0, barra vacía, restante = tope.
  2. Presupuesto creado a mitad de mes → cuenta los movimientos de **todo** el mes, no solo los
     posteriores a la creación.
  3. Excederse → restante negativo y en rojo, barra roja al 100 %, y el movimiento se carga igual.
  4. Editar el tope → cambia el mes actual; abrir un mes anterior y confirmar que **no** cambió.
  5. Borrar un movimiento del mes → el gastado baja al recargar.
  6. Cambiarle el `movement_type_id` a un movimiento → el gastado se mueve de un presupuesto al otro
     (el caso que un trigger habría tenido que manejar a mano).
  7. Cambiarle la fecha a un movimiento a otro mes → el gastado se mueve de mes.
  8. `is_active = false` → aparece apagado y con badge, no acumula meses nuevos, su histórico sigue
     accesible.
  9. Navegar a un mes futuro → proyección con el tope configurado, gastado 0, y **sin** crear fila.
  10. Navegar a un mes anterior a la creación del presupuesto → no aparece, y no se inventan filas.
  11. Importar un extracto (`/protected/movements/import`) → el gastado queda al día sin tocar nada.
  12. Crear un segundo presupuesto para un tipo que ya tiene uno → mensaje claro, no error crudo.
  13. Un mes con 28 y uno con 31 días → el límite superior del rango no se come ni agrega días.

- [ ] **7.3** _(pendiente: requiere navegador, mobile y dark mode; ver Notas de cierre)_ Verificar en mobile y en dark mode: la barra de progreso, los tres estados de color de
  4.4 y el gráfico de 4.8 (Recharts en dark mode ya dio problemas en este repo — ver el commit
  "Fix: Dark mode error").

- [x] **7.4** Documentar en [`docs/database.md`](../database.md): las dos tablas nuevas, las tres RPC
  en la tabla de funciones, el modelo de pertenencia (`budgets` directo, `budget_periods` indirecto y
  por qué), y una sección explicando **por qué no hay trigger de descuento de presupuesto**, con el
  link a "El saldo es incremental, no calculado". Ese último párrafo es el que evita que alguien
  "complete" la feature agregando el trigger.

- [x] **7.5** Agregar a `CLAUDE.md` la sección del módulo de presupuestos: la estructura de archivos,
  la regla de que lo gastado se calcula por RPC y nunca se guarda, y que el mes es siempre calendario
  (no usa `DateRangeFilter`).

- [x] **7.6** Verificar la RLS de las dos tablas como indica
  [`docs/database.md`](../database.md#cómo-verificar): las dos queries sobre `pg_class` /
  `pg_policies`, y el `curl` sin sesión con la publishable key contra `/rest/v1/budgets` y
  `/rest/v1/budget_periods`. ⚠️ Probar las RPC desde el SQL editor de Supabase **no** valida nada de
  seguridad: ahí se corre como `postgres` y la RLS se bypassea.

- [x] **7.7** Notas de cierre al final de este documento.

## Fuera de alcance

- **Trigger que descuente el presupuesto y columna `spent`** — descartado a propósito, con el
  razonamiento completo en [Decisiones tomadas](#decisiones-tomadas). Es el punto que más probable
  es que alguien re-agregue "para completar la feature". No hacerlo sin volver a discutir la decisión.
- **Arrastre del sobrante al mes siguiente** (rollover). El requisito es explícito: al pasar el mes
  el presupuesto **vuelve a su valor**. Si alguna vez se quiere, `budget_periods` es el lugar: una
  columna `carried_over` que `ensure_budget_periods` calcule del mes anterior.
- **Bloquear o advertir de forma modal al cargar un movimiento que excede el presupuesto.** Requisito
  explícito: nunca bloquea. Lo más cercano permitido es el aviso informativo del punto 6.2, que es
  opcional.
- **Presupuestos por cuenta.** Ver la decisión correspondiente. Entraría como `account_id` en
  `budgets` (cambiando el único a tres columnas) y un `p_account_id` en las dos RPC de lectura.
- **Presupuestos de ingresos (metas de ahorro / de facturación).** Solo `debit`. Un tope sobre
  ingresos es otro concepto (una meta, que se quiere superar, no un límite que no se quiere pasar) y
  necesitaría invertir toda la semántica de colores de 4.4.
- **Presupuestos con otra periodicidad** (semanal, quincenal, anual). `period_month date` con el
  `CHECK` al día 1 cierra la puerta a propósito: el requisito es mensual y un modelo genérico de
  períodos cuesta el triple y no se va a usar.
- **Notificaciones o emails al acercarse al tope.** No hay infraestructura de notificaciones en el
  repo y no se pidió.
- **Presupuesto por defecto para tipos sin presupuesto configurado.** Un tipo sin presupuesto
  simplemente no aparece en la pantalla.

El usuario revisó los puntos, respondió las cuatro decisiones bloqueantes tomando las opciones
recomendadas y **no eliminó ningún punto**. La Fase 6 quedó marcada como opcional por decisión de
quien escribió el plan, no por poda del usuario.

## Riesgos conocidos

1. **La Fase 2 se aplica contra producción.** No hay staging ni base local (sin Docker), y
   `db:push` es irreversible sin escribir una migración de rollback a mano. Mitigación:
   `--dry-run` obligatorio y leer la salida antes de confirmar (punto 2.9). Las dos tablas son
   nuevas y las tres funciones también, así que el peor caso es dejar objetos huérfanos; nada de lo
   que ya funciona se modifica.
2. **La migración baseline del repo no está verificada** (`docs/supabase.md`). Esta migración se suma
   a ese historial sin poder probarse con `supabase db reset`. No introduce riesgo nuevo, pero tampoco
   se puede validar la reconstrucción desde cero.
3. **Este plan no modifica ninguna tabla, trigger ni función existente.** Solo agrega. Lo único
   compartido que toca es `components/sidebar.tsx` (punto 5.4) y, si se hace la Fase 6 opcional,
   `app/protected/page.tsx` y `components/movements/create-form.tsx`. Verificación de no-regresión:
   que `/protected`, `/protected/movements` y `/protected/movement-types` sigan cargando y que los
   totales del dashboard no cambien.
4. **Un usuario ajeno puede borrar un tipo de movimiento y llevarse presupuestos con él.**
   `movement_types` es global y editable por cualquier autenticado (restricción 1), y el FK es
   `ON DELETE CASCADE`. Es la misma exposición que ya tiene la app hoy, no algo que agregue este
   plan; se resuelve el día que `movement_types` tenga `user_id`, que es cambio de modelo.
5. **`date_trunc('month', b.created_at)` en el punto 2.6 depende del `TimeZone` de la sesión de
   Postgres** (UTC en Supabase), mientras el resto de la app calcula meses en hora local de Paraguay.
   Un presupuesto creado después de las 21:00 del último día del mes puede quedar anclado al mes
   siguiente, y ese mes no se rellenaría en el histórico. Es un caso de borde de tres horas por mes y
   solo afecta al mes de creación. Si molesta, la corrección es guardar el mes de alta en una columna
   propia en vez de derivarlo de `created_at`.
6. **Rendimiento del `left join lateral` con muchos movimientos.** Cada fila de presupuesto dispara
   una agregación sobre `movements` filtrada por tipo y rango de fecha. `idx_movements_type` e
   `idx_movements_date` existen, pero no hay índice compuesto `(movement_type_id, date)`. Con el
   volumen de una app personal no debería notarse; si se nota, ese índice es la primera medida.

## Notas de cierre

**Hecho (2026-09-25/26).** Fases 1 a 5 completas, 7.1 (build), 7.4, 7.5, 7.6. La migración
`20260926002103_add_budgets.sql` se aplicó a producción tras leer el `--dry-run` (solo listaba esa
migración); después `db:pull` y `db:types`. `db:pull` no tocó ningún esquema existente: solo agregó los
archivos de `budgets`, `budget_periods` y las tres funciones. El SQL es el del plan, sin cambios.

**Desvíos del plan:**
- `npx shadcn add progress` agregó al `package.json` una dependencia espuria (`cn`) y generó
  `import { cn } from "cn"`. Se desinstaló la dependencia y el import pasó a `@/lib/utils`, como el resto
  de `components/ui/`.
- Se agregó `components/budgets/budget-form-fields.tsx` (no estaba en la lista de archivos): campos
  compartidos por create y edit, en vez de duplicarlos, siguiendo la regla de CLAUDE.md de componentes
  reutilizados en más de un form.
- El duplicado `(user_id, movement_type_id)` se detecta en el form buscando el nombre del constraint
  (`budgets_user_movement_type_key`) en el mensaje de error de Postgres, exportado como
  `duplicateBudgetMessage` desde `budgets.client.ts`. Es frágil si se renombra el constraint.
- `getBudgetStatus` se llama dos veces por render (tabla y totales). `ensure_budget_periods` es
  idempotente, así que es seguro, pero son dos pasadas de las RPC.

**Sin hacer:** Fase 6 (opcional), 7.2 y 7.3.

**Verificado:** `npm run build` pasa (todas las rutas nuevas compilan y tipan contra los tipos
regenerados); `eslint` limpio sobre los archivos nuevos. RLS: `pg_class`/`pg_policies` muestran RLS activa
y 4 políticas por tabla, con `(select auth.uid())` en `qual` y `with_check` en los `INSERT`. Con la
publishable key y sin sesión, `/rest/v1/budgets` y `/rest/v1/budget_periods` devuelven `[]`,
`get_budget_status` devuelve `[]` y `ensure_budget_periods` devuelve `0`.

**No se pudo verificar:**
- **Los 13 casos de 7.2 y el mobile/dark mode de 7.3.** Nunca se ejecutó la pantalla logueada. Las RPC se
  probaron solo sin sesión, o sea que no está probado el cálculo de `spent`, la creación perezosa de
  períodos ni el `upsert` del mes en curso con datos reales.
- Los `[]` de 7.6 no son concluyentes por sí solos: las tablas están vacías, así que un `[]` sería igual
  con RLS rota. Lo que respalda la RLS es la inspección de las políticas. Para cerrarlo, repetir el `curl`
  cuando haya un presupuesto cargado.
- `lint` global (`npm run lint`) falla por miles de errores en archivos minificados generados (no del
  repo); no se investigó de dónde salen.
- La sintaxis de `generate_series(date, date, interval)` en 2.6 se aplicó sin error, pero su resultado
  (que devuelva meses correctos, en zona UTC de la sesión) tampoco se probó con datos.
