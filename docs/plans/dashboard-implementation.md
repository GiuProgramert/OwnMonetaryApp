# Plan: dashboard con gráficos y filtros

**Fecha:** 2026-08-23
**Estado:** implementado — fases 1 a 7.1 hechas; 7.2–7.5 requieren verificación manual en el
navegador logueado (ver Notas de cierre)

## Objetivo

Convertir `app/protected/page.tsx` (hoy vacía, con un `TODO`) en el dashboard de la app: la
distribución del dinero entre cuentas, en qué se gasta, y los totales del período — todo
gobernado por un filtro de fecha que arranca en el mes actual y un selector de cuenta.

## Cómo ejecutar este plan

- **Verificá antes de arrancar que lo que este plan afirma del código siga siendo cierto.** Está
  fechado; los archivos, servicios y componentes que nombra pueden haber cambiado desde entonces.
- **Seguí el orden de las fases.** La 2 (RPC) bloquea a la 3 (servicios), y la 3 bloquea a la 5
  (gráficos). La 1 se puede hacer en cualquier momento antes de la 5.
- **Si la realidad contradice al plan, pará y preguntá** en vez de improvisar una salida. Vale
  especialmente para la Fase 2: si las funciones no se pueden crear en Supabase desde la sesión que
  ejecuta, el punto queda bloqueado y se anota — no se reemplaza por sumas en JS, que es justo lo
  que este plan decidió no hacer.
