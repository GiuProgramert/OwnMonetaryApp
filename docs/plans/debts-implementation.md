# Plan: control de deudas (servicios mensuales y pagos en cuotas)

**Fecha:** 2026-09-27
**Estado:** implementado (Fases 1–5.1, 5.4–5.6); pendiente de probar a mano en la app (5.2, 5.3)

## Objetivo

Poder registrar las deudas que se pagan todos los meses — **servicios** (sin fin definido) y
**pagos en cuotas** (con un total de cuotas) —, pagarlas desde la app eligiendo la cuenta de la que
sale la plata, y ver por cada deuda cuánto se pagó, cuántas cuotas faltan, cuánto queda por pagar y
cuándo vence la próxima. Cada pago es un movimiento `debit` normal de la cuenta elegida, vinculado a
la deuda, con el tipo de movimiento de la deuda. El dashboard muestra como recordatorio las deudas
que están por vencer o ya vencieron.

## Cómo ejecutar este plan

> - **Verificá antes de arrancar que lo que este plan afirma del código siga siendo cierto.** Tiene
>   fecha; los archivos, funciones y componentes que nombra pueden haber cambiado desde entonces.
> - **Seguí el orden de las fases.** Cada una se apoya en la anterior; donde el orden no importa,
>   está dicho.
> - **Si la realidad contradice al plan, pará y preguntá.** Un plan equivocado en un punto se
>   corrige en dos minutos; una solución improvisada alrededor del error se descubre semanas después.
> - **No amplíes el alcance.** Lo que no está en un punto, no entra — y lo que está en *Fuera de
>   alcance* se descartó a propósito, con motivo. Si algo parece faltar, preguntá antes de agregarlo.
> - **Respetá los puntos marcados *(opcional)*:** son opcionales de verdad.
> - **Marcá `[x]` a medida que avanzás** y actualizá el **Estado** del encabezado. Un punto que
>   quede sin hacer se deja en `[ ]` con el motivo escrito ahí mismo — nunca se borra.
> - **Al terminar, escribí las Notas de cierre** al final del documento: qué se desvió del plan y
>   por qué, qué quedó sin hacer, qué se verificó y **qué no se pudo verificar**. Lo último es lo
>   más valioso de la sección y lo primero que se omite.

## Contexto

### Lo que ya existe y hay que reusar

- **El módulo `transfers`** (`lib/services/transfers.client.ts`,
  `supabase/schemas/public/functions/create_transfer.sql`) — el molde para escribir `movements`
  desde una RPC `security invoker` con `set search_path = ''` que valida pertenencia y lanza
  `raise exception` con mensaje en español. `create_debt_payment` (1.4) copia ese estilo.
- **El módulo `budgets`** — el molde para: una tabla con `user_id` directo y sus cuatro políticas
  (`supabase/schemas/public/tables/budgets.sql`), una RPC de estado que agrega al leer
  (`get_budget_status`), una página de detalle `[id]` (`app/protected/budgets/[id]/page.tsx`), una
  tarjeta de dashboard que no sigue los filtros (`components/dashboard/budgets-card.tsx`) y una
  tabla que manda los inactivos al final (`components/budgets/table.tsx`).
- **`MOVEMENT_COLUMNS`** (`lib/services/movements.ts`) — la proyección de movimientos con
  `accounts!inner` y `movement_types!inner`; `getMovementsByDebt` (2.4) la reusa.
- **Componentes:** `FormContainer`, `RecordCard` (tarjeta mobile de una fila de tabla),
  `TableSkeleton`, `AmountInput` (`components/movements/amount-input.tsx`), `AccountSelect`,
  `MovementTypeSelect`, y los primitivos `Select`, `Input`, `Badge`, `Card`, `Table`,
  `DropdownMenu` de `components/ui/`. **No hace falta agregar ningún primitivo de shadcn.**
- **Helpers:** `nowForInput` / `formatMovementDate` (`lib/movements/datetime.ts`),
  `formatCurrency` (`lib/dashboard/format.ts`), `getMonthLabel` (`lib/budgets/month.ts`),
  `getPrimaryAccountId` (`lib/accounts/primary.ts`), `revalidateMyDataAndRedirect`
  (`lib/services/revalidate.ts`).
- **`getMovementTypes()`** (`lib/services/movement-types.ts`) ya excluye el tipo `Transferencia`;
  el select de tipo de la deuda lo usa tal cual.
- **`docs/supabase.md`** — `migration new` → editar a mano → `db:push --dry-run` → `db:push` →
  `db:pull` → `db:types` es el único camino para cambiar el esquema en esta máquina.

### Restricciones que condicionan el diseño

1. **Lo que se calcula no se guarda.** `docs/database.md` lo explica para
   `accounts.current_balance` y para los presupuestos: un valor guardado y ajustado a mano o por
   trigger queda descuadrado para siempre cuando alguien edita o borra un movimiento por otro
   camino (acá: desde `/protected/movements`). Monto pagado, cuotas pagadas, próximo vencimiento y
   "finalizada por cuotas" **se calculan al leer**, en la RPC 1.3.
