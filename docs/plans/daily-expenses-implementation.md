# Plan: histórico diario de gastos por tipo de movimiento en el dashboard

**Fecha:** 2026-09-27
**Estado:** implementado — ver Notas de cierre (falta QA manual del usuario, 5.2/5.3)

## Objetivo

El dashboard (`app/protected/page.tsx`) suma un card con un gráfico de líneas: eje X = días, eje
Y = monto gastado, una línea por tipo de movimiento con el color de ese tipo. El usuario elige el
período en el propio card: "7 días", "1 mes" (últimos 30 días) o "Personalizado" (Desde/Hasta, hasta
92 días). Por defecto los tipos con menos gasto se agrupan en una línea "Otros", y un checkbox permite
ver todos los tipos por separado.

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

Lo que ya existe y **hay que reusar, no reescribir**:

- `lib/dashboard/date-range.ts` — `nextDay()`, la función privada `toDateString()` (formatea en hora
  local) y `resolveDateRange()`, que es el molde del resolver nuevo.
- `lib/dashboard/format.ts` — `formatCurrency()` y `formatCompactAmount()` para el tooltip y el eje Y.
- `lib/services/dashboard.ts` — `getMonthlyFlow()` + `enumerateMonths()` es el molde de "RPC devuelve
  solo lo que tiene datos, el servicio rellena los huecos". `getExpensesByMovementType()` tiene la
  agrupación en "Otros" (`OTROS_TOP_N = 8`, color `#9ca3af`).
- `components/ui/chart.tsx` — `ChartContainer`, `ChartTooltip`, `ChartTooltipContent`, `ChartLegend`,
  `ChartLegendContent`.
- `components/dashboard/monthly-flow-chart.tsx` — la configuración de ejes (`minTickGap`,
  `interval="preserveStartEnd"`, `aspect-[4/3] sm:aspect-video`) que se copia.
- `components/dashboard/expenses-by-type-chart.tsx` — cómo se arma un `ChartConfig` con el id del tipo
  como clave y su `color`.
- `components/dashboard/filters.tsx` — el patrón `setParams()` (copiar `searchParams`, setear o borrar
  claves, `router.push`).
- `ChartSkeleton` (`components/dashboard/chart-skeleton.tsx`) y `ChartCardSkeleton` (función local de
  `app/protected/page.tsx`).
- `lib/hooks/use-media-query.ts` — `useIsMobile()`.
- Primitivos: `Button`, `Input`, `Label`, `Checkbox`, `Card`.

Restricciones que condicionan el diseño:

1. **`movement_types` no distingue ingreso de gasto.** El mismo tipo puede tener movimientos `credit`
   y `debit`. En este plan, "tipo de gasto" significa *un tipo con movimientos `debit` en el rango*,
   igual que en `get_expenses_by_movement_type`.
2. **Nada de sumar filas crudas en JS.** PostgREST corta en 1000 filas (`db.max_rows`): la agregación
   por día y tipo va en una RPC (ver `CLAUDE.md`, sección Dashboard).
3. **⚠️ El tope de 1000 filas también aplica a lo que devuelve la RPC.** Una fila por `(día, tipo)` con
   92 días y 11 tipos ya son 1012 filas, y el resto se cortaría en silencio. Por eso la RPC devuelve
   **una fila por tipo**, con los días y montos en arrays (ver 1.1).
4. **Toda agregación nueva sobre `movements` excluye `transfer_id is not null`** (ver `docs/database.md`,
   "Transferencias entre cuentas").
5. **`movements.date` es `timestamp` en hora local de Paraguay.** El fin de rango es exclusivo
   (`< p_end_date + interval '1 day'`) y el día sale de `date_trunc('day', m.date)::date`. En JS,
   las fechas se calculan en hora local y nunca con `toISOString()` (ver `docs/database.md`,
   "`movements.date`: fecha y hora").
6. **La RPC solo devuelve los días con gasto.** El servicio completa los días vacíos con 0: sin eso,
   la línea une dos días con gasto como si en el medio no hubiera pasado nada.