- **No amplíes el alcance.** Lo que está en [Fuera de alcance](#fuera-de-alcance) se descartó a
  propósito y con motivo.
- **Marcá `[x]` a medida que avanzás** y actualizá el **Estado** del encabezado. Un punto que quede
  sin hacer se deja en `[ ]` con el motivo escrito ahí mismo — nunca se borra.
- **Al terminar, escribí las Notas de cierre** al final del documento: qué se desvió del plan y por
  qué, qué quedó sin hacer, qué se verificó y **qué no se pudo verificar**. Lo último es lo más
  valioso de la sección y lo primero que se omite.

## Contexto

Lo que ya existe y **hay que reusar, no reescribir**:

- `AccountSelect` y `MovementTypeSelect` (`components/`) — selects con swatch de color y opción
  "todas/todos".
- `MovementsTotals` (`components/movements/totals.tsx`) — cards de ingresos/egresos/balance neto,
  ya recibe un `MovementFilter`.
- El patrón de filtros por `searchParams` + Server Component de
  `app/protected/movements/page.tsx` + `components/movements/filters.tsx`.
- `FormContainer`, `TableSkeleton`, y los primitivos de `components/ui/`.

Tres restricciones del sistema condicionan todo el diseño de abajo:

1. **`accounts.current_balance` es un saldo actual mantenido por trigger**, sin historia (ver
   [`docs/database.md`](../database.md), "El saldo es incremental, no calculado"). No se puede
   reconstruir "el saldo al 31 de marzo" sin recorrer todos los movimientos previos.
2. **PostgREST corta en 1000 filas por defecto** (`db.max_rows`). Cualquier agregación que baje
   filas crudas y sume en JS **subcuenta en silencio** al pasar ese umbral. `getMovementsTotals`
   ya tiene ese problema hoy.
3. **La RLS es la única barrera de seguridad** (`docs/database.md`). Todo lo que se agregue a la
   base — funciones incluidas — tiene que respetarla.

## Decisiones tomadas

- **La torta muestra el saldo actual (`current_balance`), no un saldo derivado del rango.** Es un
  dato exacto y ya calculado; la alternativa (créditos − débitos del período) no es un saldo sino
  un flujo neto. Consecuencia: **la torta no depende del filtro de fecha**, y por eso su título
  tiene que decirlo explícitamente ("Distribución del saldo actual").
- **Si alguna cuenta tiene saldo ≤ 0, el gráfico cae a barras horizontales** con los mismos datos.
  No debería pasar — un saldo negativo es un descuadre o un error de carga — pero una torta con un
  valor negativo dibuja porcentajes sin sentido en vez de fallar, y eso es peor que no dibujarla.
- **Las agregaciones se resuelven con funciones RPC en Postgres**, no sumando en JS. Es la única
  forma correcta con el límite de 1000 filas, y de paso baja al browser 10 filas en vez de 2000.
  Contrapartida asumida: agrega objetos de base que este repo no versiona → se documentan en
  `docs/database.md` (punto 6.5), igual que los triggers.
- **Los colores salen de la base** (`accounts.color`, `movement_types.color`), no de la paleta
  `--chart-1..5`. Una cuenta tiene el mismo color en la tabla, en el select y en el gráfico. La
  paleta queda como fallback.
- **El estado del dashboard vive en la URL** (`?accountId=&startDate=&endDate=`), igual que
  movimientos: Server Components, sin estado de cliente, filtros compartibles.
- **La agregación corre en el servidor; solo el dibujo es cliente.** Recharts necesita DOM, así que
  cada gráfico es un `"use client"` que recibe datos ya agregados por props.

## Fase 1 — Dependencias y primitivas

- [x] **1.1** `npx shadcn@latest add chart` — instala `components/ui/chart.tsx` y agrega `recharts`
  a las dependencias. Es el único primitivo que falta; `card`, `select`, `skeleton`, `button`,
  `label` e `input` ya están.
- [x] **1.2** Verificar que `--chart-1..5` estén definidas en `app/globals.css` para los dos temas
  (`tailwind.config.ts` ya las mapea a `colors.chart`). Se usan solo como fallback cuando una
  cuenta o tipo no tenga color propio.

## Fase 2 — Funciones RPC en Supabase

Las tres funciones comparten la misma forma: **`security invoker`** (el default, y lo que hace que
la RLS del usuario siga aplicando dentro de la función) y **`set search_path = ''`** con todo
schema-calificado, que es lo que pide el linter de Supabase para no depender del `search_path` de
quien llama.

> ⚠️ `security definer` acá sería un agujero: la función correría con los permisos del dueño y
> devolvería los movimientos de **todos** los usuarios. No usarlo.

⚠️ **Esta fase la corre el usuario a mano**, en el SQL editor de Supabase, **antes de empezar la
Fase 3**. La sesión que implementa no puede hacerlo: no hay CLI de Supabase ni carpeta `supabase/`
en el repo, y la única credencial disponible es `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, que es la
clave pública del browser y no crea funciones. Por eso los tres bloques de SQL están escritos
completos y listos para copiar y pegar. La Fase 1 no depende de esto y se puede hacer antes,
después o en paralelo.

- [x] **2.1** `get_expenses_by_movement_type(p_account_id uuid, p_start_date date, p_end_date date)`
  → `table(movement_type_id uuid, name text, color text, total bigint)`. Suma `amount` de los
  movimientos con `type = 'debit'`, agrupa por tipo, ordena desc. Los tres parámetros son
  nullables: `null` = sin filtrar.

  ```sql
  create or replace function public.get_expenses_by_movement_type(
    p_account_id uuid default null,
    p_start_date date default null,
    p_end_date date default null
  )
  returns table (movement_type_id uuid, name text, color text, total bigint)
  language sql
  stable
  security invoker
  set search_path = ''
  as $$
    select mt.id, mt.name, mt.color, sum(m.amount)::bigint as total
    from public.movements m
    join public.accounts a on a.id = m.account_id
    join public.movement_types mt on mt.id = m.movement_type_id
    where m.type = 'debit'
      and a.user_id = (select auth.uid())
      and (p_account_id is null or m.account_id = p_account_id)
      and (p_start_date is null or m.date >= p_start_date)
      and (p_end_date   is null or m.date <= p_end_date)
    group by mt.id, mt.name, mt.color
    order by total desc;
  $$;

  grant execute on function public.get_expenses_by_movement_type(uuid, date, date) to authenticated;
  ```

- [x] **2.2** `get_movements_totals(...)` → `table(income bigint, expense bigint)`. **Reemplaza la
  suma en JS de `getMovementsTotals`**, que hoy subcuenta pasadas las 1000 filas. El `coalesce` es
  necesario: sin filas, `sum()` devuelve `null`, no `0`.

  ```sql
  create or replace function public.get_movements_totals(
    p_account_id uuid default null,
    p_movement_type_id uuid default null,
    p_start_date date default null,
    p_end_date date default null
  )
  returns table (income bigint, expense bigint)
  language sql
  stable
  security invoker
  set search_path = ''
  as $$
    select
      coalesce(sum(m.amount) filter (where m.type = 'credit'), 0)::bigint as income,
      coalesce(sum(m.amount) filter (where m.type = 'debit'),  0)::bigint as expense
    from public.movements m
    join public.accounts a on a.id = m.account_id
    where a.user_id = (select auth.uid())
      and (p_account_id       is null or m.account_id       = p_account_id)
      and (p_movement_type_id is null or m.movement_type_id = p_movement_type_id)
      and (p_start_date is null or m.date >= p_start_date)
      and (p_end_date   is null or m.date <= p_end_date);
  $$;

  grant execute on function public.get_movements_totals(uuid, uuid, date, date) to authenticated;
  ```

- [x] **2.3** `get_monthly_flow(...)` → `table(month date, income bigint, expense bigint)`. Alimenta
  el gráfico de evolución (5.6). El `::timestamp` es explícito a propósito: `date_trunc` tiene varias
  sobrecargas y con un `date` pelado la resolución es ambigua.

  ```sql
  create or replace function public.get_monthly_flow(
    p_account_id uuid default null,
    p_start_date date default null,
    p_end_date date default null
  )
  returns table (month date, income bigint, expense bigint)
  language sql
  stable
  security invoker
  set search_path = ''
  as $$
    select
      date_trunc('month', m.date::timestamp)::date as month,
      coalesce(sum(m.amount) filter (where m.type = 'credit'), 0)::bigint as income,
      coalesce(sum(m.amount) filter (where m.type = 'debit'),  0)::bigint as expense
    from public.movements m
    join public.accounts a on a.id = m.account_id
    where a.user_id = (select auth.uid())
      and (p_account_id is null or m.account_id = p_account_id)
      and (p_start_date is null or m.date >= p_start_date)
      and (p_end_date   is null or m.date <= p_end_date)
    group by 1
    order by 1;
  $$;

  grant execute on function public.get_monthly_flow(uuid, date, date) to authenticated;
  ```

  ⚠️ **Devuelve solo los meses que tienen movimientos.** Un mes vacío en el medio del rango no viene
  como fila con ceros: directamente no viene. El gráfico de 5.6 tiene que rellenar los huecos, o va a
  dibujar dos meses contiguos que en realidad están separados por tres.

  > Nota (2026-09-03): el SQL de estas tres funciones ahora vive versionado en
  > `supabase/schemas/public/functions/` (ver `docs/plans/supabase-environment-implementation.md`).
  > Este plan no se reescribe — queda como registro histórico.

- [ ] **2.4** Confirmar que el `sum()` de guaraníes cabe en `bigint` (sí) y en el `number` de JS al
  serializar (sí, hasta 2^53 — no hace falta tratarlo como string).
- [ ] **2.5** Smoke test en el SQL editor: que las tres funciones existan y no tiren error de
  sintaxis. ⚠️ **Esto no valida la seguridad**: el SQL editor corre como `postgres` y **bypassea la
  RLS**, así que una función que devuelve datos de otros usuarios se ve perfecta ahí. La verificación
  real es el punto 7.2.

## Fase 3 — Servicios (`lib/services/dashboard.ts`, server-only)

- [x] **3.1** `lib/schemas/dashboard.ts` — `DashboardFilter` (`accountId`, `startDate`, `endDate`,
  todos `string | undefined`) y los tipos de salida: `AccountBalanceSlice`, `ExpenseByType`,
  `MonthlyFlow`. Hand-declarados para calzar con lo que devuelve cada RPC, igual que el resto de
  los schemas del repo.
- [x] **3.2** `getAccountsBalanceDistribution()` — reusa `getAccounts()` (no hace falta query
  nueva), devuelve `{ slices, total, hasNonPositive }` donde `slices` trae `id`, `name`, `color`,
  `balance` y `percentage`. `hasNonPositive` es lo que dispara el fallback a barras de 4.1.
- [x] **3.3** `getExpensesByMovementType(filter)` — `supabase.rpc("get_expenses_by_movement_type", …)`,
  agrega el porcentaje sobre el total y aplica el agrupamiento en "Otros" de 4.3.
- [x] **3.4** `getMonthlyFlow(filter)` — `supabase.rpc("get_monthly_flow", …)`, con el mes ya
  formateado en español para el eje.
- [x] **3.5** Migrar `getMovementsTotals` (`lib/services/movements.ts`) a `supabase.rpc(...)`
  manteniendo **exactamente la misma firma y el mismo shape de retorno**
  (`{ income, expense, net }`), para no tocar `components/movements/totals.tsx`.
- [x] **3.6** Todas verifican `supabase.auth.getUser()` y tiran `Error("User not authenticated")`
  como el resto de los servicios del repo.
- [x] **3.7** Helper `lib/dashboard/date-range.ts` con `getCurrentMonthRange()` y
  `resolveDateRange(searchParams)`. ⚠️ Las fechas se construyen en **hora local**, no con
  `toISOString()`, que convierte a UTC y en Paraguay (UTC−3/−4) devuelve el día anterior — la
  columna `date` es `date`, sin zona horaria.

## Fase 4 — Filtros (`components/dashboard/filters.tsx`)

- [x] **4.1** Client Component que escribe en la URL, calcado del `setParam` de
  `components/movements/filters.tsx`. **Sin** filtro por tipo de movimiento: en el dashboard el
  tipo de movimiento es el eje del gráfico de barras, filtrar por él lo dejaría con una sola barra.
- [x] **4.2** **Default = mes actual**, resuelto en la página (5.1) con `resolveDateRange`: si no
  vienen `startDate`/`endDate` en la URL, se usan el primer y último día del mes en curso.
- [x] **4.3** Presets rápidos como botones: "Mes actual", "Mes anterior", "Últimos 3 meses",
  "Este año", más los dos `<input type="date">` para rango libre. El preset activo se marca visualmente.
- [x] **4.4** Selector de cuenta con `AccountSelect` y `allLabel="Todas las cuentas"`.
- [x] **4.5** Extraer el rango de fechas a `components/date-range-filter.tsx` compartido y usarlo
  **también** en `components/movements/filters.tsx`. Sin esto quedan dos implementaciones del mismo
  control divergiendo; con esto, movimientos hereda gratis los presets de 4.3.
- [x] **4.6** "Limpiar filtros" vuelve al **default (mes actual)**, no a "sin filtro" — o sea,
  `router.push(pathname)`, que es lo mismo, pero el texto del botón tiene que reflejarlo.

## Fase 5 — Gráficos (`components/dashboard/`)

- [x] **5.1** `balance-pie-chart.tsx` — **dona** con el **total en el centro** en `Gs.`, un slice
  por cuenta con `account.color`, leyenda con nombre + monto + porcentaje, y tooltip. Las cuentas
  con saldo 0 se omiten del dibujo.
- [x] **5.2** Fallback de 5.1: si `hasNonPositive` es `true`, renderizar **barras horizontales** en
  vez de la dona, con una nota explicando por qué ("Hay cuentas con saldo negativo; los porcentajes
  no aplican"). Es defensivo — un saldo negativo indica descuadre, ver la sección de diagnóstico de
  [`docs/database.md`](../database.md#descuadre-de-saldos).
- [x] **5.3** El título del card dice **"Distribución del saldo actual"** y el `CardDescription`
  aclara que **no depende del rango de fechas seleccionado**. Sin esa aclaración el gráfico miente
  cada vez que se cambia el filtro y los números no se mueven.
- [x] **5.4** `expenses-by-type-chart.tsx` — **barras horizontales**, no verticales: los nombres de
  los tipos de movimiento son largos en español y en vertical quedan rotados e ilegibles. Ordenadas
  de mayor a menor, con el monto al final de cada barra y el color del tipo.
- [x] **5.5** Agrupar la cola en **"Otros"**: si hay más de 8 tipos, mostrar el top 8 y sumar el
  resto en una barra gris. Con 15 barras el gráfico deja de leerse.
- [x] **5.6** `monthly-flow-chart.tsx` — barras de ingresos vs. egresos por mes con línea de balance
  neto. Se renderiza **solo si el rango abarca más de un mes**; con un mes solo repite lo que ya
  dicen las cards de totales.
- [x] **5.7** Cada gráfico dentro de un `<Card>` con header descriptivo, y **estado vacío explícito**
  cuando no hay datos ("No hay gastos registrados en este período"), nunca un lienzo en blanco.
- [x] **5.8** Los ejes de monto se formatean abreviados (`1,2 M`) — un eje con
  `Gs. 12.500.000` en cada tick se come la mitad del ancho del gráfico. El tooltip sí muestra el
  número completo con `toLocaleString("es-PY")`.

## Fase 6 — Página (`app/protected/page.tsx`)

- [x] **6.1** Reescribir la página: leer `searchParams` (es una `Promise` en Next 16, como en
  `movements/page.tsx`), resolver el rango por defecto con `resolveDateRange`, y mantener el
  `getClaims()` + `redirect("/auth/login")` que ya está.
- [x] **6.2** Layout: filtros arriba → fila de KPIs → grilla de 2 columnas con dona y barras
  (1 columna en mobile) → evolución mensual a lo ancho → últimos movimientos y top gastos.
- [x] **6.3** **Reusar `MovementsTotals`** para ingresos/egresos/balance neto del período. Ya existe
  y ya toma un `MovementFilter` — pasarle `{ ...filter, movementTypeId: undefined, page: undefined }`.
- [x] **6.4** Card de **"Patrimonio total"** — suma de todos los `current_balance`. Es el número que
  uno busca primero al entrar y hoy no aparece en ninguna pantalla. Va junto a las tres cards de
  6.3, con la misma aclaración de 5.3 (es saldo actual, no del período).
- [x] **6.5** Tabla de **últimos 5 movimientos del período** (reusando `getMovements` con `page: 1`)
  y link "Ver todos" a `/protected/movements?` **arrastrando los mismos filtros en la URL**. Cierra
  el `TODO` que ya está escrito en la página.
- [x] **6.6** **Top 5 mayores gastos del período** — mismo `getMovements` ordenado por monto desc.
  ⚠️ Requiere un parámetro de orden en `getMovements`, que hoy siempre ordena por fecha (era el
  punto 5.7 del plan de movimientos, que quedó sin implementar).
- [x] **6.7** Cada bloque con su propio `<Suspense>` para que la página pinte de entrada y los
  gráficos entren de a uno, en vez de esperar a la query más lenta.
- [x] **6.8** `components/dashboard/chart-skeleton.tsx` — `TableSkeleton` no sirve como fallback de
  un gráfico. Debe ocupar **la misma altura** que el gráfico final para no causar saltos de layout.
- [x] **6.9** Actualizar el `TODO` de `app/protected/page.tsx` (borrarlo) y revisar si el link
  "Dashboard" del sidebar necesita algún cambio (hoy apunta a `/protected`, correcto).

## Fase 7 — Cierre

- [x] **7.1** `npm run lint` y `npm run build`. Recharts dentro de Server Components es el punto
  clásico de ruptura: si un gráfico se importa sin `"use client"`, el build falla ahí.
- [ ] **7.2** **Verificación de RLS de las tres funciones RPC, logueado como usuario normal desde la
  app** — no desde el SQL editor (ver 2.5). Es la única prueba que vale: que los totales, los gastos
  por tipo y el flujo mensual correspondan **solo** a las cuentas del usuario logueado. Si hay un
  segundo usuario de prueba, comparar; si no, al menos confirmar que los números cuadran con lo que
  muestra la pantalla de movimientos filtrada igual.
- [ ] **7.3** Probar los bordes: usuario sin cuentas, período sin movimientos, una sola cuenta,
  cuenta con saldo negativo (fallback de 5.2), rango de un día, rango de un año, un tipo de
  movimiento sin gastos, y **un rango con meses vacíos en el medio** (ver la advertencia de 2.3).
- [ ] **7.4** Verificar en mobile: la grilla de 2 columnas, las barras horizontales y la fila de
  presets de fecha.
- [ ] **7.5** Verificar dark mode con colores de cuenta feos (un `#000000` o un `#ffffff` elegido a
  mano) — es el riesgo asumido al usar colores de la base en vez de la paleta del tema.