2. **Toda agregación va por RPC, no sumando filas en JS** (`CLAUDE.md`, módulo Dashboard):
   PostgREST corta en 1000 filas. Y **toda agregación nueva sobre `movements` excluye
   `transfer_id is not null`** (`CLAUDE.md`, Transfers, regla 1).
3. **`movements` no tiene `user_id`**: su RLS resuelve la pertenencia por `accounts`. Una FK
   `movements.debt_id` no valida que la deuda sea del mismo usuario (las FK no pasan por RLS). Por
   eso el pago se crea solo por RPC (1.4), que valida la deuda y la cuenta.
4. **`movements.movement_type_id` es `NOT NULL`** y `movements.type` solo admite
   `'credit'`/`'debit'`. Un pago es un `debit` con el tipo de la deuda, que por eso es obligatorio.
5. **Los pagos de deudas son gastos comunes**: cuentan en `get_movements_totals`,
   `get_expenses_by_movement_type`, `get_monthly_flow` y en los presupuestos del tipo. Es lo
   correcto (pagar la luz es un gasto) y **no hay que excluirlos** de ninguna agregación existente.
6. **`components/mobile-nav.tsx` tiene `grid-cols-5` fijo con exactamente 5 ítems.** Agregar un
   sexto a `navItems` sin tocarlo rompe la barra inferior en móvil.
7. **`movementSchema` no tiene `debt_id`, y `updateMovement` hace `.update(parsed.data)`.** Como
   `debt_id` no está en el payload, editar un pago desde `/protected/movements` **conserva** el
   vínculo. Si alguien agrega `debt_id` al schema con default `null`, editar un pago lo desvincula
   en silencio.
8. **`AmountInput` no acepta `disabled`** (solo `id`, `value`, `onChange`).
9. **"Hoy" se calcula con `new Date()` del runtime**, igual que `resolveMonth` en
   `lib/budgets/month.ts`. En un server en UTC, entre las 21:00 y las 24:00 de Paraguay "hoy" ya es
   mañana. Es el mismo comportamiento que ya tiene el resto de la app; ver *Riesgos*.

## Decisiones tomadas

- **Próximo vencimiento = `first_due_date + (cantidad de pagos registrados) meses`, calculado.**
  La deuda guarda solo `first_due_date` (el vencimiento de la primera cuota o período que se va a
  pagar desde la app). No se guarda una `next_due_date` que la RPC de pago adelante: editar o
  borrar el pago desde `/protected/movements` no la volvería atrás (restricción 1). Así, borrar un
  pago lo "des-paga" solo. **Contrapartida:** un pago equivale a un mes. Pagar dos meses en un solo
  movimiento cuenta como uno (hay que registrar dos pagos), y un mes salteado deja la deuda vencida,
  lo cual es correcto.
- **"Finalizada" = `is_finished` (manual) o cuotas pagadas ≥ total, calculado en la RPC.** La
  columna `is_finished` se marca a mano: para servicios, o para cancelar un préstamo antes de
  tiempo. En las deudas en cuotas, llegar al total la finaliza sin escribir nada, y borrar la última
  cuota la reabre sola. Se descartó un trigger que marque y desmarque la columna: tendría que
  cubrir insert, update (incluso cambio de `debt_id`) y delete, con el mismo riesgo de descuadre
  que el saldo.
- **El tipo de movimiento de la deuda es obligatorio.** Todo movimiento necesita tipo
  (restricción 4), y así el pago sale sin preguntar nada más. Contrapartida: no hay deudas "sin
  categoría".
- **El vínculo es una columna `movements.debt_id`, no una tabla intermedia `debt_payments`.** Un
  movimiento paga a lo sumo una deuda, y la columna reusa el trigger de saldo, la RLS de
  `movements` y `MOVEMENT_COLUMNS` sin agregar nada.
- **Borrar una deuda no borra sus movimientos (`ON DELETE SET NULL`).** La plata salió de la
  cuenta de verdad; con `CASCADE`, borrar la deuda revertiría saldos. Los pagos quedan como gastos
  sueltos. El form de borrado lo avisa (3.3).
- **"Monto pagado" suma solo los pagos registrados en la app.** Las cuotas pagadas antes de cargar
  la deuda (`initial_paid_installments`) cuentan como cuotas pagadas, pero no como monto: no hay
  movimiento del que sacar cuánto fueron.
- **Con monto fijo, el monto del pago se bloquea solo en el formulario (3.4).** La RPC no lo impone,
  así que un recargo excepcional se corrige editando el movimiento. Con monto variable, el monto de
  la deuda es la base precargada y editable.
- **Las cuotas se cargan como "cuotas pendientes hoy", no como "cuotas ya pagadas".** El usuario
  sabe cuánto debe. Se guarda `initial_paid_installments = total − pendientes − pagos registrados`
  (en el alta, pagos registrados = 0).
- **Navegación móvil: 4 ítems fijos + un botón "Más" que abre un menú tipo burbuja con el resto**,
  en vez de agregar un sexto botón a la barra. Escala a futuros módulos sin volver a tocar la barra.
  En desktop, el sidebar muestra todo, como hoy.
- **La tarjeta de vencimientos del dashboard muestra las vencidas y las que vencen en los próximos 7
  días, y no sigue los filtros de cuenta ni de fecha.** Igual que `BudgetsCard`: un recordatorio
  que desaparece al cambiar el filtro de cuenta no sirve como recordatorio.