7. **`movement_types.color` no es único.** Dos tipos pueden tener el mismo color, y sus líneas no se
   distinguen. Este plan no lo resuelve (ver *Fuera de alcance*).
8. **El valor resuelto viaja como prop a los filtros cliente**, sin volver a leerlo de la URL en el
   cliente (`CLAUDE.md`, "Filtro de cuenta y cuenta principal"). Si se relee, el filtro y el gráfico
   se desincronizan.
9. **`ChartTooltipContent` con `formatter` reemplaza la fila entera del tooltip** (`components/ui/chart.tsx`:
   si hay `formatter`, se renderiza solo lo que devuelve). En `monthly-flow-chart.tsx` y
   `expenses-by-type-chart.tsx` el `formatter` devuelve solo el monto. Con varias líneas, eso deja un
   tooltip con montos sin nombre ni color.

## Decisiones tomadas

- **El gráfico tiene su propio período, independiente del filtro de fechas global.** Usa sus propios
  parámetros en la URL (ver *Arquitectura*). La alternativa era seguir `startDate`/`endDate` y agregar
  presets a `DateRangeFilter`. Se descartó por tres motivos: esos presets aparecerían también en
  movimientos, "7 días" chocaría con el "Mes actual" global, y "Este año" daría 365 puntos por línea.
  Contrapartida aceptada: hay dos selectores de fecha en la misma página, por eso el card tiene que
  decir su rango en la descripción (3.3). **Sí respeta la cuenta del filtro global**
  (`accountFilter.accountId`): lo esperable es que el selector "Cuenta" de arriba gobierne todo el
  dashboard.
- **"1 mes" = últimos 30 días móviles (hoy incluido), no el mes calendario.** Es consistente con "7
  días" (también móvil, hoy incluido) y el día 1 de cada mes no deja el gráfico vacío. Para ver un
  mes calendario puntual, el usuario lo elige con "Personalizado".
- **El preset por defecto es "1 mes".** Si falta `dailyRange` en la URL, o trae un valor inválido,
  se usa `30d`. Es lo más cercano al default "mes actual" del resto del dashboard.
- **"Personalizado" tiene un tope de 92 días (inclusive).** 92 es el trimestre calendario más largo:
  cualquier trimestre entra. Por encima, el gráfico diario deja de leerse: el eje X se vuelve
  ilegible y las líneas quedan pegadas. Se descartó agrupar por semana en rangos largos, que exigía
  otra RPC o un parámetro de granularidad. El tope se valida en el cliente (con mensaje) y en el
  server, porque la URL se puede editar a mano.
- **Por defecto, los 8 tipos con más gasto del período más una línea "Otros"; un checkbox "Ver todos
  los tipos" los separa.** Se usan el mismo `OTROS_TOP_N` y el mismo gris que `ExpensesByTypeCard`,
  así las dos vistas agrupan igual. Contrapartida: "Otros" es gris y no tiene el color de ningún
  tipo. Con el checkbox activado, cada tipo tiene su línea y su color, aunque con muchos tipos se lee
  peor. El estado del checkbox vive en la URL (`dailyTypes=all`), como todos los filtros del
  dashboard. Contrapartida: tildarlo re-renderiza la página y vuelve a correr las RPC de todos los
  cards, no solo la de este (ver *Riesgos*).
- **Selector propio en vez de reusar `DateRangeFilter`.** `DateRangeFilter` siempre muestra sus
  inputs, sus presets son otros, no valida el tope de 92 días y usa `id="startDate"`/`id="endDate"`.
  Montarlo dos veces en la misma página duplicaría esos `id`. Cambiarlo para aceptar presets por
  prop tocaría la pantalla de movimientos, así que no se toca.

## Arquitectura

