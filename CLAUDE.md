# CLAUDE.md

Este archivo orienta a Claude Code (claude.ai/code) al trabajar con el código de este repositorio.

## Descripción del proyecto

App de finanzas personales construida sobre el starter kit de Next.js + Supabase (App Router). Cada usuario administra sus cuentas (con saldo), tipos de movimiento (categorías de ingreso/egreso) y movimientos (transacciones), todo asociado a su usuario autenticado en Supabase. Todos los textos de la interfaz están en español.

## Comandos

```bash
npm run dev      # levanta el servidor de desarrollo (localhost:3000)
npm run build    # build de producción
npm run start    # corre el build de producción
npm run lint     # eslint (next/core-web-vitals + next/typescript)
npm run test:e2e # tests e2e de Playwright en e2e/, con la sesión del usuario de QA
```

La única suite de tests es Playwright e2e (`playwright.config.ts`, `e2e/`). Corre contra el **Supabase remoto real** como el usuario de QA (`QA_EMAIL`/`QA_PASSWORD`), en serie (`workers: 1`). Un proyecto `setup` inicia sesión una sola vez y guarda la sesión en `e2e/.auth/qa.json` (ignorado por git); el resto de los tests arranca ya autenticado. Reutiliza un `npm run dev` que ya esté corriendo en `localhost:3000` (se cambia con `E2E_BASE_URL`) o levanta uno — Next 16 no permite dos `next dev` sobre el mismo proyecto, así que no hay que apuntarlo a un segundo puerto. Los tests se nombran según el criterio del plan que cubren (`P.n — …`); las convenciones están en `.claude/agents/tester.md`.