- **El detalle de la deuda lista todos sus pagos sin paginación.** Una deuda tiene decenas de
  pagos (un servicio de 10 años son 120), muy lejos del límite de 1000 filas.

## Arquitectura

```
debts (config)                         movements
┌────────────────────────────┐        ┌──────────────────────────────┐
│ kind, amount_mode, amount  │ 1    N │ debt_id  → debts.id          │
│ movement_type_id           │◄───────│   (ON DELETE SET NULL)       │
│ first_due_date             │        │ type = 'debit'               │
│ total_installments         │        │ movement_type_id = el de la  │
│ initial_paid_installments  │        │   deuda al momento del pago  │
│ is_finished (manual)       │        └──────────────────────────────┘
└────────────────────────────┘                   ▲
            │                                    │ insert (solo por RPC)
            ▼                                    │
 get_debts_status(p_debt_id)          create_debt_payment(...)
 → payments_count, paid_amount,
   paid_installments, remaining_*,
   next_due_date, finished (efectivo)
```

Archivos nuevos:

```
supabase/migrations/<ts>_add_debts.sql
lib/schemas/debts.ts
lib/services/debts.ts            lib/services/debts.client.ts
lib/debts/due.ts
components/debts/{debt-form-fields,create-form,edit-form,delete-form,payment-form,
                  table,debt-summary,debt-movements-table,finish-button}.tsx
components/dashboard/upcoming-debts-card.tsx
app/protected/debts/{page,create/page,edit/[id]/page,delete/[id]/page,
                     [id]/page,[id]/pay/page}.tsx
```

## Fase 1 — Base de datos

Una sola migración: `npx supabase migration new add_debts`. Todo lo de esta fase va en ese archivo.

- [x] **1.1** Tabla `public.debts`:
  - `id uuid pk default gen_random_uuid()`, `user_id uuid not null default auth.uid()` (FK
    `auth.users`), `name text not null`.
  - `kind text not null check (kind in ('service','installments'))`,
    `amount_mode text not null check (amount_mode in ('fixed','variable'))`,
    `amount numeric(15,2) not null check (amount > 0)`.
  - `movement_type_id uuid not null`, FK a `movement_types` con **`ON DELETE RESTRICT`**, igual que
    `movements`. No `CASCADE` como `budgets`: borrar un tipo no puede llevarse puestas deudas.
  - `first_due_date date not null`.
  - `total_installments integer null`, `initial_paid_installments integer not null default 0`,
    más un CHECK de coherencia: si `kind = 'service'`, `total_installments is null` y
    `initial_paid_installments = 0`. Si `kind = 'installments'`, `total_installments > 0` y
    `0 <= initial_paid_installments < total_installments`.
  - `is_finished boolean not null default false`, `created_at` / `updated_at timestamptz default now()`.
  - Trigger `trigger_debts_updated_at` con `update_updated_at()`, índice `idx_debts_user`.
  - RLS activada y cuatro políticas `to authenticated` con `user_id = (select auth.uid())`,
    calcadas de `budgets.sql`. El `INSERT` lleva `with check`.
- [x] **1.2** `alter table public.movements add column debt_id uuid references public.debts(id) on
  delete set null;` más `create index idx_movements_debt on public.movements (debt_id);`.
  - [x] **1.2.1** `alter table public.movements add constraint movements_debt_or_transfer_check
    check (debt_id is null or transfer_id is null);`. Una fila no puede ser a la vez pago de deuda y
    mitad de una transferencia. Hoy ningún camino lo produce; el CHECK lo garantiza.
- [x] **1.3** RPC `get_debts_status(p_debt_id uuid default null)` → una fila por deuda del usuario
  (todas, o solo `p_debt_id`). `language sql`, `stable`, `security invoker`, `set search_path = ''`.
  Devuelve las columnas de `debts`, más `movement_type_name` y `movement_type_color`, más:
  - `payments_count bigint` y `paid_amount bigint`: `count(*)` y `coalesce(sum(m.amount), 0)` de
    `movements m join accounts a` con `m.debt_id = d.id`, `a.user_id = (select auth.uid())` y
    **`m.transfer_id is null`** (restricción 2). Van en un `left join lateral`, como
    `get_budget_status`.
  - `paid_installments` = `initial_paid_installments + payments_count` y
    `remaining_installments` = `greatest(total − paid_installments, 0)`. Ambas `null` para servicios.
  - `remaining_amount` = `remaining_installments × amount` (`null` para servicios). Con monto
    variable es una estimación; la UI lo aclara.
  - `finished boolean` = `is_finished or (kind = 'installments' and paid_installments >= total_installments)`.
  - `next_due_date date` = `(first_due_date + make_interval(months => payments_count::int))::date`,
    o `null` si `finished`.
    ⚠️ Siempre desde `first_due_date` y nunca encadenado mes a mes: Postgres recorta el 31 de enero
    + 1 mes al 28 de febrero, pero el 31 de enero + 2 meses da 31 de marzo. Encadenar dejaría el
    día en 28 para siempre.
  - Orden: no finalizadas primero, después `next_due_date` ascendente y `name`.
  - `grant execute ... to authenticated, service_role`.