```
URL: ?accountId=&startDate=&endDate=            (filtro global, sin cambios)
     &dailyRange=7d|30d|custom                  (nuevo; ausente ⇒ 30d)
     &dailyStart=YYYY-MM-DD&dailyEnd=YYYY-MM-DD (nuevo; solo con dailyRange=custom)
     &dailyTypes=all                            (nuevo; ausente ⇒ top 8 + Otros)

app/protected/page.tsx (server)
  └─ resolveDailyExpensesRange(rawParams)  → { preset, startDate, endDate }
  └─ <DailyExpensesCard filter={{ accountId, startDate, endDate, showAllTypes }} preset=… />
        └─ getDailyExpensesByMovementType(filter)            lib/services/dashboard.ts
              └─ rpc get_daily_expenses_by_movement_type      una fila por tipo, arrays por día
              └─ rellena días vacíos, agrupa "Otros", pivotea a formato ancho
        ├─ <DailyExpensesFilter …props resueltas />           "use client", escribe la URL
        └─ <DailyExpensesChart series points />               "use client", solo dibuja
```

Archivos nuevos:

```
supabase/migrations/<timestamp>_add_get_daily_expenses_by_movement_type.sql
supabase/schemas/public/functions/get_daily_expenses_by_movement_type.sql   (lo genera db:pull)
components/dashboard/daily-expenses-card.tsx
components/dashboard/daily-expenses-filter.tsx
components/dashboard/daily-expenses-chart.tsx
```

## Fase 1 — Base de datos

- [x] **1.1** Migración con `npx supabase migration new add_get_daily_expenses_by_movement_type`,
  escrita a mano (flujo en `docs/supabase.md`). Crea
  `public.get_daily_expenses_by_movement_type(p_account_id uuid default null, p_start_date date,
  p_end_date date)` y devuelve `table (movement_type_id uuid, name text, color text, total bigint,
  days date[], amounts bigint[])`: **una fila por tipo**, ordenada por `total desc`, con `days` y
  `amounts` alineados y ordenados por día. Se arma con un CTE que agrupa por `(movement_type_id,
  date_trunc('day', m.date)::date)` y después con `array_agg(... order by day)` por tipo. Mismos filtros que
  `get_expenses_by_movement_type`: `m.type = 'debit'`, `m.transfer_id is null`,
  `a.user_id = (select auth.uid())`, `(p_account_id is null or m.account_id = p_account_id)`,
  `m.date >= p_start_date`, `m.date < p_end_date + interval '1 day'`. `language sql`, `stable`,
  `set search_path to ''`, con el mismo `GRANT EXECUTE` que las funciones hermanas.
  - ⚠️ **Una fila por tipo, no una por `(día, tipo)`:** ver restricción 3. Con una fila por día y
    tipo, el corte de 1000 filas pierde datos sin avisar.
  - ⚠️ **Nunca `security definer`:** la función correría con los permisos del dueño y devolvería
    movimientos de todos los usuarios. Queda en `security invoker` (el default).
  - `p_start_date` y `p_end_date` **no tienen default**, a diferencia de las otras RPC del dashboard:
    un rango abierto saltearía el tope de 92 días y el servicio siempre pasa los dos.
- [x] **1.2** ⚠️ `supabase db push --linked --dry-run`, mostrarle la salida al usuario y **esperar su
  confirmación** antes de `npm run db:push`: va directo a producción y no hay staging. Después,
  `npm run db:pull` (genera `supabase/schemas/public/functions/get_daily_expenses_by_movement_type.sql`)
  y `npm run db:types`. Si `db:types` falla, el archivo queda vacío: volver a correrlo, no editarlo a
  mano.

## Fase 2 — Helpers, tipos y servicio

Depende de la Fase 1: 2.3 usa los tipos que genera `db:types`. 2.1 y 2.2 se pueden hacer antes.