- [x] **7.6** Documentar las tres funciones RPC en [`docs/database.md`](../database.md): qué
  devuelven, por qué son `security invoker`, y la advertencia de que probarlas desde el SQL editor
  bypassea la RLS.
- [x] **7.7** Agregar a `CLAUDE.md` una sección corta sobre el módulo dashboard
  (`lib/services/dashboard.ts` + `components/dashboard/`) y la regla de que las agregaciones van por
  RPC, no sumando filas en JS.
- [x] **7.8** Notas de cierre al final de este documento, con lo que se desvió del plan.

## Fuera de alcance

Los puntos de abajo se evaluaron y quedaron afuera **a propósito**. No re-agregarlos sin preguntar.

- **Saldo histórico por fecha.** Es la alternativa que se descartó en la primera decisión: haría que
  la torta respetara el filtro de fecha, pero `current_balance` no tiene historia y reconstruirlo
  exige recorrer todos los movimientos previos o guardar snapshots. Es cambio de modelo de datos,
  otro plan.
- **Sumar filas en JS para las agregaciones.** Descartado por el límite de 1000 filas de PostgREST.
  Si la Fase 2 se traba, el plan se bloquea ahí; no se cae de nuevo a este enfoque.
- **Filtro por tipo de movimiento en el dashboard.** El tipo es el eje del gráfico de barras (5.4);
  filtrar por él lo dejaría con una sola barra. Ver el punto 4.1.