- [x] **1.4** RPC `create_debt_payment(p_debt_id uuid, p_account_id uuid, p_amount numeric, p_date
  timestamp, p_description text) returns uuid` (el id del movimiento). `plpgsql`, `volatile`,
  `security invoker`, `set search_path = ''`, con el estilo de `create_transfer`. Valida y lanza
  `raise exception` en español si la deuda no existe o no es del usuario
  (`user_id = (select auth.uid())`), si la cuenta no es del usuario, si `p_amount` es nulo o
  `<= 0`, o si la deuda está finalizada (misma fórmula que `finished` en 1.3).
  Inserta `(account_id, movement_type_id, date, description, amount, type, debt_id)` con el
  `movement_type_id` **leído de la deuda**, no recibido por parámetro, y `type = 'debit'`.
  El trigger de saldo hace el resto. `grant execute` igual que 1.3.
  ⚠️ `p_date` es `timestamp` (sin zona), igual que `create_transfer` desde el cambio de
  `movements.date`.
- [x] **1.5** `supabase db push --linked --dry-run` → `npm run db:push` → `npm run db:pull` →
  `npm run db:types`. Verificar que `debts`, `movements.debt_id` y las dos RPC aparezcan en
  `lib/supabase/database.types.ts`. ⚠️ `db:push` va directo a producción.

## Fase 2 — Schemas y servicios

Depende de 1.5: los tipos generados tienen que incluir las RPC nuevas para que `.rpc()` compile.

- [x] **2.1** `lib/schemas/debts.ts`:
  - `debtKindEnum` (`service` | `installments`) y `amountModeEnum` (`fixed` | `variable`), con
    `debtKindOptions` ("Servicio" / "En cuotas") y `amountModeOptions` ("Monto fijo" /
    "Monto variable"), mismo molde que `typeOptions` en `lib/schemas/movements.ts`.
  - `debtSchema` (lo que carga el form): `name`, `kind`, `amount_mode`,
    `amount: z.int().positive(...)`, `movement_type_id: z.uuid(...)`, `first_due_date`
    (`YYYY-MM-DD`), `total_installments` y `pending_installments` opcionales. Un `superRefine`
    exige ambos si `kind = 'installments'`, con `1 <= pending <= total`.
    ⚠️ `pending_installments` **no es una columna**: el client service (2.3) la convierte a
    `initial_paid_installments` antes de escribir.
  - `debtPaymentSchema`: `account_id`, `date` (mismo regex que `movementSchema`), `amount`
    (entero > 0), `description` (1–255).
  - Tipos hand-written: `Debt` (columnas de `debts`) y `DebtStatus` (fila de `get_debts_status`).
- [x] **2.2** `lib/services/debts.ts` (server-only): `getDebts()` y `getDebtById(id)` sobre
  `get_debts_status` (la segunda con `p_debt_id`, y devuelve `null` si no hay fila, para
  `notFound()`), más `getUpcomingDebts(days = 7)`, que filtra en JS las filas de `getDebts()` no
  finalizadas con `next_due_date <= hoy + days`. Filtrar filas ya agregadas por la RPC (una por
  deuda) es correcto; es el mismo razonamiento del comentario de `BudgetsCard`.
- [x] **2.3** `lib/services/debts.client.ts`: `createDebt`, `updateDebt(id, input, paymentsCount)`,
  `deleteDebt`, `setDebtFinished(id, value)` y `createDebtPayment(debtId, input)` (RPC 1.4). Todas
  re-validan con `safeParse`.
  `createDebt` / `updateDebt` calculan
  `initial_paid_installments = total − pending − paymentsCount` (0 en el alta) y mandan
  `total_installments`/`initial_paid_installments` en `null`/`0` si es servicio.
  ⚠️ `updateDebt` falla con mensaje claro si ese cálculo da negativo (pendientes + pagos
  registrados > total).
  ⚠️ `updateDebt` **no manda `kind`** (3.2.1) y **no manda `is_finished`**: eso lo escribe solo
  `setDebtFinished`.
- [x] **2.4** `lib/services/movements.ts`: agregar `debt_id` y `debts(id,name)` a
  `MOVEMENT_COLUMNS`, y `debt_id: string | null` y `debts: { id: string; name: string } | null` al
  tipo `Movement`. Nueva `getMovementsByDebt(debtId)`: `MOVEMENT_COLUMNS`,
  `.eq("debt_id", debtId)`, `.eq("accounts.user_id", ...)`,
  `.order("date", desc).order("created_at", desc)` (el desempate de `CLAUDE.md`), sin `.range()`.
  ⚠️ `debts(id,name)` **sin `!inner`**: un inner join haría desaparecer de `/protected/movements`
  todos los movimientos que no son pagos de deuda.
  ⚠️ **No agregar `debt_id` a `movementSchema`** (restricción 7).
- [x] **2.5** `lib/debts/due.ts`: helpers puros en hora local, nunca `toISOString()`:
  - `todayLocal()`, que devuelve `YYYY-MM-DD`.
  - `daysUntil(date: string)`: parsea `YYYY-MM-DD` con `new Date(y, m − 1, d)`, le resta la
    medianoche local de hoy y redondea.
  - `dueLabel(date)`: "Vence hoy", "Vence mañana", "Vence en N días", "Venció ayer" o
    "Vencida hace N días".
  - `dueTone(date)`: `overdue`, `soon` (≤ 7 días) o `normal`, para el color.