- [x] **2.1** En `lib/dashboard/date-range.ts`:
  - `export const MAX_DAILY_RANGE_DAYS = 92;`
  - `getLastNDaysRange(n)` → `{ startDate: hoy - (n - 1), endDate: hoy }` en hora local, con
    `toDateString()`. Hoy entra: `getLastNDaysRange(7)` son 7 días que terminan hoy.
  - `enumerateDays(startDate, endDate): string[]`, inclusive, avanzando con `nextDay()`.
  - `resolveDailyExpensesRange(params: { dailyRange?; dailyStart?; dailyEnd? })` →
    `{ preset: "7d" | "30d" | "custom"; startDate; endDate }`. `7d` y `30d` usan `getLastNDaysRange`.
    `custom` exige que las dos fechas tengan formato `YYYY-MM-DD`, que `startDate <= endDate` y que
    `enumerateDays(...).length <= MAX_DAILY_RANGE_DAYS`. Si alguna condición falla, o el preset es
    desconocido, cae a `30d`.
  - Todo puro y síncrono, en el mismo molde que `resolveDateRange`. `date-range.ts` ya se importa
    desde componentes cliente, así que la constante y `enumerateDays` sirven para validar en 3.1.
- [x] **2.2** En `lib/schemas/dashboard.ts`:
  - `DailyExpensesFilter = { accountId: string | undefined; startDate: string; endDate: string; showAllTypes: boolean }`
  - `DailyExpensesSeries = { id: string; name: string; color: string; total: number }`
  - `DailyExpensesPoint = { day: string; dayLabel: string; [seriesId: string]: string | number }`
    (formato ancho: una fila por día y una clave por id de serie, que es lo que pide Recharts).
  - `DailyExpenses = { series: DailyExpensesSeries[]; points: DailyExpensesPoint[]; groupedCount: number }`.
    `groupedCount` = cuántos tipos quedaron dentro de "Otros" (0 si no hubo agrupación).
- [x] **2.3** `getDailyExpensesByMovementType(filter: DailyExpensesFilter): Promise<DailyExpenses>` en
  `lib/services/dashboard.ts`. Sigue el molde de `getMonthlyFlow`: `getUser()` y después
  `supabase.rpc("get_daily_expenses_by_movement_type", ...)`. Arma un `Map` día→monto por tipo a
  partir de `days`/`amounts` y recorre `enumerateDays(startDate, endDate)`. Cada punto lleva `day`,
  `dayLabel` (`dd/MM`) y el monto de cada serie, con 0 si ese día no hubo gasto.
  - Sumar acá lo que devuelve la RPC es correcto: son totales ya agregados por tipo y por día, no
    filas crudas.
  - ⚠️ `days` llega como `string[]` (`YYYY-MM-DD`); compararlo como string contra `enumerateDays`, sin
    pasar por `new Date()`, que lo interpretaría en UTC.
- [x] **2.4** La agrupación en "Otros" vive en `getDailyExpensesByMovementType`. Si
  `showAllTypes === false` y hay más de `OTROS_TOP_N` tipos, quedan los 8 con más `total` y el resto
  se suma día por día en una serie `{ id: "otros", name: "Otros", color: OTROS_COLOR }`. Si
  `showAllTypes === true`, no se agrupa nada. En los dos casos se completa `groupedCount`.
  Extraer `const OTROS_COLOR = "#9ca3af"` en el mismo archivo y usarlo también en
  `getExpensesByMovementType`, sin otro cambio en esa función, así las dos vistas no se separan.

## Fase 3 — Componentes

Depende de la Fase 2. 3.1 y 3.2 son independientes entre sí; 3.3 usa las dos.

