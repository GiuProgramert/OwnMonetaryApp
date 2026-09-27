# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

A personal finance / monetary tracking app built on the Next.js + Supabase starter kit (App Router). Users manage accounts (with balances), movement types (income/expense categories), and movements (transactions) tied to their Supabase-authenticated user. All UI copy is in Spanish.

## Commands

```bash
npm run dev      # start dev server (localhost:3000)
npm run build    # production build
npm run start    # run production build
npm run lint     # eslint (next/core-web-vitals + next/typescript)
```

There is no test suite configured in this repo.

Environment variables live in `.env.local`: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_BASE_URL`.

## Architecture

### Feature module pattern (accounts, movement-types, movements)

Each domain entity follows the same layout — when adding a new entity or field, mirror this structure exactly:

- `lib/schemas/<entity>.ts` — Zod schema (`<entity>Schema`) used for both client-side form validation and Supabase insert/update payloads, plus the TS types (`<Entity>`, `create<Entity>`) used across server and client code. Types are hand-declared to match the exact columns selected in the service layer — they are not derived from Supabase's generated types.
- `lib/services/<entity>.ts` — **server-only** reads (`createClient` from `lib/supabase/server`, used from Server Components/pages). Always fetches the authenticated user via `supabase.auth.getUser()` and scopes queries with `.eq("user_id", ...)` for owner-scoped tables (accounts, movements). `movement_types` is a shared/global table with no user scoping.
- `lib/services/<entity>.client.ts` — **client-only** mutations (`createClient` from `lib/supabase/client`, used from `"use client"` forms). Re-validates input with the Zod schema via `safeParse` before hitting Supabase, even though the form already validated it.
- `components/<entity>/create-form.tsx`, `edit-form.tsx` (or `edit.form.tsx`), `delete-form.tsx`, `table.tsx` — `"use client"` forms built with `react-hook-form` + `@hookform/resolvers/zod`; `table.tsx` is an async Server Component that calls the read service directly and renders shadcn/ui `<Table>`.
- `app/protected/<entity>/page.tsx` — list page, renders the table inside `<Suspense fallback={<TableSkeleton />}>`.
- `app/protected/<entity>/create/page.tsx`, `edit/[id]/page.tsx`, `delete/[id]/page.tsx` — thin route wrappers using the shared `FormContainer` layout; edit/delete pages fetch the record server-side via `get<Entity>ById` and call `notFound()` if missing.

After any client-side mutation, forms call `revalidateMyDataAndRedirect(path)` (`lib/services/revalidate.ts`, a `"use server"` action) to revalidate the list path's cache and redirect back to it — this is the standard post-mutation flow, not `router.push` + manual refetch.

Not-found lookups check `error.details === notFoundDetailMessage` (from `lib/constants.ts`) rather than the Postgrest error code, since Supabase's `.single()` error shape is matched by message text here.

### Database schema, triggers and RLS

The schema (tables, indexes, triggers, functions, RLS policies) is versioned declaratively in `supabase/schemas/**`, with a hand-written baseline migration in `supabase/migrations/`. That tree is the source of truth for *what* exists. [`docs/database.md`](docs/database.md) is the source of truth for *why* — the pieces the SQL doesn't say by itself — and [`docs/supabase.md`](docs/supabase.md) documents the schema-change workflow (`migration new` → edit → `db:push` → `db:pull` → `db:types`) and which `supabase` CLI commands don't work on this machine (no Docker in this WSL2 distro).

- **Triggers/functions** — see `supabase/schemas/public/{tables,functions}/*.sql` for what they do. [`docs/database.md`](docs/database.md) has the app-level rules they impose (never write `updated_at` or `current_balance` from the app, `movements.type` must be exactly `credit`/`debit`), and the balance-drift diagnostic/repair queries. Read it before touching `movements` or `accounts` balance logic.
- **RLS** — the ownership model (`movements` has no `user_id`; ownership resolves through `accounts`) and the policies' DDL are in `supabase/schemas/public/tables/*.sql`; [`docs/database.md`](docs/database.md#row-level-security-rls) has the verification queries and why RLS is the only security boundary: `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` ships in the browser bundle, so the `.eq("accounts.user_id", ...)` filters in `lib/services/*` are query convenience, not protection. Any new table needs RLS enabled plus a policy, and policies use `(select auth.uid())`, never bare `auth.uid()`.
- **`movements.external_id`** — the unique `(account_id, external_id)` index that backs the bank-statement import feature (dedup), defined in `supabase/schemas/public/tables/movements.sql`. See [`docs/database.md`](docs/database.md#índices-y-restricciones) for why it isn't partial and the `onConflict` side effect.
- **Generated types vs. hand-written schemas** — `lib/supabase/database.types.ts` (generated via `npm run db:types`) types the three Supabase client constructors and `.rpc()` calls; it describes raw tables. `lib/schemas/*.ts` stays hand-written with Zod: it describes the joined shapes the services return (`Movement` embeds `accounts`/`movement_types`), which no generated type expresses. Don't migrate `lib/schemas/*.ts` to the generated types — see [`docs/supabase.md`](docs/supabase.md) for why.

### Bank statement imports

`app/protected/movements/import` lets a user upload a bank statement (XLSX today) and bulk-create movements without duplicating a previous import. See [`docs/imports.md`](docs/imports.md) for the adapter engine (`lib/imports/`), how to add a new bank format, and where adapters tend to break. All parsing runs client-side; there is no Route Handler for this feature.

### Dashboard (`app/protected/page.tsx`)

`lib/services/dashboard.ts` + `components/dashboard/` render the home dashboard: balance
distribution across accounts, expenses by movement type, and monthly income/expense flow. State
lives in the URL (`?accountId=&startDate=&endDate=`), defaulted to the current month by
`lib/dashboard/date-range.ts` and to the primary account by `lib/accounts/primary.ts` — same
pattern as `movements`. Filters are shared with `movements` via
`components/date-range-filter.tsx`.

**All aggregation for this module goes through Postgres RPC functions, never by summing raw rows in
JS.** PostgREST caps reads at 1000 rows (`db.max_rows`); an aggregation that pages through rows and
sums client-side silently undercounts once a user crosses that threshold. `getMovementsTotals`
(`lib/services/movements.ts`) also uses this pattern, so it stays correct at scale too. The three RPC
functions (`get_expenses_by_movement_type`, `get_movements_totals`, `get_monthly_flow`) are
versioned in `supabase/schemas/public/functions/` and documented in
[`docs/database.md`](docs/database.md#funciones-rpc-del-dashboard). Charts are `"use client"` (Recharts needs the DOM) but only
draw already-aggregated data passed via props; the server component that fetches with the RPC wraps
each chart in a `<Card>` and handles the empty state.

### Filtro de cuenta y cuenta principal

`accounts.is_primary` marca la cuenta preseleccionada. `lib/accounts/primary.ts`
(`resolveAccountFilter`, puro y síncrono, mismo molde que `lib/dashboard/date-range.ts`) resuelve
el `?accountId` **en el server**: ausente ⇒ cuenta principal, `all` ⇒ sin filtro, uuid ⇒ esa
cuenta. Devuelve `accountId` (uuid | `undefined`, para los servicios) y `param` (uuid | `"all"`,
para la URL y el `<AccountSelect>`).

**Dos invariantes:** (1) el sentinela `"all"` nunca llega a `lib/services/*` — `getMovements`,
`getMovementsTotals`, `getExpensesByMovementType` y `getMonthlyFlow` solo reciben un uuid o
`undefined`; (2) todo href armado a mano (paginación, `movementsHref`, "Limpiar filtros") setea
`accountId` explícito, porque la ausencia del parámetro significa "cuenta principal", no "todas".

Igual que `startDate`/`endDate` en el dashboard, el valor resuelto viaja como **prop** a los
filtros cliente; no se re-lee de la URL en el cliente, si no el select y la tabla se
desincronizan. Puede haber varias cuentas principales (ver
[`docs/database.md`](docs/database.md#cuenta-principal-accountsis_primary)); se usa la primera por
nombre.

### Budgets (`app/protected/budgets`)

Tope de gasto mensual por tipo de movimiento. Estructura: `lib/schemas/budgets.ts`,
`lib/services/budgets.ts` (server) / `budgets.client.ts` (mutaciones), `lib/budgets/month.ts` (helpers
de mes en hora local), `components/budgets/`, `app/protected/budgets/**` (incluye `[id]` = histórico).
Tablas `budgets` (config) y `budget_periods` (tope de cada mes), más las RPC `ensure_budget_periods`,
`get_budget_status` y `get_budget_history`; ver [`docs/database.md`](docs/database.md#presupuestos-mensuales).

**Lo gastado se calcula por RPC y nunca se guarda: no hay columna `spent` ni trigger que descuente**
(mismo problema que `accounts.current_balance`; el porqué está en `docs/database.md`). El mes es
siempre el mes calendario (`?month=YYYY-MM`): no usa `DateRangeFilter` ni `resolveDateRange`. En
`getBudgetStatus`, `ensure_budget_periods` corre antes que `get_budget_status` y escribe durante el
render, así que esa lectura no se cachea.

### Transfers (`app/protected/transfers`)

Traspaso entre dos cuentas propias: dos filas de `movements` apareadas por `transfer_id`, escritas
solo por las RPC `create_transfer` / `update_transfer` / `delete_transfer`
(`lib/services/transfers.client.ts`); ningún componente inserta filas de `movements` para una
transferencia. Estructura: `lib/schemas/transfers.ts`, `lib/services/transfers{,.client}.ts`,
`components/transfers/`, `app/protected/transfers/{create,edit/[id],delete/[id]}` (el `[id]` es el
`transfer_id`). Sin listado ni item de sidebar: viven dentro de movimientos. Ver
[`docs/database.md`](docs/database.md#transferencias-entre-cuentas).

**Dos reglas:** (1) toda agregación nueva sobre `movements` tiene que excluir
`transfer_id is not null`; (2) `movement_types` ya no es escribible por cualquier autenticado: solo
el dueño (UUID literal en la política), y el tipo `Transferencia` (`transferMovementTypeId`) no se
ofrece en selects ni se edita/borra.

### Debts (`app/protected/debts`)

Servicios (sin fin definido) y pagos en cuotas: cada pago es un movimiento `debit` normal vinculado
por `movements.debt_id` (`ON DELETE SET NULL`, así que borrar una deuda no borra sus movimientos).
Estructura: `lib/schemas/debts.ts`, `lib/services/debts.ts` (server) / `debts.client.ts`
(mutaciones), `lib/debts/due.ts` (helpers de vencimiento en hora local), `components/debts/`,
`app/protected/debts/**` (incluye `[id]` = detalle y `[id]/pay` = alta de pago). Tabla `debts` más
las RPC `get_debts_status` y `create_debt_payment`; ver
[`docs/database.md`](docs/database.md#deudas). Plan de origen:
`docs/plans/debts-implementation.md`.

**Tres reglas:** (1) los pagos se crean solo por `create_debt_payment` (RPC `security invoker` que
valida deuda y cuenta, y copia el `movement_type_id` de la deuda); nunca insertar directo en
`movements` con `debt_id`. (2) Monto pagado, cuotas pagadas y próximo vencimiento se calculan al
leer en `get_debts_status`, nunca se guardan ni se escriben desde la app (mismo problema que
`accounts.current_balance` y los presupuestos). (3) **No agregar `debt_id` a `movementSchema`**:
como `updateMovement` hace `.update(parsed.data)`, un `debt_id` con default `null` en el schema
desvincularía en silencio el pago al editarlo desde `/protected/movements`.

`components/mobile-nav.tsx` usa `NavItem.mobilePinned` para elegir los 4 ítems fijos de la barra
inferior flotante; el resto (hoy: Tipos de movimientos y Deudas) va al botón "Menú", un
`DropdownMenu` con una grilla de 3 columnas.

Pagar y editar una deuda se abren desde el listado, el detalle o el dashboard: los links pasan
`?returnTo=` (`withReturnTo` / `resolveReturnTo` en `lib/return-to.ts`, que solo acepta rutas de
`/protected`) y la page lo usa para la flecha "<" y para el redirect después de guardar. Sin el
parámetro, vuelven al detalle.

### Fecha y hora de movimientos

`movements.date` es `timestamp` (hora local de Paraguay, sin zona). Tres reglas: (1) todo fin de
rango es **exclusivo** (`< nextDay(endDate)` en JS, `< p_end_date + interval '1 day'` en SQL), nunca
`<=`; (2) `getMovements` ordena por `date desc, created_at desc` — el desempate no es decorativo:
sin él el orden entre filas con la misma fecha es arbitrario y `.range()` repite o salta filas;
(3) defaults, valores de `datetime-local` y formato se calculan en hora local con
`lib/movements/datetime.ts`, nunca con `toISOString()`. Ver
[`docs/database.md`](docs/database.md#movementsdate-fecha-y-hora).

### Auth & Supabase clients

Three separate Supabase client constructors exist for three contexts — use the one matching where the code runs:
- `lib/supabase/server.ts` — Server Components, Route Handlers, Server Actions.
- `lib/supabase/client.ts` — Client Components (`"use client"`).
- `lib/supabase/middleware.ts` — `updateSession()`, called from the root `middleware.ts`.

`middleware.ts` matches all routes except static assets/images and runs `updateSession`, which refreshes the Supabase session and redirects unauthenticated users to `/auth/login` for any path outside `/`, `/login`, and `/auth`. Do not reorder the code around `supabase.auth.getClaims()` in `lib/supabase/middleware.ts` or drop the cookie-forwarding logic — both are called out in-file as easy ways to cause random session loss.

Routes under `app/protected/` are the authenticated app shell (sidebar + content); `app/auth/` holds login/sign-up/password-reset flows from the Supabase UI Library starter.

### Other conventions

- Always use braces for `if` statements, including single-statement bodies — no one-line `if (x) doThing();` or brace-less multi-line `if`. Applies to all TS/TSX in this repo.
- Path alias `@/*` maps to the repo root (see `tsconfig.json`).
- shadcn/ui is configured with style `new-york`, base color `neutral`, no prefix (`components.json`); primitives live in `components/ui/`. `axios` is set up in `lib/axios/index.ts` with `NEXT_PUBLIC_BASE_URL` as base but is not currently used by the CRUD services above (they call Supabase directly).
- Currency values are formatted with `toLocaleString("es-PY")` and a `Gs.` prefix (Paraguayan guaraní).
- Colors are stored as hex strings validated by `hexColorRegex` in `lib/constants.ts` and rendered as swatches (`<input type="color">` in forms, colored `<div>` in tables).

### Component usage

- Before building any UI, check `components/` for something reusable — both `components/ui/` primitives and existing feature components (e.g. `FormContainer`, `TableSkeleton`). Don't recreate what's already there.
- For a basic element (input, label, button, checkbox, badge, card, dropdown, table, skeleton), use the shadcn/ui primitive in `components/ui/` directly rather than hand-rolling markup.
- For anything more complex than a single primitive covers (a composed field, a piece of UI reused across more than one form/table, a non-trivial interaction), build a dedicated component instead of inlining it in a page or form.
- New shadcn/ui primitives get added via `npx shadcn@latest add <component>` (style `new-york`, base color `neutral`, no prefix — see `components.json`) so they land in `components/ui/` with the project's existing conventions, not hand-written from scratch.
- New feature components follow the existing folder structure: colocate under `components/<entity>/` (e.g. `components/accounts/`) alongside that entity's `create-form.tsx` / `edit-form.tsx` / `delete-form.tsx` / `table.tsx`, and reuse `FormContainer` for create/edit page layout. Cross-entity/shared components (not tied to one domain) go at the top level of `components/`, matching `form-container.tsx`, `table-skeleton.tsx`, `sidebar.tsx`, etc.