- **Exportar a CSV, transferencias entre cuentas y ordenamiento general de la tabla de movimientos.**
  Son `TODO` que ya existen en el código, de la Fase 6 del plan de movimientos. Este plan solo toca
  el ordenamiento en lo mínimo que necesita el punto 6.6.

> El usuario revisó los puntos propuestos y no eliminó ninguno: todo lo que está en las fases fue
> aprobado explícitamente, incluidos los siete que se propusieron por iniciativa propia (4.3, 4.5,
> 5.5, 5.6, 6.4, 6.5, 6.6).

## Riesgos conocidos

- **Las funciones RPC no están versionadas en el repo.** Si se recrea el proyecto de Supabase, hay
  que volver a correrlas a mano desde `docs/database.md`. Es el mismo trato que ya tienen los
  triggers y las políticas de RLS — no empeora la situación, pero la extiende.
- **La torta y el filtro de fecha conviven en la misma pantalla sin relacionarse.** Es la
  consecuencia directa de la primera decisión ("la torta muestra el saldo actual") y solo se mitiga
  con texto, en el punto 5.3. Si molesta en uso real, la salida es guardar snapshots históricos de
  saldo — cambio de modelo de datos, otro plan.
- **`getMovementsTotals` cambia de implementación** (3.5) y lo consume la pantalla de movimientos.
  Comparar los totales antes y después del cambio en un período con datos reales, antes de dar la
  fase por cerrada.