- [x] **3.1** `components/dashboard/daily-expenses-filter.tsx` (`"use client"`). Recibe las props
  **ya resueltas en el server**: `preset`, `startDate`, `endDate`, `showAllTypes`, `groupedCount`
  (restricción 8).
  - Botones "7 días", "1 mes" y "Personalizado", con `variant` `default`/`outline` según `preset`,
    igual que los presets de `DateRangeFilter`. "7 días" y "1 mes" setean `dailyRange` y borran
    `dailyStart`/`dailyEnd`. "Personalizado" setea `dailyRange=custom` y `dailyStart`/`dailyEnd`
    con el rango que se está mostrando: así los inputs aparecen precargados con un rango válido.
  - Con `preset === "custom"`, inputs `type="date"` "Desde"/"Hasta" con `id="dailyStart"` /
    `id="dailyEnd"`, **no** `startDate`/`endDate`, que ya usa `DateRangeFilter` en la misma página.
    El borrador va en estado local y solo se hace `router.push` si el rango es válido: fechas
    completas, desde ≤ hasta y ≤ `MAX_DAILY_RANGE_DAYS`. Si no, se muestra el motivo en
    `text-sm text-destructive` ("El rango máximo es de 92 días", "La fecha inicial es posterior a la
    final").
    - ⚠️ El estado local tiene que resetearse cuando cambian las props (por ejemplo, desde "Volver
      a…" o con el botón atrás del navegador). Se resuelve con `key={`${startDate}-${endDate}`}`
      en el bloque de inputs, no con un `useEffect` que copie props a estado.
  - `Checkbox` + `Label` "Ver todos los tipos". Tildado setea `dailyTypes=all`; destildado lo borra.
    Se muestra solo si `groupedCount > 0 || showAllTypes`: sin tipos para agrupar, no hace nada.
  - `setParams` con el mismo patrón que `components/dashboard/filters.tsx`: copia todos los
    `searchParams` para no perder `accountId`, `startDate` ni `endDate` del filtro global. No
    refactorizar `filters.tsx` para compartirlo.
- [x] **3.2** `components/dashboard/daily-expenses-chart.tsx` (`"use client"`). Solo dibuja; recibe
  `series` y `points`.
  - `ChartConfig` armado desde `series` (`[s.id]: { label: s.name, color: s.color }`), como en
    `expenses-by-type-chart.tsx`. Una `<Line key={s.id} dataKey={s.id} stroke={s.color}
    strokeWidth={2} type="monotone" />` por serie. `monotone` no genera overshoot: la curva no baja
    de 0 entre dos puntos.
  - `XAxis dataKey="dayLabel"` con `minTickGap` e `interval="preserveStartEnd"`; `YAxis` con
    `tickFormatter={formatCompactAmount}`; `CartesianGrid vertical={false}`; `ChartLegend` con
    `ChartLegendContent`. Mismo tamaño que `monthly-flow-chart.tsx`
    (`w-full aspect-[4/3] sm:aspect-video`).
  - Puntos visibles (`dot`) solo si `points.length <= 14`. Con 30 o más días, los puntos tapan la
    línea; con un solo día, sin punto no se ve nada.
  - ⚠️ Tooltip: ver restricción 9. Si se usa `formatter` en `ChartTooltipContent`, tiene que
    renderizar el indicador de color, el nombre del tipo y `formatCurrency(value)`. Si devuelve solo
    el monto (como en los otros charts), el tooltip muestra una lista de montos sin nombre.
- [x] **3.3** `components/dashboard/daily-expenses-card.tsx` (Server Component, async). Recibe
  `filter: DailyExpensesFilter` y `preset`, llama a `getDailyExpensesByMovementType(filter)` y
  renderiza un `<Card>`:
  - Título "Gastos diarios por tipo". Descripción con el rango explícito ("Del 29/08/2026 al
    27/09/2026"), porque el filtro global de fechas de la página no aplica a este card. Si
    `groupedCount > 0`, sumar "Los 8 tipos con más gasto; el resto, en Otros."
  - `<DailyExpensesFilter>` y debajo `<DailyExpensesChart>`.
  - ⚠️ Si `series.length === 0`, mostrar "No hay gastos registrados en este período."
    (`text-sm text-muted-foreground`, como `ExpensesByTypeCard`), pero **mantener el filtro
    visible**. Si el card devolviera `null` como `MonthlyFlowCard`, un rango sin gastos dejaría al
    usuario sin forma de cambiarlo.
- [x] **3.4** Tooltip ordenado por monto (mayor primero) y **sin los tipos en 0 ese día**. Con 8 o
  más líneas, si no, el tooltip es una lista de ceros. Se puede resolver con `itemSorter` de
  Recharts y un `content` que filtre `payload` antes de pasarlo a `ChartTooltipContent`. Si todos
  los tipos están en 0 ese día, el tooltip queda vacío: aceptable. Mostrar la fecha completa como
  label (`labelFormatter`, `dd/MM/yyyy` a partir de `day`).
- [ ] **3.5** *(opcional)* No implementado — es opcional y no lo pidió el usuario. Clic en un ítem de
  la leyenda oculta o muestra esa línea (`hide` en `<Line>`, estado local con `useState`, sin tocar
  la URL). Hace falta una leyenda propia en vez de `ChartLegendContent`, que no maneja clics. Es más
  útil con "Ver todos los tipos" activado.

## Fase 4 — Página

Depende de la Fase 3.

- [x] **4.1** En `app/protected/page.tsx`:
  - Sumar `dailyRange?`, `dailyStart?`, `dailyEnd?` y `dailyTypes?` al tipo de `searchParams`.
  - `const dailyRange = resolveDailyExpensesRange(rawParams);` y armar
    `{ accountId: accountFilter.accountId, startDate: dailyRange.startDate, endDate: dailyRange.endDate, showAllTypes: rawParams.dailyTypes === "all" }`.
  - Renderizar `<Suspense fallback={<ChartCardSkeleton />}><DailyExpensesCard … /></Suspense>` a
    ancho completo, **inmediatamente después** del card de `MonthlyFlowCard` y antes de `BudgetsCard`.
  - ⚠️ `accountId` sale de `accountFilter.accountId` (uuid o `undefined`), nunca de `accountFilter.param`:
    el sentinela `"all"` no llega a `lib/services/*` (`CLAUDE.md`, invariante 1).
- [x] **4.2** Verificar que el filtro global no pierda los parámetros nuevos ni los pise.
  `DashboardFilters.setParams` copia `searchParams`, así que cambiar la cuenta o el rango global
  conserva `daily*`. "Volver al mes actual" solo borra `startDate`/`endDate`, así que el período del
  gráfico se mantiene, y está bien que así sea. No tocar `components/dashboard/filters.tsx`.

## Fase 5 — Cierre

- [x] **5.1** `npm run lint` y `npm run build`. Donde puede romper: el tipado de `.rpc()` si
  `db:types` no se regeneró (la función no existe en `database.types.ts`), y la firma index del
  tipo `DailyExpensesPoint` contra `day`/`dayLabel`.
- [ ] **5.2** Sin verificar — el agente no tiene credenciales de una sesión logueada; el usuario
  confirmó que lo prueba él mismo. Probar los bordes, logueado como usuario normal (el SQL editor
  corre como `postgres` y saltea la RLS: no sirve para validar):
  - Rango sin gastos: se ve el mensaje **y** el filtro.
  - Personalizado de un solo día: se ve un punto por tipo.
  - Un tipo con gasto en un solo día del rango: su línea está en 0 el resto de los días, sin saltos.
  - Un gasto a las 23:59 del último día del rango: aparece.
  - Una transferencia en el rango: no aparece en ninguna línea.
  - Un tipo con `credit` y `debit` en el rango: solo suman los `debit`.
  - Cuenta "Todas las cuentas" contra una cuenta puntual: los totales cambian.
  - Más de 8 tipos con gasto: aparece "Otros" y el checkbox. Al tildarlo, se separan y "Otros"
    desaparece. Con 8 o menos, no hay checkbox.
  - Personalizado de 93 días: el mensaje de error y la URL no cambia. `?dailyRange=custom&dailyStart=2026-01-01&dailyEnd=2026-12-31`
    escrito a mano: cae a "1 mes".
  - Cambiar el filtro global y "Volver al mes actual": el período del gráfico no cambia.
  - Comparar el total del período con la suma del mismo rango en `ExpensesByTypeCard`, poniendo el
    filtro global en las mismas fechas: tiene que coincidir.
- [ ] **5.3** Sin verificar — misma razón que 5.2 (requiere navegador con sesión logueada). Verificar
  en mobile (etiquetas del eje X sin encimarse, filtro que hace wrap, leyenda con todos los tipos) y
  en dark mode (colores de tipo oscuros sobre fondo oscuro: ver *Riesgos*).
- [x] **5.4** En `docs/database.md`:
  - Sumar la fila de `get_daily_expenses_by_movement_type` a la tabla de "Funciones RPC del
    dashboard", con el porqué de una fila por tipo con arrays (restricción 3), y cambiar "Tres
    funciones" por cuatro.
  - Sumarla a la lista de agregaciones que excluyen `transfer_id` en "Transferencias entre cuentas"
    ("las cinco" pasa a seis).
  - En "`movements.date`", cambiar "las tres RPC del dashboard" por las cuatro.
- [x] **5.5** En `CLAUDE.md`, sección "Dashboard": cuatro RPC en vez de tres, los parámetros
  `dailyRange`/`dailyStart`/`dailyEnd`/`dailyTypes`, y que este card tiene período propio,
  independiente de `startDate`/`endDate`.
- [x] **5.6** Notas de cierre al final de este documento.

## Fuera de alcance

El usuario revisó los puntos propuestos y no eliminó ninguno. Esto quedó afuera por decisión:

- **Seguir el filtro global de fechas / agregar presets a `DateRangeFilter`.** Se eligió un período
  propio (ver *Decisiones tomadas*). No tocar `components/date-range-filter.tsx`.
- **Preset "mes calendario".** "1 mes" son los últimos 30 días; un mes puntual se elige con
  "Personalizado".
- **Rangos de más de 92 días y agrupación semanal o mensual.** Se descartó por el trabajo extra
  (otra RPC o un parámetro de granularidad). Para ver meses ya está "Evolución mensual".
- **Hacer único `movement_types.color` o asignar colores automáticos** para evitar dos líneas iguales.
  Cambia la tabla y el formulario de tipos; es otro plan.
- **Ingresos por día.** El gráfico es solo de gastos (`debit`).
- **Incluir transferencias.** Excluidas a propósito, como en todas las agregaciones.
- **Guardar el período o el checkbox fuera de la URL** (localStorage, preferencias de usuario).
- **Refactorizar `components/dashboard/filters.tsx`** para compartir `setParams` con el filtro nuevo.

## Riesgos conocidos

- **"Hoy" se calcula en el server.** `getLastNDaysRange` usa `new Date()` en el server, igual que
  `getCurrentMonthRange` hoy. Si el server corre en UTC, entre las 21:00 y las 24:00 de Paraguay
  "hoy" ya es mañana y los presets se corren un día. No es un problema nuevo, pero en un gráfico
  diario se nota más que en uno mensual.
- **Cambiar el período o el checkbox re-renderiza todo el dashboard.** Todo el estado vive en la URL,
  así que un `router.push` vuelve a correr las RPC de todos los cards, no solo esta. Se aceptó por
  consistencia con el resto del dashboard.
- **Colores repetidos o de bajo contraste.** Los colores los elige el usuario por tipo (restricción
  7). Dos tipos con el mismo color dan dos líneas indistinguibles, y un color oscuro se pierde en
  dark mode.
- **Un tipo de movimiento real llamado "Otros"** aparecería junto a la serie agrupada "Otros", con
  el mismo nombre. El id no choca (`"otros"` contra un uuid), pero la leyenda confunde. Pasa igual
  en `ExpensesByTypeCard`.
- **Lo que ya funciona y este plan toca:** `app/protected/page.tsx` (tipo de `searchParams` y un card
  nuevo) y `getExpensesByMovementType` (solo la extracción de `OTROS_COLOR`). Verificar que "Gastos
  por tipo" siga mostrando "Otros" en gris y que el resto de los cards no cambie con los parámetros
  nuevos en la URL.

## Notas de cierre

**Qué se desvió del plan:**

- **Orden de parámetros de la RPC.** El plan pedía la firma
  `(p_account_id uuid default null, p_start_date date, p_end_date date)`, pero Postgres exige que
  todo parámetro con default vaya al final de la declaración (no puede haber uno sin default
  después de uno con default). Se declaró como `(p_start_date date, p_end_date date, p_account_id
  uuid default null)`. No cambia nada para los llamadores: `supabase.rpc(...)` siempre pasa los
  argumentos por nombre, igual que el resto de las RPC del dashboard.
- **Tooltip: tipado de `DailyExpensesTooltip`.** El plan no entra en este detalle, pero al escribir
  el componente hubo que tipar sus props como `ComponentProps<typeof ChartTooltipContent>` (en vez
  de un tipo de recharts como `TooltipContentProps`, que exige `payload`/`active`/`accessibilityLayer`
  como no opcionales y rompe la compilación al usar `<DailyExpensesTooltip />` sin props). Mismo
  patrón que usa `ChartTooltipContent` internamente.
- **`DailyExpensesFilter` (3.1): el borrador del rango personalizado se movió a un subcomponente.**
  El plan decía resetear el estado local con `key={`${startDate}-${endDate}`}` en el bloque de
  inputs; puesto en un `<div>` dentro del mismo componente eso no reinicia el `useState`, que vive
  en el padre. Se extrajo `CustomRangeInputs` (mismo archivo) para que el `key` del padre remonte el
  subcomponente completo y su `useState` se re-inicialice con las props nuevas.

**Qué quedó sin hacer:**

- **3.5 (opcional)** — no se implementó, como indica el plan.
- **5.2 y 5.3** — QA manual logueado como usuario normal, en mobile y en dark mode. El agente no
  tiene credenciales de sesión; el usuario confirmó que lo prueba él mismo.

**Qué se verificó:**

- Migración aplicada a producción (`db:push` con `--dry-run` previo mostrado y confirmado por el
  usuario), `db:pull` y `db:types` corridos sin errores; la función aparece en
  `database.types.ts`.
- `npm run lint` sin errores.
- `npm run build` compila y tipa sin errores (tras el ajuste de tipos del tooltip); las 29 rutas
  generan igual que antes, sin rutas nuevas rotas.

**Qué no se pudo verificar:**

- Todo lo que pide una sesión de usuario real en el navegador (5.2, 5.3): comportamiento en los
  bordes (rango sin gastos, un solo día, 93 días, RLS con usuario normal), mobile y dark mode. El
  build y el lint no prueban esto — son correctitud de tipos, no de producto.
- Que el total del período coincida entre `DailyExpensesCard` y `ExpensesByTypeCard` con el mismo
  rango (parte de 5.2, requiere la app corriendo con datos reales).

## Actualización 2026-09-28: barras apiladas

El gráfico de líneas se reemplazó por barras apiladas por día (un segmento por tipo, total del día
encima, tooltip por segmento con el total del día, leyenda con cuadrados). La RPC no cambió.
Además:

- El rango efectivo se corta en hoy (`resolveDailyExpensesRange` devuelve `endDate` ≤ hoy y
  `requestedEndDate` para los inputs); un rango íntegramente futuro muestra un mensaje en vez del
  gráfico.
- "Hoy" sale de `todayInAppTimeZone()` (`America/Asuncion`), no de la zona del proceso Node.
- El fallback de `resolveDailyExpensesRange` devolvía `preset: "7d"` con 30 días: sin
  `?dailyRange`, el botón "7 días" quedaba marcado mostrando un mes. Ahora devuelve `"30d"`.
- Series cortadas en el gráfico de líneas: los datos traían el 0 en todos los días; el corte venía
  de la animación de `<Line>` de Recharts, que dibuja el trazo con un `stroke-dasharray` calculado
  con el largo del path del render anterior. Las barras corren con `isAnimationActive={false}`.
- Default del card: 7 días (antes 30). "Personalizado" ya no navega al elegirse ni en cada cambio
  de Desde/Hasta: los inputs son un borrador local y se aplican con el botón "Aplicar". Todas las
  navegaciones del filtro usan `router.push(..., { scroll: false })`, porque la página subía al
  tope en cada cambio.