Las variables de entorno viven en `.env.local`: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_BASE_URL`, más `QA_EMAIL` / `QA_PASSWORD` (el usuario de QA con el que inicia sesión el agente `tester` — nunca imprimirlas ni commitearlas).

## Planes y ejecución orquestada

Las funcionalidades se planifican con la skill `escribir-plan` en `docs/plans/<feature>-implementation.md` y se ejecutan en una sesión aparte con la skill `ejecutar-plan`: la sesión actúa como **orquestador** y lanza los subagentes de `.claude/agents/` — `implementador` (Sonnet, escribe el código y marca `[x]`) y `tester` (playwright-cli, verifica en el navegador los *Criterios de prueba* del plan y escribe tests de Playwright en `e2e/`). El orquestador deriva al implementador las incidencias que encuentra el tester, mantiene el *Registro de ejecución* del plan y atiende las correcciones posteriores que pida el usuario.

## Arquitectura

### Patrón de módulo por entidad (accounts, movement-types, movements)

Cada entidad del dominio sigue la misma estructura — al agregar una entidad o un campo nuevo, replicarla tal cual:

- `lib/schemas/<entity>.ts` — esquema Zod (`<entity>Schema`) que se usa tanto para validar el formulario en el cliente como para los payloads de insert/update de Supabase, más los tipos TS (`<Entity>`, `create<Entity>`) que usan el código de servidor y el de cliente. Los tipos se declaran a mano para que coincidan con las columnas exactas que selecciona la capa de servicios — no se derivan de los tipos generados de Supabase.
- `lib/services/<entity>.ts` — lecturas **solo de servidor** (`createClient` de `lib/supabase/server`, usado desde Server Components/páginas). Siempre obtiene el usuario autenticado con `supabase.auth.getUser()` y acota las consultas con `.eq("user_id", ...)` en las tablas con dueño (accounts, movements). `movement_types` es una tabla compartida/global, sin filtro por usuario.
- `lib/services/<entity>.client.ts` — mutaciones **solo de cliente** (`createClient` de `lib/supabase/client`, usado desde formularios `"use client"`). Vuelve a validar la entrada con el esquema Zod vía `safeParse` antes de llamar a Supabase, aunque el formulario ya la haya validado.
- `components/<entity>/create-form.tsx`, `edit-form.tsx` (o `edit.form.tsx`), `delete-form.tsx`, `table.tsx` — formularios `"use client"` hechos con `react-hook-form` + `@hookform/resolvers/zod`; `table.tsx` es un Server Component asíncrono que llama directo al servicio de lectura y renderiza la `<Table>` de shadcn/ui.
- `app/protected/<entity>/page.tsx` — página de listado; renderiza la tabla dentro de `<Suspense fallback={<TableSkeleton />}>`.
- `app/protected/<entity>/create/page.tsx`, `edit/[id]/page.tsx`, `delete/[id]/page.tsx` — rutas mínimas que envuelven el formulario con el layout compartido `FormContainer`; las páginas de edición y borrado traen el registro en el servidor con `get<Entity>ById` y llaman a `notFound()` si no existe.

Después de cualquier mutación en el cliente, los formularios llaman a `revalidateMyDataAndRedirect(path)` (`lib/services/revalidate.ts`, una acción `"use server"`) para revalidar la caché de la ruta del listado y redirigir de vuelta a ella — ese es el flujo estándar después de mutar, no `router.push` + refetch manual.

Para saber si un registro no existe se compara `error.details === notFoundDetailMessage` (de `lib/constants.ts`) en vez del código de error de Postgrest: acá el error de `.single()` de Supabase se reconoce por el texto del mensaje.

### Esquema de base de datos, triggers y RLS

El esquema (tablas, índices, triggers, funciones, políticas RLS) está versionado de forma declarativa en `supabase/schemas/**`, con una migración baseline escrita a mano en `supabase/migrations/`. Ese árbol es la fuente de verdad de *qué* existe. [`docs/database.md`](docs/database.md) es la fuente de verdad del *porqué* — lo que el SQL no dice por sí solo — y [`docs/supabase.md`](docs/supabase.md) documenta el flujo para cambiar el esquema (`migration new` → editar → `db:push` → `db:pull` → `db:types`) y qué comandos del CLI de `supabase` no funcionan en esta máquina (no hay Docker en esta distro de WSL2).

- **Triggers/funciones** — qué hacen está en `supabase/schemas/public/{tables,functions}/*.sql`. [`docs/database.md`](docs/database.md) tiene las reglas que le imponen a la app (nunca escribir `updated_at` ni `current_balance` desde la app, `movements.type` tiene que ser exactamente `credit`/`debit`) y las consultas de diagnóstico y reparación del descuadre de saldos. Leerlo antes de tocar la lógica de saldos de `movements` o `accounts`.
- **RLS** — el modelo de pertenencia (`movements` no tiene `user_id`; la pertenencia se resuelve a través de `accounts`) y el DDL de las políticas están en `supabase/schemas/public/tables/*.sql`; [`docs/database.md`](docs/database.md#row-level-security-rls) tiene las consultas de verificación y por qué la RLS es la única barrera de seguridad: `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` viaja en el bundle del navegador, así que los filtros `.eq("accounts.user_id", ...)` de `lib/services/*` son comodidad de consulta, no protección. Toda tabla nueva necesita RLS habilitada más una política, y las políticas usan `(select auth.uid())`, nunca `auth.uid()` a secas.
- **`movements.external_id`** — el índice único `(account_id, external_id)` que sostiene la importación de extractos bancarios (deduplicación), definido en `supabase/schemas/public/tables/movements.sql`. Ver [`docs/database.md`](docs/database.md#índices-y-restricciones) para saber por qué no es parcial y el efecto secundario de `onConflict`.
- **Tipos generados vs. esquemas a mano** — `lib/supabase/database.types.ts` (generado con `npm run db:types`) tipa los tres constructores del cliente de Supabase y las llamadas `.rpc()`; describe las tablas crudas. `lib/schemas/*.ts` sigue escrito a mano con Zod: describe las formas con joins que devuelven los servicios (`Movement` embebe `accounts`/`movement_types`), que ningún tipo generado expresa. No migrar `lib/schemas/*.ts` a los tipos generados — el porqué está en [`docs/supabase.md`](docs/supabase.md).

### Importación de extractos bancarios

`app/protected/movements/import` permite subir un extracto bancario (hoy XLSX) y crear movimientos en lote sin duplicar una importación anterior. Ver [`docs/imports.md`](docs/imports.md) para el motor de adaptadores (`lib/imports/`), cómo agregar el formato de un banco nuevo y dónde suelen romperse los adaptadores. Todo el parseo corre en el cliente; esta funcionalidad no tiene Route Handler.

### Dashboard (`app/protected/page.tsx`)

`lib/services/dashboard.ts` + `components/dashboard/` renderizan el dashboard de inicio:
distribución del saldo entre cuentas, gastos por tipo de movimiento y flujo mensual de
ingresos/egresos. El estado vive en la URL (`?accountId=&startDate=&endDate=`), con el mes actual
como valor por defecto (`lib/dashboard/date-range.ts`) y la cuenta principal como cuenta por defecto
(`lib/accounts/primary.ts`) — mismo patrón que `movements`. Los filtros se comparten con `movements`
a través de `components/date-range-filter.tsx`.

**Toda agregación de este módulo va por funciones RPC de Postgres, nunca sumando filas crudas en
JS.** PostgREST corta las lecturas en 1000 filas (`db.max_rows`); una agregación que pagina filas y
suma en el cliente cuenta de menos, en silencio, apenas un usuario supera ese umbral.
`getMovementsTotals` (`lib/services/movements.ts`) también usa este patrón, así que sigue siendo
correcto a escala. Las cuatro funciones RPC (`get_expenses_by_movement_type`,
`get_movements_totals`, `get_monthly_flow`, `get_daily_expenses_by_movement_type`) están versionadas
en `supabase/schemas/public/functions/` y documentadas en
[`docs/database.md`](docs/database.md#funciones-rpc-del-dashboard). Los cards "Gastos por tipo" y
"Gastos diarios por tipo" excluyen los tipos de movimiento con
`movement_types.exclude_from_expense_charts` (filtrado dentro de la RPC); "Egresos", el flujo
mensual, los presupuestos y "Mayores gastos" deliberadamente no lo respetan. Los gráficos son
`"use client"` (Recharts necesita el DOM) pero solo dibujan datos ya agregados que reciben por
props; el Server Component que consulta la RPC envuelve cada gráfico en un `<Card>` y maneja el
estado vacío.

El card de gastos diarios (`components/dashboard/daily-expenses-card.tsx`) tiene **su propio
período, independiente del filtro `startDate`/`endDate` de la página** — lee de la URL `dailyRange`
(`7d` | `30d` | `custom`, por defecto `7d`), `dailyStart`/`dailyEnd` (solo con `dailyRange=custom`,
con tope de 92 días) y `dailyTypes` (`all` desactiva el agrupamiento de los 8 principales más
"Otros"), que resuelve en el servidor `resolveDailyExpensesRange` (`lib/dashboard/date-range.ts`).
Sí sigue el filtro de cuenta de la página (`accountFilter.accountId`). Es un gráfico de barras
apiladas (una barra por día, un segmento por tipo, el total del día arriba); el rango efectivo se
**corta en hoy** (`endDate`, nunca días futuros) mientras que `requestedEndDate` conserva el "Hasta"
del usuario para los inputs. "Hoy" sale de `todayInAppTimeZone()` (`America/Asuncion`), no de la
zona horaria del proceso de Node. Las barras corren con `isAnimationActive={false}`: la animación
de Recharts mide con el render anterior y puede dejar el gráfico a medio dibujar después de un
`router.push` (eso era lo que recortaba el gráfico de líneas anterior). El rango personalizado solo
navega con "Aplicar" (los inputs Desde/Hasta son un borrador local), y toda navegación de filtros
usa `router.push(..., { scroll: false })` para que la página no salte al inicio.

### Filtro de cuenta y cuenta principal

`accounts.is_primary` marca la cuenta preseleccionada. `lib/accounts/primary.ts`
(`resolveAccountFilter`, puro y síncrono, mismo molde que `lib/dashboard/date-range.ts`) resuelve
el `?accountId` **en el servidor**: ausente ⇒ cuenta principal, `all` ⇒ sin filtro, uuid ⇒ esa
cuenta. Devuelve `accountId` (uuid | `undefined`, para los servicios) y `param` (uuid | `"all"`,
para la URL y el `<AccountSelect>`).

**Dos invariantes:** (1) el centinela `"all"` nunca llega a `lib/services/*` — `getMovements`,
`getMovementsTotals`, `getExpensesByMovementType` y `getMonthlyFlow` solo reciben un uuid o
`undefined`; (2) todo href armado a mano (paginación, `movementsHref`, "Limpiar filtros") define
`accountId` de forma explícita, porque la ausencia del parámetro significa "cuenta principal", no
"todas".

Igual que `startDate`/`endDate` en el dashboard, el valor resuelto viaja como **prop** a los
filtros de cliente; no se vuelve a leer de la URL en el cliente, porque si no el select y la tabla
se desincronizan. Puede haber varias cuentas principales (ver
[`docs/database.md`](docs/database.md#cuenta-principal-accountsis_primary)); se usa la primera por
nombre.

### Presupuestos (`app/protected/budgets`)

Tope de gasto mensual por tipo de movimiento. Estructura: `lib/schemas/budgets.ts`,
`lib/services/budgets.ts` (servidor) / `budgets.client.ts` (mutaciones), `lib/budgets/month.ts`
(helpers de mes en hora local), `components/budgets/`, `app/protected/budgets/**` (incluye `[id]` =
histórico). Tablas `budgets` (configuración) y `budget_periods` (tope de cada mes), más las RPC
`ensure_budget_periods`, `get_budget_status` y `get_budget_history`; ver
[`docs/database.md`](docs/database.md#presupuestos-mensuales).

**Lo gastado se calcula por RPC y nunca se guarda: no hay columna `spent` ni trigger que descuente**
(mismo problema que `accounts.current_balance`; el porqué está en `docs/database.md`). El mes es
siempre el mes calendario (`?month=YYYY-MM`): no usa `DateRangeFilter` ni `resolveDateRange`. En
`getBudgetStatus`, `ensure_budget_periods` corre antes que `get_budget_status` y escribe durante el
render, así que esa lectura no se cachea.

### Transferencias (`app/protected/transfers`)

Traspaso entre dos cuentas propias: dos filas de `movements` apareadas por `transfer_id`, escritas
solo por las RPC `create_transfer` / `update_transfer` / `delete_transfer`
(`lib/services/transfers.client.ts`); ningún componente inserta filas de `movements` para una
transferencia. Estructura: `lib/schemas/transfers.ts`, `lib/services/transfers{,.client}.ts`,
`components/transfers/`, `app/protected/transfers/{create,edit/[id],delete/[id]}` (el `[id]` es el
`transfer_id`). Sin listado ni ítem en el sidebar: viven dentro de movimientos. Ver
[`docs/database.md`](docs/database.md#transferencias-entre-cuentas).

**Dos reglas:** (1) toda agregación nueva sobre `movements` tiene que excluir
`transfer_id is not null` (única excepción: `get_movements_totals` con cuenta filtrada, ver
`docs/database.md`); (2) `movement_types` ya no es escribible por cualquier autenticado: solo
el dueño (UUID literal en la política), y el tipo `Transferencia` (`transferMovementTypeId`) no se
ofrece en selects ni se edita/borra.

### Deudas (`app/protected/debts`)

Servicios (sin fin definido) y pagos en cuotas: cada pago es un movimiento `debit` normal vinculado
por `movements.debt_id` (`ON DELETE SET NULL`, así que borrar una deuda no borra sus movimientos).
Estructura: `lib/schemas/debts.ts`, `lib/services/debts.ts` (servidor) / `debts.client.ts`
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
como `updateMovement` hace `.update(parsed.data)`, un `debt_id` con valor por defecto `null` en el
esquema desvincularía en silencio el pago al editarlo desde `/protected/movements`.

`components/mobile-nav.tsx` usa `NavItem.mobilePinned` para elegir los 4 ítems fijos de la barra
inferior flotante; el resto (hoy: Tipos de movimientos y Deudas) va al botón "Menú", un
`DropdownMenu` con una grilla de 3 columnas.

Pagar y editar una deuda se abren desde el listado, el detalle o el dashboard: los enlaces pasan
`?returnTo=` (`withReturnTo` / `resolveReturnTo` en `lib/return-to.ts`, que solo acepta rutas de
`/protected`) y la página lo usa para la flecha "<" y para la redirección después de guardar. Sin
el parámetro, vuelven al detalle.

### Fecha y hora de movimientos

`movements.date` es `timestamp` (hora local de Paraguay, sin zona). Tres reglas: (1) todo fin de
rango es **exclusivo** (`< nextDay(endDate)` en JS, `< p_end_date + interval '1 day'` en SQL), nunca
`<=`; (2) `getMovements` ordena por `date desc, created_at desc` — el desempate no es decorativo:
sin él el orden entre filas con la misma fecha es arbitrario y `.range()` repite o salta filas;
(3) valores por defecto, valores de `datetime-local` y formato se calculan en hora local con
`lib/movements/datetime.ts`, nunca con `toISOString()`. Ver
[`docs/database.md`](docs/database.md#movementsdate-fecha-y-hora).

### Autenticación y clientes de Supabase

Hay tres constructores del cliente de Supabase, uno por contexto — usar el que corresponda a dónde corre el código:
- `lib/supabase/server.ts` — Server Components, Route Handlers, Server Actions.
- `lib/supabase/client.ts` — Client Components (`"use client"`).
- `lib/supabase/middleware.ts` — `updateSession()`, llamado desde el `middleware.ts` de la raíz.

`middleware.ts` intercepta todas las rutas salvo assets estáticos e imágenes y ejecuta `updateSession`, que refresca la sesión de Supabase y redirige a `/auth/login` a los usuarios no autenticados en cualquier ruta fuera de `/`, `/login` y `/auth`. No reordenar el código alrededor de `supabase.auth.getClaims()` en `lib/supabase/middleware.ts` ni quitar la lógica que reenvía las cookies — ambas cosas están señaladas en el propio archivo como formas fáciles de provocar pérdidas de sesión aleatorias.

Las rutas bajo `app/protected/` son la app autenticada (sidebar + contenido); `app/auth/` contiene los flujos de inicio de sesión, registro y recuperación de contraseña del starter de Supabase UI Library.

### Otras convenciones

- Usar siempre llaves en los `if`, incluso con una sola sentencia — nada de `if (x) doThing();` en una línea ni de `if` multilínea sin llaves. Aplica a todo el TS/TSX del repo.
- El alias de ruta `@/*` apunta a la raíz del repo (ver `tsconfig.json`).
- shadcn/ui está configurado con estilo `new-york`, color base `neutral` y sin prefijo (`components.json`); las primitivas viven en `components/ui/`. `axios` está configurado en `lib/axios/index.ts` con `NEXT_PUBLIC_BASE_URL` como base, pero hoy no lo usan los servicios CRUD de arriba (llaman directo a Supabase).
- Los montos se formatean con `toLocaleString("es-PY")` y el prefijo `Gs.` (guaraní paraguayo).
- Los colores se guardan como strings hexadecimales validados con `hexColorRegex` de `lib/constants.ts` y se muestran como muestras de color (`<input type="color">` en formularios, un `<div>` coloreado en tablas).
- Todo monto se carga con `AmountInput` (`components/amount-input.tsx`), que acepta una cuenta (`=20000+10000`, Enter) además de un número; la lógica vive en `lib/amounts/calculator.ts` y es pura (sin React). Tres reglas: (1) nunca `eval` ni `new Function` para evaluar la expresión; (2) con una expresión sin resolver el formulario recibe el resultado o `0`, nunca el monto anterior; (3) los `aria-label` de sus botones no pueden contener "monto", porque los tests localizan el campo con `getByLabel("Monto")`.

### Uso de componentes

- Antes de construir cualquier UI, revisar si en `components/` ya hay algo reutilizable — tanto las primitivas de `components/ui/` como los componentes existentes (p. ej. `FormContainer`, `TableSkeleton`). No recrear lo que ya está.
- Para un elemento básico (input, label, botón, checkbox, badge, card, dropdown, tabla, skeleton), usar directamente la primitiva de shadcn/ui en `components/ui/` en vez de armar el markup a mano.
- Para cualquier cosa más compleja de lo que cubre una sola primitiva (un campo compuesto, una pieza de UI que se reutiliza en más de un formulario o tabla, una interacción no trivial), crear un componente dedicado en vez de dejarlo inline en una página o formulario.
- Las primitivas nuevas de shadcn/ui se agregan con `npx shadcn@latest add <component>` (estilo `new-york`, color base `neutral`, sin prefijo — ver `components.json`) para que caigan en `components/ui/` con las convenciones del proyecto, no escritas a mano desde cero.
- Los componentes nuevos de una entidad siguen la estructura de carpetas existente: van en `components/<entity>/` (p. ej. `components/accounts/`) junto al `create-form.tsx` / `edit-form.tsx` / `delete-form.tsx` / `table.tsx` de esa entidad, y reutilizan `FormContainer` para el layout de las páginas de alta y edición. Los componentes compartidos entre entidades (no atados a un dominio) van en la raíz de `components/`, como `form-container.tsx`, `table-skeleton.tsx`, `sidebar.tsx`, etc.