## Notas de cierre

**Lo que se desvió del plan:**

- **6.6 (top gastos)** necesitaba orden por monto y filtro por `type`, que `getMovements` no tenía.
  Se agregó un segundo parámetro opcional `{ orderBy?, type? }` a `getMovements`
  (`lib/services/movements.ts`) en vez de un nuevo servicio — mismo query builder, sin duplicar la
  lógica de scoping por `user_id`.
- **6.5 y 6.6 no paginan de verdad.** `getMovements` sigue trayendo `MOVEMENTS_PAGE_SIZE` (25) filas
  y el componente hace `.slice(0, 5)` en JS. Es intencional: son "últimos 5" y "top 5" sobre como
  mucho 25 candidatos, no una agregación sobre todo el histórico — no aplica la razón por la que 3.2–3.5
  van por RPC (esas sí podían cruzar el límite de 1000 filas).
- **`getAccountsBalanceDistribution` (3.2) no tiene su propio RPC.** El plan ya lo preveía
  ("reusa `getAccounts()`, no hace falta query nueva"): la distribución de saldo es una función pura
  sobre las cuentas que ya trae `getAccounts()`, sin filas de `movements` de por medio, así que no
  hay riesgo del límite de 1000 filas.
- **`getMonthlyFlow` (3.4) rellena los meses vacíos en el servicio**, no en el componente de gráfico
  como sugiere la redacción de 5.6 ("el gráfico tiene que rellenar los huecos"). Se hizo en
  `lib/services/dashboard.ts` porque la decisión general del plan es "la agregación corre en el
  servidor; solo el dibujo es cliente" — rellenar huecos es agregación, no dibujo. El componente
  cliente (`monthly-flow-chart.tsx`) recibe la serie ya completa.