## Fase 3 — Componentes (`components/debts/`)

Todos `"use client"` salvo `table.tsx`, `debt-summary.tsx` y `debt-movements-table.tsx`, que son
Server Components.

- [x] **3.1** `debt-form-fields.tsx` (con `useFormContext`, mismo molde que
  `components/movements/movement-form-fields.tsx`). Campos: nombre; tipo (`Select` con
  `debtKindOptions`); modalidad (`Select` con `amountModeOptions`); monto (`AmountInput`, con la
  etiqueta "Monto" si es fijo o "Monto base (aproximado)" si es variable); tipo de movimiento
  (`MovementTypeSelect`); próximo vencimiento (`<Input type="date">`, con la ayuda "la próxima
  cuota o factura que vas a pagar"). Solo si el tipo es "En cuotas": total de cuotas y cuotas
  pendientes, más el texto "N de M ya pagadas".
- [x] **3.2** `create-form.tsx` / `edit-form.tsx`: `FormProvider` + `zodResolver(debtSchema)` +
  `revalidateMyDataAndRedirect`. Crear vuelve a `/protected/debts` y editar a
  `/protected/debts/[id]`. `edit-form` recibe el `DebtStatus` y precarga
  `pending_installments = remaining_installments`, y pasa `payments_count` a `updateDebt`.
  - [x] **3.2.1** En `edit-form`, el tipo (servicio/cuotas) se muestra deshabilitado. Cambiarlo con
    pagos registrados deja las cuotas sin sentido; para cambiarlo, se borra y se crea de nuevo.
- [x] **3.3** `delete-form.tsx`: resumen de la deuda (nombre, tipo, monto pagado) y el aviso "Los N
  pagos registrados quedan como movimientos sin deuda asociada; el saldo de las cuentas no cambia".
  Mismo molde que `components/movements/delete-form.tsx`.
- [x] **3.4** `payment-form.tsx`: `useForm` con `debtPaymentSchema`. Campos:
  - Cuenta: `AccountSelect`, con la principal por defecto vía `getPrimaryAccountId` y resuelta en
    la page.
  - Fecha: `datetime-local`, con `nowForInput()` por defecto.
  - Monto: `AmountInput` precargado con `debt.amount` y **deshabilitado si `amount_mode = 'fixed'`**.
  - Descripción precargada: `Cuota {paid_installments + 1}/{total} – {name}` en cuotas y
    `{name} – {getMonthLabel(mes de next_due_date)}` en servicios.
  - Arriba del form, un texto con el tipo de movimiento de la deuda y el vencimiento que se paga.
  Al guardar llama a `createDebtPayment` → `revalidateMyDataAndRedirect("/protected/debts/[id]")`.
  - [x] **3.4.1** Agregar la prop opcional `disabled` a `components/movements/amount-input.tsx`
    (restricción 8) y pasarla al `<Input>`. No cambia a los usuarios actuales.
- [x] **3.5** `table.tsx`: async Server Component que llama a `getDebts()`. En desktop, `<Table>`
  con Nombre, Tipo (badge Servicio/Cuotas), Monto ("≈" delante si es variable), Cuotas (`x/N` o
  "—"), Pagado, Por pagar, Próximo vencimiento (fecha + `dueLabel`, en rojo si `overdue`), Estado
  y Acciones: ver (`/protected/debts/[id]`), pagar (oculto si finalizada), editar, eliminar. En
  mobile, `RecordCard`, como `components/budgets/table.tsx`. Sin deudas: "No hay deudas cargadas
  aún" con link a crear.
  - [x] **3.5.1** Las finalizadas van al final y apagadas (`opacity-60`), como los presupuestos
    pausados. El orden ya viene de la RPC (1.3).
- [x] **3.6** `debt-summary.tsx`: grilla de `<Card>` con monto pagado, por pagar (solo en cuotas,
  con "aprox." si es variable), cuotas `x/N` (solo en cuotas), próximo vencimiento con `dueLabel` y
  estado. Una columna en mobile, 2–4 en desktop.
- [x] **3.7** `debt-movements-table.tsx`: recibe `Movement[]` de `getMovementsByDebt`. Muestra
  fecha (`formatMovementDate`), descripción, monto, cuenta (con color) y acciones editar/eliminar
  que apuntan a `/protected/movements/edit/[id]` y `/protected/movements/delete/[id]`. `<Table>` en
  desktop y `RecordCard` en mobile. Sin pagos: "Todavía no hay pagos registrados".
  Para no duplicar, exportar `ColoredLabel` desde `components/movements/table.tsx` y reusarlo
  (o moverlo a `components/colored-label.tsx` si el import cruzado queda raro).
- [x] **3.8** `finish-button.tsx`: botón "Marcar como finalizada" / "Reabrir" en el detalle, que
  llama a `setDebtFinished` y revalida el detalle. ⚠️ En una deuda en cuotas finalizada por cuotas
  (no por `is_finished`), "Reabrir" no tiene efecto: la fórmula de 1.3 la sigue dando por
  finalizada. En ese caso el botón no se muestra.
- [x] **3.9** `components/dashboard/upcoming-debts-card.tsx`: async, llama a `getUpcomingDebts(7)`.
  Tarjeta "Vencimientos" con "Ver todas" → `/protected/debts`. Lista nombre, monto (`≈` si es
  variable), `dueLabel` (rojo si vencida) y un link "Pagar" → `/protected/debts/[id]/pay`. Las
  vencidas van primero. Vacía: "No hay vencimientos en los próximos 7 días".
- [x] **3.10** Deuda asociada en `components/movements/table.tsx`, en **desktop y mobile**:
  - Desktop: en la celda "Naturaleza", debajo del `NatureBadge`, un `Badge variant="outline"`
    "Deuda: {nombre}" que linkea a `/protected/debts/[id]`, con `max-w` + `truncate` para no
    ensanchar la columna.
  - Mobile: un campo extra "Deuda" en el `RecordCard`, **solo si `movement.debts` no es `null`**
    (no agregar una fila vacía a todas las tarjetas), con el mismo link.
  Depende de 2.4.

## Fase 4 — Páginas y navegación

- [x] **4.1** `lib/nav-items.ts`: agregar `{ label: "Deudas", shortLabel: "Deudas", href:
  "/protected/debts", icon: HandCoins }` (o `Receipt` si `HandCoins` no está en la versión de
  `lucide-react`) y un campo nuevo `mobilePinned: boolean` en `NavItem`. Fijos: Dashboard, Cuentas,
  Movimientos y Presupuestos. Al menú "Más" van Tipos de movimientos y Deudas. Cambiar qué va fijo
  es cambiar un booleano. El sidebar de desktop no cambia: sigue recorriendo `navItems` entero.
  - [x] **4.1.1** `components/mobile-nav.tsx`: la barra muestra los ítems con `mobilePinned` más un
    quinto botón "Más" (`Ellipsis` o `LayoutGrid`, `shortLabel` "Más"). La barra queda en
    `grid-cols-5`: 4 fijos + "Más". "Más" abre un `DropdownMenu` de `components/ui/dropdown-menu.tsx`
    con `side="top"`, `align="end"` y `sideOffset`, estilizado como burbuja (`rounded-xl`,
    `shadow-lg`, ícono + label por ítem). Da foco, teclado y cierre con Escape gratis.
    ⚠️ "Más" se marca activo (`bg-accent/10`) cuando la ruta actual es de un ítem del menú
    (`isNavItemActive` sobre los no fijos). Si no, en `/protected/debts` ningún botón de la barra
    aparece seleccionado.
    ⚠️ Cada ítem del menú es `DropdownMenuItem asChild` + `<Link>`, para que el menú se cierre al
    navegar.
    ⚠️ La barra es `fixed z-40`. El contenido del dropdown va en portal con `z-50`: verificar que
    se dibuje encima y que respete el `safe-area-inset-bottom`.
- [x] **4.2** `app/protected/debts/page.tsx` (título "Deudas" + botón "Nueva" + tabla 3.5 en
  `<Suspense fallback={<TableSkeleton />}>`), con el molde de `app/protected/budgets/page.tsx`.
  Además `create/page.tsx`, `edit/[id]/page.tsx` y `delete/[id]/page.tsx` con `FormContainer`.
  Edit y delete usan `getDebtById` → `notFound()`. Create y edit cargan `getMovementTypes()`.
- [x] **4.3** `app/protected/debts/[id]/page.tsx`: detalle con `FormContainer wide`, título = nombre
  y `href="/protected/debts"`. Arriba, `debt-summary` (3.6) y las acciones (pagar, editar,
  `finish-button`). Abajo, "Pagos" con `debt-movements-table` (3.7). `notFound()` si
  `getDebtById` da `null`.
- [x] **4.4** `app/protected/debts/[id]/pay/page.tsx`: `FormContainer` "Registrar pago – {nombre}",
  `href` al detalle. Carga `getDebtById` y `getAccounts()`. Si la deuda está finalizada, redirige
  al detalle en vez de mostrar el form.
- [x] **4.5** `app/protected/page.tsx`: `<UpcomingDebtsCard />` en su `<Suspense
  fallback={<ChartCardSkeleton />}>`, **arriba** de `BudgetsCard`. Un recordatorio tiene que verse
  sin scrollear.

## Fase 5 — Cierre

- [x] **5.1** `npm run lint` y `npm run build`. Suele romper en: tipos de `.rpc()` si 1.5 no
  regeneró `database.types.ts`; `Movement` sin `debts` en algún lugar que construye el tipo a mano;
  el `ColoredLabel` exportado (3.7).
- [ ] **5.2** Probar los bordes, logueado desde la app (el SQL editor corre como `postgres` y
  bypassea la RLS):
  - Crear una deuda en cuotas 12/12 pendientes, pagar una: 1/12, próximo vencimiento +1 mes, el
    saldo de la cuenta baja y el movimiento aparece en `/protected/movements` con el badge (3.10).
  - Borrar ese movimiento desde movimientos: la deuda vuelve a 0/12 y el vencimiento vuelve atrás.
  - Pagar la última cuota: queda finalizada, desaparece "Pagar", y la RPC rechaza otro pago (probar
    entrando directo a `/pay`).
  - Servicio con `first_due_date` el día 31: pagar 2 meses y ver que el vencimiento cae en 30/31 y
    no en 28 desde febrero en adelante (1.3).
  - Monto variable: pagar un monto distinto al base; el monto pagado suma el real.
  - Pagar la misma deuda desde dos cuentas distintas: ambos pagos aparecen en el detalle.
  - Editar una deuda en cuotas con pagos registrados y poner más pendientes de las posibles: error
    claro (2.3).
  - Editar un pago desde `/protected/movements` (monto, cuenta): sigue vinculado a la deuda
    (restricción 7).
  - Marcar un servicio como finalizado y reabrirlo.
  - Borrar una deuda con pagos: los movimientos siguen en `/protected/movements`, sin badge, y el
    saldo no cambia.
  - Dashboard: una vencida, una que vence en 3 días y una que vence en 20 días (esta última no
    aparece).
  - Con un segundo usuario: `/protected/debts/[id]` de una deuda ajena da 404, y
    `create_debt_payment` con un `p_debt_id` ajeno falla.
  - [x] `curl` con la publishable key contra `/rest/v1/debts` sin sesión devuelve `[]`
    (`docs/database.md`, *Cómo verificar*) — verificado, ver Notas de cierre.
  - El resto de este punto (los bordes de arriba de este ítem) queda **sin probar**: requiere
    loguearse en la app con datos reales y no se corrió un navegador en esta sesión. Ver Notas de
    cierre.
- [ ] **5.3** Mobile y dark mode: el menú "Más" (apertura, cierre al navegar, estado activo,
  superposición con la barra), la tabla de deudas y la de pagos como `RecordCard`, el badge de
  deuda en las tarjetas de movimientos, y el formulario con los campos de cuotas. **Sin probar**:
  requiere un navegador; ver Notas de cierre.
- [x] **5.4** `docs/database.md`: sección "Deudas" con el modelo (`debts` + `movements.debt_id`,
  `ON DELETE SET NULL`), la fila de `debts` en la tabla de *Modelo de pertenencia*, la tabla de las
  dos RPC, por qué el próximo vencimiento y "finalizada" se calculan y no se guardan, el ⚠️ del
  31/01 + N meses, y el CHECK 1.2.1.
- [x] **5.5** `CLAUDE.md`: sección "Debts (`app/protected/debts`)" con la estructura y tres reglas:
  (1) los pagos se crean solo por `create_debt_payment`; (2) no guardar ni escribir monto pagado,
  cuotas pagadas ni próximo vencimiento; (3) no agregar `debt_id` a `movementSchema`. Mencionar
  también `mobilePinned` y el menú "Más" en la parte de navegación.
- [x] **5.6** Notas de cierre al final de este documento.

## Fuera de alcance

- **Vincular un movimiento existente (p. ej. importado de un extracto) a una deuda** — se propuso
  un select "Deuda" en el form de editar movimiento, para no duplicar el pago cuando también se
  importa el extracto. El usuario lo dejó **pendiente** y sacó la importación del alcance de este
  plan: la interacción deudas ↔ importación se va a pensar aparte. Hacerlo implicaría tocar
  `movementSchema` (ojo con la restricción 7), `MovementFormFields` y la política RLS de `movements`
  para validar que el `debt_id` sea del usuario. Ver *Riesgos*, punto 2.
- **Guardar `next_due_date`, un contador de cuotas pagadas o un trigger que marque
  `is_finished`** — descartado por la restricción 1 (ver *Decisiones tomadas*).
- **Tabla de períodos por deuda (tipo `budget_periods`) o un pago que cubra varios meses** —
  descartado: el modelo "un pago = un período" alcanza; para dos meses se registran dos pagos.
- **Un sexto botón en la barra de navegación móvil** — descartado a favor del menú "Más" (4.1.1).
- **Cambiar el tipo servicio ↔ cuotas de una deuda existente** — se borra y se crea de nuevo
  (3.2.1).
- **Deudas sin tipo de movimiento** — el tipo es obligatorio (ver *Decisiones tomadas*).
- **Volver al detalle de la deuda después de editar o borrar un pago.** Los links de 3.7 usan las
  rutas de movimientos, que redirigen a `/protected/movements`. Se acepta; un `?returnTo` sería
  otro cambio sobre los forms de movimientos.
- **Notificaciones (push, email) de vencimiento** — el recordatorio es solo la tarjeta del
  dashboard.
- **Intereses, moras, saldo de capital de un préstamo, deudas que te deben a vos** — no se
  pidieron. El modelo es "cuánto pago por mes y cuántas veces".

## Riesgos conocidos

1. **`db:push` va directo a producción** y 1.2 hace `alter table` sobre `movements`, la tabla
   central. Agregar una columna nullable con FK y un CHECK es barato y no reescribe filas, pero el
   `--dry-run` de 1.5 es obligatorio.
2. **Pago duplicado con la importación de extractos.** Si una deuda se paga por débito automático,
   se registra el pago desde la deuda y después se importa el extracto, el mismo pago entra dos
   veces (el importado no tiene `debt_id` y `external_id` no lo detecta). Hasta que se resuelva el
   punto pendiente de *Fuera de alcance*, el duplicado se borra a mano desde movimientos.
3. **3.10 y 2.4 tocan `MOVEMENT_COLUMNS`, que usan la lista de movimientos, el dashboard y la
   edición.** Un `!inner` por error en `debts(...)` vacía la lista de movimientos que no son pagos.
   Verificar que `/protected/movements` muestra la misma cantidad de filas antes y después.
4. **Borrar una cuenta borra sus movimientos en cascada** (`movements.account_id ON DELETE
   CASCADE`), incluidos los pagos de deudas. La deuda "pierde" esos pagos: bajan las cuotas pagadas
   y el vencimiento vuelve atrás, sin aviso. Es coherente con el modelo calculado, pero puede
   sorprender.
5. **Cambiar el tipo de movimiento de la deuda no cambia los pagos ya hechos.** 1.4 copia el tipo
   al crear el pago. Es lo esperado (el histórico no se reescribe), pero puede llamar la atención en
   el gráfico de gastos por tipo.
6. **"Hoy" cerca de la medianoche** (restricción 9): en un server en UTC, entre las 21:00 y las
   24:00 de Paraguay la tarjeta de vencimientos calcula los días con un día de diferencia. Es el
   mismo comportamiento que `resolveMonth` en presupuestos; no se corrige en este plan.
7. **El menú "Más" cambia la navegación móvil que hoy funciona**: "Tipos" deja de estar en la barra.
   Verificar en 5.3 que todas las secciones siguen siendo alcanzables en mobile.

## Notas de cierre

Implementado siguiendo el plan tal cual, fases 1 a 5.1 y 5.4-5.6. Resumen de lo hecho:

- **Fase 1 (base de datos):** migración `20260927164500_add_debts.sql` aplicada contra producción
  (dry-run limpio antes de aplicar, con confirmación explícita del usuario). `db:pull` y `db:types`
  corridos después; `debts`, `movements.debt_id` y las dos RPC (`get_debts_status`,
  `create_debt_payment`) aparecen en `lib/supabase/database.types.ts` y en
  `supabase/schemas/public/**`.
- **Fases 2-4:** schemas, servicios, componentes, páginas y navegación (menú "Más") implementados
  como los describe el plan.
- **Fase 5.1:** `npm run lint` y `npm run build` pasan sin errores (build completo con todas las
  rutas de `/protected/debts/**` generadas).
- **Fase 5.4/5.5:** secciones "Deudas" agregadas a `docs/database.md` (con la tabla de las dos RPC,
  el modelo de pertenencia y el ⚠️ del 31/01 + N meses) y a `CLAUDE.md`.

### Desvíos menores del plan

- **`get_debts_status` repite la expresión `finished`/`next_due_date` tres veces** (en el `select`,
  en `order by`, y de nuevo en el `case` del `next_due_date`) en vez de calcularla una sola vez en
  un CTE. Funciona igual, pero un CTE con `finished` calculado una vez habría sido más corto y más
  fácil de mantener si la fórmula cambia. No se refactorizó para no arriesgar la migración ya
  aplicada contra producción sin volver a pasar por el ciclo `dry-run` → `push`.
- El plan no especificaba el layout exacto del badge de deuda en la celda "Naturaleza" de
  `components/movements/table.tsx` más allá de "debajo del `NatureBadge`"; se implementó con un
  `flex-col` envolviendo ambos badges.

### Qué NO se pudo verificar

**Nada de la Fase 5.2 (bordes funcionales) ni de la 5.3 (mobile/dark mode) se probó en un
navegador real durante esta sesión** — no se abrió la app. Lo único verificado sin navegador:

- `curl` contra `/rest/v1/debts` sin sesión devuelve `[]` (RLS activa), confirmado.
- Tipos generados y build de Next.js, confirmados (Fase 5.1).

Quedan **sin probar**, y son lo más importante a validar antes de dar la feature por terminada:

- El flujo completo de alta de deuda en cuotas → pago → que el saldo baje, el badge aparezca en
  `/protected/movements`, y `paid_installments`/`next_due_date` avancen correctamente.
- Que borrar un pago desde `/protected/movements` "despague" la deuda (vuelva atrás cuotas y
  vencimiento), como predicen las Decisiones tomadas.
- El caso del día 31 (`first_due_date` a fin de mes) para confirmar el `make_interval` de Postgres
  se comporta como se documentó.
- Que `create_debt_payment` rechace un pago sobre una deuda ya finalizada, y que
  `/protected/debts/[id]` de una deuda ajena dé 404 (la RLS y el `notFound()` están escritos, pero
  no se probó con una segunda cuenta real).
- Todo lo visual: el menú "Más" en mobile (apertura, cierre al navegar con `DropdownMenuItem
  asChild`, estado activo cuando la ruta es de un ítem no fijado), las tablas de deudas/pagos como
  `RecordCard`, y el formulario con los campos de cuotas — en claro y en oscuro.
- Que el resto de la navegación móvil (en particular "Tipos de movimientos", que salió de la barra
  fija) siga siendo alcanzable (Riesgo 7 del plan).

Se recomienda correr la Fase 5.2 y 5.3 a mano antes de considerar la feature lista para uso diario.