- **Agrupamiento "Otros" (5.5) se implementó en el servicio** (`getExpensesByMovementType`), no en
  el componente de gráfico, por la misma razón de altitud (agregación en servidor).

**Lo que quedó sin hacer:**

- **7.2 (verificación de RLS logueado como usuario normal), 7.3 (casos borde con datos reales), 7.4
  (mobile) y 7.5 (dark mode con colores feos)** no se hicieron: requieren una sesión de usuario real
  en el navegador con datos concretos (cuentas, movimientos, un segundo usuario para comparar), que
  esta sesión no tiene. Quedan en `[ ]` a propósito.

**Lo que sí se verificó:**

- `npm run build` compila y tipa sin errores para todas las rutas, incluida `/protected`
  (confirma que ningún gráfico Recharts quedó importado sin `"use client"`, el punto de ruptura
  clásico que menciona 7.1).
- `npm run lint` no reporta errores en ningún archivo tocado por este plan. El `npm run lint` "en
  seco" del repo sí tira ~44 mil errores, pero **son íntegramente de `public/pdf.worker.min.mjs`**
  (un vendor file minificado) más un warning preexistente en `tailwind.config.ts` — nada de esto lo
  causó este plan. Es un gap de configuración de ESLint (falta excluir `public/`) que existía antes
  y sigue existiendo; no se tocó por estar fuera de alcance.
- El servidor de desarrollo levanta y responde 200 en `/`.

**Lo que no se pudo verificar:**

- **Que los números del dashboard sean correctos con datos reales.** Sin login ni cuentas/movimientos
  de prueba en esta sesión, no se pudo comparar visualmente el dashboard contra `/protected/movements`
  filtrada igual, que es la verificación real de 7.2.
- **El fallback de 5.2 (barras cuando hay saldo ≤ 0)** y el estado vacío de cada card (5.7) no se
  vieron renderizados — solo se revisó que el código los contemple.
- **Accidente operativo, no del código:** al intentar levantar un dev server para probar en el
  navegador, un `pkill -f "next dev"` mal targeteado mató el dev server que el usuario ya tenía
  corriendo (arrancado antes de esta sesión). Se reinició de inmediato y quedó respondiendo 200 en
  `http://localhost:3000/`, pero cualquier estado en memoria de esa sesión anterior (HMR, terminal
  logs previos) se perdió.
