# Plan: vista de calendario de movimientos con arrastrar para cambiar la fecha

**Fecha:** 2026-11-21
**Estado:** implementado y probado (P.1–P.13 pasan; 5.4 opcional sin hacer) — pendiente: decidir el drag con viewport bajo (ver Notas de cierre)

## Objetivo

En `/protected/movements` el usuario puede pasar de la tabla a una **vista de calendario semanal
tipo Google Calendar**: cada movimiento aparece como un bloque en la columna de su día y a la altura
de su hora. **Arrastrando un bloque** a otro día u otra hora se cambia la fecha del movimiento (y de
las dos patas, si es una transferencia). En mobile la misma vista muestra un solo día a la vez.

## Cómo ejecutar este plan

> Este plan se ejecuta con la skill `ejecutar-plan`: un **orquestador** lanza al agente
> `implementador`, que escribe el código, y después al agente `tester`, que lo prueba en el
> navegador contra *Criterios de prueba* y deja los tests en `e2e/`. Las incidencias vuelven al
> implementador a través del orquestador hasta que todo pase.
>
> **Implementador:**
>
> - **Verificá antes de arrancar que lo que este plan afirma del código siga siendo cierto.** Tiene
>   fecha; los archivos, funciones y componentes que nombra pueden haber cambiado desde entonces.
> - **Seguí el orden de las fases.** Cada una se apoya en la anterior; donde el orden no importa,
>   está dicho.
> - **Si la realidad contradice al plan, pará y reportáselo al orquestador**, que le pregunta al
>   usuario. Un plan equivocado en un punto se corrige en dos minutos; una solución improvisada
>   alrededor del error se descubre semanas después.
> - **No amplíes el alcance.** Lo que no está en un punto, no entra — y lo que está en *Fuera de
>   alcance* se descartó a propósito, con motivo. Si algo parece faltar, reportalo antes de agregarlo.
> - **Respetá los puntos marcados *(opcional)*:** son opcionales de verdad.
> - **Marcá `[x]` apenas terminás cada punto** y actualizá el **Estado** del encabezado. Un punto
>   que quede sin hacer se deja en `[ ]` con el motivo escrito ahí mismo — nunca se borra.
> - **No escribas tests e2e, ni el Registro de ejecución, ni las Notas de cierre.**
>
> **Tester:** verificá cada criterio `P.n` de *Criterios de prueba* que cubra los puntos de la
> ronda, escribilo como test en `e2e/` nombrado con su id, y no modifiques el código de la app.
>
> **Orquestador:** llevá el *Registro de ejecución* y, al terminar, escribí las **Notas de
> cierre**: qué se desvió del plan y por qué, qué quedó sin hacer, qué se verificó y **qué no se
> pudo verificar**. Lo último es lo más valioso de la sección y lo primero que se omite.

## Contexto

Lo que ya existe y **hay que reusar, no reescribir**:

- `app/protected/movements/page.tsx` — página del listado. Lee `accountId`, `movementTypeId`,
  `startDate`, `endDate`, `page` de `searchParams`, resuelve la cuenta con `resolveAccountFilter`
  (`lib/accounts/primary.ts`) y renderiza `MovementsFilters`, `MovementsTotals` y `MovementsTable`.
- `components/movements/filters.tsx` (`MovementsFilters`) — filtros de cliente por `searchParams`
  (`setParam`, `setParams`, `clearFilters`). Usa `AccountSelect`, `MovementTypeSelect` y
  `DateRangeFilter`.
- `components/movements/totals.tsx` (`MovementsTotals`) — cards Ingresos/Egresos/Balance neto vía
  `getMovementsTotals` (RPC `get_movements_totals`). Recibe un `Omit<MovementFilter, "page">`.
- `components/movements/table.tsx` — exporta `ColoredLabel`; define `MovementActions` (los hrefs
  de editar/borrar de un movimiento o de su transferencia según `transfer_id`).
- `lib/services/movements.ts` — `getMovements` (paginado de a `MOVEMENTS_PAGE_SIZE = 25`) y la
  constante privada `MOVEMENT_COLUMNS` (select con joins a `accounts`, `movement_types`, `debts`).
- `lib/services/movements.client.ts` — `createMovement`, `updateMovement`, `deleteMovement`.
- `lib/services/transfers.client.ts` — `updateTransfer(transferId, params)`: valida con
  `transferSchema` y llama a la RPC `update_transfer`.
- `lib/schemas/movements.ts` — `movementSchema` (su `shape.date` valida `YYYY-MM-DD` o
  `YYYY-MM-DDTHH:mm`), `Movement`, `MovementFilter`.
- `lib/movements/datetime.ts` — `formatMovementDate`, `toInputValue`, `nowForInput`; todo en hora
  local sobre el string, nunca `toISOString()`.
- `lib/dashboard/date-range.ts` — `nextDay(date)` (suma días armando `new Date(y, m - 1, d + 1)`),
  `todayInAppTimeZone()`, `APP_TIME_ZONE = "America/Asuncion"`.
- `lib/return-to.ts` — `resolveReturnTo(raw, fallback)` / `withReturnTo(href, returnTo)`.
- `lib/services/revalidate.ts` — `revalidateMyDataAndRedirect(path, redirectTo)` y
  `revalidatePathServer(path)`.
- `components/ui/popover.tsx`, `components/ui/button.tsx`, `components/ui/skeleton.tsx`,
  `react-hot-toast`.
- `e2e/helpers/supabase.ts` — `qaSupabase()` y `uniqueName()` para preparar y limpiar datos en los
  tests (ver `e2e/transfers.spec.ts`: crea sus propias cuentas y las borra en `afterAll`).

Restricciones que condicionan el diseño:

1. **`getMovements` pagina de a 25.** El calendario necesita todos los movimientos de la semana
   visible: hace falta una lectura sin paginación. PostgREST corta en 1000 filas (`db.max_rows`),
   así que la lectura tiene ese tope y tiene que avisar si lo alcanzó.
2. **Un movimiento es un instante, no un evento con duración.** El bloque se dibuja con un alto
   fijo (30 minutos visuales) y los movimientos con horas cercanas se solapan: hay que repartirlos
   en columnas dentro del día, como hace Google Calendar.
3. **Los movimientos importados quedan a las 00:00** (la importación no trae hora; las filas previas
   a la migración de `date` a `timestamp` también). Un extracto importado apila decenas de bloques
   a medianoche.
4. **Una transferencia son dos filas de `movements` apareadas por `transfer_id`**, que solo se
   escriben por las RPC `create_transfer` / `update_transfer` / `delete_transfer`. Mover una pata
   sola deja el par con fechas distintas. `update_transfer` acepta `p_date` pero exige todos los
   campos (cuentas origen/destino, monto, descripción).
5. **`updateMovement` hace `.update(parsed.data)` con el payload completo de `movementSchema`.**
   Para arrastrar hace falta una mutación que escriba **solo** `date`; así además no toca `debt_id`
   de los pagos de deudas.
6. **La base no necesita cambios.** La política "Users can update movements from own accounts" ya
   permite el update; `trigger_update_account_balance` no depende de la fecha; presupuestos y deudas
   se calculan al leer (mover un gasto de mes o un pago de deuda se refleja solo).
7. **No hay librería de drag-and-drop instalada**, y el drag nativo de HTML5 no funciona con touch.
8. **Fechas como strings en hora local.** `movements.date` es `timestamp` sin zona en hora de
   Paraguay; toda la aritmética de días y minutos del calendario se hace sobre el string
   (`YYYY-MM-DDTHH:mm`) o armando `Date` por componentes, igual que `nextDay`. "Hoy" sale de
   `todayInAppTimeZone()`, no de `new Date()` en el servidor.
9. **No existe un hook de media query en el repo.** `components.json` declara el alias
   `hooks: "@/hooks"`, pero la carpeta `hooks/` no existe todavía.

## Decisiones tomadas

- **Vista semanal en desktop, un día por vez en mobile (`?day=`).** En 375 px siete columnas quedan
  de ~45 px y no se lee nada. Se descartaron: (b) agregar vista de mes — es otro layout entero sin
  horas y duplica la fase 4; (c) solo semana con scroll horizontal en mobile — mezcla scroll
  horizontal con drag táctil. Contrapartida: en mobile no se ve la semana de un vistazo; para
  cambiar el día de un movimiento se suelta sobre el botón del día en la tira superior (4.7).
- **El calendario tiene su propio período (`?week=`) e ignora `startDate`/`endDate`.** Un rango de
  3 meses en una grilla semanal no tiene sentido. Contrapartida: al pasar de lista a calendario el
  rango de fechas no se conserva (sí la cuenta y el tipo), y en calendario el filtro "Período" se
  oculta. Los totales (`MovementsTotals`) en calendario muestran la semana visible.
- **Movimientos a las 00:00 van a una banda "Sin hora"** arriba de la grilla (como "todo el día" de
  Google), no a la fila de medianoche. Soltar un bloque en la banda lo deja a las 00:00; soltarlo en
  la grilla le asigna hora. Contrapartida aceptada: un movimiento real hecho exactamente a las 00:00
  también se ve como "Sin hora" — es la misma convención que `formatMovementDate`, que omite la hora
  a las 00:00.
- **Las transferencias se pueden arrastrar y mueven el par entero** vía `update_transfer` (3.5).
  Se descartó dejarlas fijas: habría que explicar en pantalla por qué algunos bloques no se mueven.
- **Librería: `@dnd-kit/core`.** Trae sensores de pointer y touch, y droppables por elemento (columna
  de día, celda de banda, botón de día en mobile). Se descartó implementarlo a mano con pointer
  events: el snap y la detección del destino son lo mismo, pero el manejo de touch (long-press vs.
  scroll) es justo lo que la librería ya resuelve.
- **La semana va de lunes a domingo.** Convención de `components/ui/calendar.tsx` (locale `es`).
  La captura de referencia del usuario empieza en domingo; si lo prefiere así, se cambia en
  `resolveCalendarWeek` (3.1) y nada más.
- **Snap a 15 minutos, 64 px por hora, bloque de 30 minutos visuales (32 px)** — dos líneas de texto
  `text-xs`: descripción y "hora · monto".
- **Color del bloque = color del tipo de movimiento** (borde izquierdo sólido + fondo tenue), no el
  de la cuenta: con "Todas las cuentas" el tipo es lo que distingue los gastos, igual que en el
  dashboard.
- **Después de soltar no se usa `revalidateMyDataAndRedirect`** (el flujo estándar post-mutación),
  sino `revalidatePathServer("/protected/movements")` + `router.refresh()`: el redirect remonta la
  página y la grilla pierde el scroll vertical. Desvío deliberado del patrón de `CLAUDE.md`.

## Arquitectura

```
app/protected/movements/page.tsx            (Server; lee view / week / day)
├── MovementsViewToggle                     components/movements/calendar/view-toggle.tsx (Server, links)
├── MovementsFilters (view)                 components/movements/filters.tsx (oculta Período en calendario)
├── MovementsTotals (rango de la semana)    components/movements/totals.tsx (sin cambios)
└── view=calendar ─► <Suspense> CalendarView   components/movements/calendar/calendar-view.tsx (Server)
                        ├── getCalendarMovements(...)          lib/services/movements.ts
                        ├── WeekNav                            .../week-nav.tsx (Server, links)
                        └── MovementsCalendar (use client)     .../movements-calendar.tsx
                              ├── DndContext (@dnd-kit/core)
                              ├── AllDayBand  ── droppable "allday:<día>"   .../all-day-band.tsx
                              ├── DayColumn × 7 (o × 1) ── droppable "day:<día>"  .../day-column.tsx
                              │     └── CalendarEvent (draggable)          .../calendar-event.tsx
                              ├── MobileDayStrip ── droppable "strip:<día>" .../mobile-day-strip.tsx
                              └── onDragEnd ─► updateMovementDate | moveTransfer
                                               ─► revalidatePathServer + router.refresh()

lib/movements/calendar.ts   (puro: semana, layout de solapados, minutos ↔ string)
hooks/use-media-query.ts    (nuevo)
```

La lógica que absorbe la complejidad es `lib/movements/calendar.ts`: pura, sin React, sin `Date`
salvo por componentes. Los componentes solo dibujan lo que devuelve.

## Fase 1 — Dependencias

- [x] **1.1** `npm i @dnd-kit/core` (sin `@dnd-kit/sortable`: no hay listas ordenables). Verificar
  que el peer de React acepte la versión 19 del repo; si `npm` se queja, **parar y reportar**, no
  usar `--legacy-peer-deps` por iniciativa propia.

## Fase 2 — Base de datos

Sin puntos: no hay cambios de esquema, RPC ni RLS (restricción 6). Si durante la implementación
algo parece necesitar un cambio de base, es una contradicción con el plan: reportarla.

## Fase 3 — Lógica pura y servicios

- [x] **3.1** `lib/movements/calendar.ts` (nuevo, puro, mismo molde que `lib/dashboard/date-range.ts`):
  - `addDays(date: string, n: number): string` — `YYYY-MM-DD`, armando `new Date(y, m - 1, d + n)`
    como `nextDay`.
  - `resolveCalendarWeek({ week, day }: { week?: string; day?: string }, today: string)` →
    `{ days: string[] /* 7, lunes a domingo */, startDate, endDate /* domingo, inclusivo */,
    prevWeek, nextWeek, selectedDay, label }`.
    - `week` es **cualquier** fecha `YYYY-MM-DD`; se normaliza al lunes de su semana. Ausente o
      inválida ⇒ la semana de `today`.
    - Si `week` falta pero `day` es válido, la semana es la de `day`.
    - `selectedDay` (para mobile): `day` si cae en la semana; si no, `today` si cae en la semana; si
      no, el lunes.
    - `label`: `"5 – 11 ene 2026"`; si cruza mes, `"29 dic – 4 ene 2026"`; si cruza año,
      `"29 dic 2025 – 4 ene 2026"`. Meses con un array propio (`ene`, `feb`, …, sin punto) — **no**
      `Intl`, que según el runtime agrega "." y rompe los tests.
  - `today` llega como parámetro (no se calcula adentro) para que la función siga siendo pura.
- [x] **3.2** En el mismo archivo:
  - Constantes exportadas: `HOUR_HEIGHT = 64`, `EVENT_MINUTES = 30`, `SNAP_MINUTES = 15`,
    `MAX_COLUMNS = 3`, `INITIAL_SCROLL_HOUR = 7`, `ALL_DAY_VISIBLE = 3`.
  - `splitMovementDate(dbValue)` → `{ day: "YYYY-MM-DD", minutes: number, isAllDay: boolean }`.
    `isAllDay` ⇔ la hora es `00:00` (sobre el string, aceptando separador `T` o espacio, igual que
    `formatMovementDate`).
  - `offsetToMinutes(offsetPx: number): number` — redondea a `SNAP_MINUTES` y acota a
    `[0, 23 * 60 + 45]`.
  - `toMovementDate(day, minutes): string` → `YYYY-MM-DDTHH:mm`.
  - `layoutDayEvents<T extends { id: string; minutes: number }>(events: T[])` → por evento
    `{ column, columns }`, más `overflow: { top: number; hidden: T[] }[]`. Algoritmo: ordenar por
    `minutes` (desempate por `id` para que sea estable), agrupar en clusters de eventos que se
    solapan transitivamente (intervalo visual `[minutes, minutes + EVENT_MINUTES)`), asignar en cada
    cluster la primera columna libre. ⚠️ Si un cluster necesita más de `MAX_COLUMNS`, los eventos de
    columna `>= MAX_COLUMNS - 1` se ocultan y el cluster muestra un chip "+N" en la última columna,
    a la altura de su primer evento; sin esto, 10 movimientos a la misma hora quedan de 10 px de
    ancho.
- [x] **3.3** `getCalendarMovements({ accountId, movementTypeId, startDate, endDate })` en
  `lib/services/movements.ts`, junto a `getMovements` y reutilizando `MOVEMENT_COLUMNS`. Sin
  paginación: `startDate` inclusivo (`gte`), fin exclusivo con `.lt("date", nextDay(endDate))`
  (regla de fechas de `CLAUDE.md`), `.eq("accounts.user_id", …)`, orden `date asc` +
  `created_at asc`, `.range(0, 999)` y `{ count: "exact" }`. Devuelve
  `{ data: Movement[], truncated: count > data.length }` (restricción 1).
  ⚠️ No reutilizar `getMovements` con un `page` grande: su orden es descendente y su tamaño de página
  es fijo.
- [x] **3.4** `updateMovementDate(id: string, date: string)` en `lib/services/movements.client.ts`:
  valida `date` con `movementSchema.shape.date.safeParse`, y hace
  `.from("movements").update({ date }).eq("id", id)`. ⚠️ **No** usar `updateMovement`: exige el
  payload completo y lo escribe entero (restricción 5).
- [x] **3.5** `moveTransfer(transferId: string, date: string)` en `lib/services/transfers.client.ts`:
  1. Lee las dos patas: `.from("movements").select("account_id, type, amount, description")
     .eq("transfer_id", transferId)`.
  2. Si no vuelven exactamente 2 filas (una `debit`, una `credit`), lanza
     `Error("Transferencia desapareada")` — ver la consulta de diagnóstico en
     `docs/database.md#transferencias-entre-cuentas`.
  3. Llama a `updateTransfer(transferId, { from_account_id: <cuenta del debit>, to_account_id:
     <cuenta del credit>, amount: Number(<amount>), date, description })`, reutilizando su
     validación con `transferSchema`. ⚠️ `amount` es `numeric(15,2)`: pasarlo por `Number()` antes,
     `transferSchema` exige `z.int()`.

## Fase 4 — Componentes (`components/movements/calendar/`)

Dependen de la fase 3. Entre sí: 4.3 necesita 4.4 y 4.6; 4.5 necesita 3.4 y 3.5; 4.7 necesita 4.3.

- [x] **4.1** `view-toggle.tsx` (`MovementsViewToggle`, Server Component) — grupo de dos
  `<Button asChild>` con `<Link>`: "Lista" y "Calendario"; el activo con `variant="default"`, el
  otro `variant="outline"`. Props: `view`, `accountParam` (= `accountFilter.param`),
  `movementTypeId`. Los hrefs llevan **siempre `accountId` explícito** (invariante 2 de `CLAUDE.md`)
  y `movementTypeId` si hay; el de calendario agrega `view=calendar` (sin `week`: cae en la semana
  actual). No arrastran `startDate`/`endDate` ni `page`.
- [x] **4.2** `week-nav.tsx` (`WeekNav`, Server Component) — botones "Semana anterior" (ícono
  `ChevronLeft`, con `aria-label`), "Hoy" y "Semana siguiente" (`ChevronRight`, con `aria-label`), y
  la etiqueta `label` de 3.1 como encabezado. Cada href conserva `view=calendar`, `accountId`
  explícito y `movementTypeId`, cambia `week` y **quita `day`** (al cambiar de semana el día
  seleccionado vuelve al default de 3.1). "Hoy" lleva `week=<today>`.
- [x] **4.3** `movements-calendar.tsx` (`MovementsCalendar`, `"use client"`). Props: `movements`,
  `days` (los 7), `selectedDay`, `today`. Contenido:
  - Encabezado de días: `"LUN"`…`"DOM"` + número de día; el día `today` resaltado (círculo
    `bg-primary text-primary-foreground`).
  - Banda "Sin hora" (4.6) debajo del encabezado.
  - Contenedor con scroll vertical (`max-h-[70vh] overflow-y-auto`), columna de horas `00:00`–`23:00`
    a la izquierda y una `DayColumn` por día (archivo `day-column.tsx`), de alto
    `24 * HOUR_HEIGHT`, con líneas por hora. Al montar, `scrollTop = INITIAL_SCROLL_HOUR * HOUR_HEIGHT`.
  - Cada `DayColumn` es `useDroppable({ id: "day:<YYYY-MM-DD>" })` y lleva `data-day="<YYYY-MM-DD>"`
    (los tests localizan las columnas por este atributo). Dibuja los eventos que no son `isAllDay`
    con `layoutDayEvents` (3.2): `top = minutes / 60 * HOUR_HEIGHT`, alto `EVENT_MINUTES / 60 *
    HOUR_HEIGHT`, `left`/`width` por `column`/`columns`. Los chips "+N" abren un `Popover` con la
    lista de los ocultos (cada uno, link a su edición como en 4.9; **no** arrastrables desde ahí).
  - `DndContext` con `PointerSensor` (`activationConstraint: { distance: 5 }`) y `TouchSensor`
    (`activationConstraint: { delay: 250, tolerance: 5 }`): la distancia mínima deja que el click
    siga funcionando y el delay deja que el dedo scrollee sin arrancar un drag. Sin
    `KeyboardSensor` (ver *Fuera de alcance*).
  - Estado local de los movimientos (copia de la prop, reseteada cuando la prop cambia) para el
    movimiento optimista de 4.5.
- [x] **4.4** `calendar-event.tsx` (`CalendarEvent`) — `useDraggable({ id: movement.id })`. Bloque
  con `borderLeft` sólido y fondo `${color}26` del color de `movement.movement_types.color`, texto
  en `text-foreground` (legible en tema oscuro). Línea 1: descripción truncada. Línea 2:
  `"14:30 · −Gs. 50.000"` (`+` en verde para `credit`, `−` en rojo para `debit`, monto con
  `toLocaleString("es-PY")`). Ícono `ArrowLeftRight` si `transfer_id`. Atributos:
  `data-movement-id`, y `aria-label` = `"<descripción>, <HH:mm>, <±Gs. monto>"`. Mientras se
  arrastra, el original queda con `opacity-50` y el que se mueve se dibuja con `DragOverlay`.
- [x] **4.5** `onDragEnd` en `movements-calendar.tsx`:
  1. Destino según el `over.id`: `day:<d>` ⇒ `minutes = offsetToMinutes(<top del rect arrastrado> −
     <top de la columna>)`; `allday:<d>` ⇒ `minutes = 0`; `strip:<d>` (mobile, 4.7) ⇒ conserva los
     minutos del movimiento. Sin `over` ⇒ no hace nada.
  2. Nueva fecha `toMovementDate(d, minutes)`. Si es igual a la actual (comparando los primeros 16
     caracteres de `movement.date`), no hace nada.
  3. Actualiza el estado local (optimista). ⚠️ Si es una transferencia, mueve **todos** los
     movimientos locales con el mismo `transfer_id` (con "Todas las cuentas" se ven las dos patas).
  4. Llama a `moveTransfer(transfer_id, date)` si hay `transfer_id`, si no a
     `updateMovementDate(id, date)`.
  5. Éxito ⇒ `await revalidatePathServer("/protected/movements")` y `router.refresh()`. Error ⇒
     restaura el estado previo y `toast.error("No se pudo mover el movimiento")`.
  ⚠️ No usar `revalidateMyDataAndRedirect` (ver *Decisiones tomadas*).
- [x] **4.6** `all-day-band.tsx` (`AllDayBand`) — fila con una celda por día, etiqueta "Sin hora" a
  la izquierda (en el lugar de la columna de horas). Cada celda: `useDroppable({ id:
  "allday:<día>" })`, `data-allday="<día>"`. Muestra hasta `ALL_DAY_VISIBLE` eventos `isAllDay` del
  día como `CalendarEvent` en versión compacta (una línea: descripción + monto) y, si hay más, un
  botón `"+N más"`; tocarlo expande **la banda entera** (estado local, todos los días a la vez) y
  el botón pasa a "Mostrar menos". Sin eventos `isAllDay` en la semana, la banda se sigue viendo
  (vacía, baja) para poder soltar ahí.
- [x] **4.7** Mobile (decisión D1):
  - `hooks/use-media-query.ts` (nuevo, crea la carpeta `hooks/`, alias `@/hooks` ya declarado en
    `components.json`): `useMediaQuery(query: string): boolean | undefined` con `matchMedia`;
    `undefined` antes de montar.
  - En `MovementsCalendar`: `const isDesktop = useMediaQuery("(min-width: 768px)")`. Mientras sea
    `undefined`, renderiza un `<Skeleton>` del alto de la grilla — ⚠️ renderizar las dos variantes y
    ocultar una con CSS duplicaría cada evento en el DOM (rompe los locators de los tests) y dos
    `DndContext` se pisan.
  - `isDesktop === false` ⇒ grilla y banda con un solo día (`selectedDay`) + `mobile-day-strip.tsx`
    arriba: 7 botones (`"LUN 5"`, …) con el seleccionado resaltado. Tocar uno hace
    `router.replace(<url actual con day=<día>>, { scroll: false })`. Cada botón es además
    `useDroppable({ id: "strip:<día>" })`: soltar un bloque ahí cambia el día conservando la hora
    (4.5).
- [x] **4.8** *(idea de Claude)* Línea roja de la hora actual en la columna de `today`
  (`data-now-line`), con un punto a la izquierda. Hora y minutos calculados con
  `Intl.DateTimeFormat` en `APP_TIME_ZONE`, actualizados cada 60 s con `setInterval`. Solo se
  dibuja si `today` está en los días visibles.
- [x] **4.9** *(idea de Claude)* Click en un `CalendarEvent` (sin arrastrar) navega a su edición con
  `returnTo` = URL actual del calendario (`usePathname()` + `useSearchParams()`):
  `withReturnTo("/protected/movements/edit/<id>", …)`, o `/protected/transfers/edit/<transfer_id>`
  si es transferencia (los mismos hrefs que `MovementActions` en `components/movements/table.tsx`).
  ⚠️ Después de un drag el navegador igual dispara `click` sobre el elemento: guardar en un `ref`
  que hubo drag (en `onDragStart`) e ignorar el click siguiente; si no, cada arrastre termina
  abriendo el formulario de edición. Necesita 5.3 para que "Guardar" vuelva al calendario.
- [x] **4.10** `calendar-view.tsx` (`CalendarView`, Server Component async) — recibe el filtro de
  cuenta/tipo y la semana resuelta. Llama a `getCalendarMovements` con `startDate`/`endDate` de la
  semana, y renderiza `WeekNav`, el aviso y `MovementsCalendar`:
  - `truncated` ⇒ texto `"Se muestran los primeros 1000 movimientos de esta semana."`
    (`text-sm text-muted-foreground`).
  - Sin movimientos ⇒ texto `"No hay movimientos en esta semana."` arriba de la grilla, **y la
    grilla igual se dibuja** (para navegar y, si se hace 5.4, para crear).

## Fase 5 — Página y rutas

- [x] **5.1** `app/protected/movements/page.tsx`:
  - Agrega `view`, `week`, `day` a `searchParams`. `view === "calendar"` ⇒ modo calendario; cualquier
    otro valor ⇒ lista (comportamiento actual, sin cambios).
  - En calendario: `const calendarWeek = resolveCalendarWeek({ week, day }, todayInAppTimeZone())`.
  - Renderiza `MovementsViewToggle` en la fila del título (después de "Transferir").
  - `MovementsTotals` recibe, en calendario, `startDate`/`endDate` de `calendarWeek` en vez de los de
    la URL; en lista, lo de hoy.
  - En calendario, en lugar del `<Suspense>` con `MovementsTable` va
    `<Suspense fallback={<Skeleton className="h-[70vh] w-full" />}><CalendarView … /></Suspense>`.
    ⚠️ El `key` del `Suspense` debe incluir `startDate` de la semana, para que al cambiar de semana
    se vea el fallback y no la semana anterior.
- [x] **5.2** `components/movements/filters.tsx`:
  - Nueva prop `view: "list" | "calendar"`.
  - En calendario no se renderiza `DateRangeFilter` (el período lo da `WeekNav`).
  - ⚠️ `clearFilters` hoy arma la URL de cero: en calendario tiene que conservar `view=calendar`,
    `week` y `day` además de poner `accountId=all`. Sin esto, "Limpiar filtros" devuelve a la lista.
  - `setParam`/`setParams` ya conservan el resto de los parámetros: no cambian.
- [x] **5.3** *(idea de Claude, va con 4.9)* `returnTo` en edición y borrado:
  - `app/protected/movements/edit/[id]/page.tsx`, `app/protected/movements/delete/[id]/page.tsx`,
    `app/protected/transfers/edit/[id]/page.tsx`, `app/protected/transfers/delete/[id]/page.tsx`:
    leen `searchParams.returnTo`, lo resuelven con
    `resolveReturnTo(raw, "/protected/movements")`, lo usan como `href` de `FormContainer` y lo
    pasan como prop `returnTo` al formulario.
  - `components/movements/edit-form.tsx`, `components/movements/delete-form.tsx`,
    `components/transfers/edit-form.tsx`, `components/transfers/delete-form.tsx`: prop
    `returnTo?: string`, y
    `revalidateMyDataAndRedirect("/protected/movements", returnTo ?? "/protected/movements")`.
  - ⚠️ El `redirect` a `/protected/transfers/edit/<transfer_id>` que hace
    `app/protected/movements/edit/[id]/page.tsx` tiene que reenviar el `returnTo`.
  - Sin `returnTo`, todo se comporta igual que hoy (el listado y sus tests no cambian).
- [ ] **5.4** *(no hecho: opcional, se dejó fuera para no complicar el resto)* *(idea de Claude, opcional)* Click en un hueco vacío de una `DayColumn` (no sobre un
  evento) navega a `/protected/movements/create?accountId=<accountParam>&date=<YYYY-MM-DDTHH:mm>`
  con la hora redondeada por `offsetToMinutes`. `app/protected/movements/create/page.tsx` acepta
  `date` (validado con `movementSchema.shape.date`; si no valida, se ignora) y
  `components/movements/create-form.tsx` lo usa como valor inicial de `date` en lugar de
  `nowForInput()`; "Crear y agregar otro" sigue reseteando a `nowForInput()`.

## Fase 6 — Cierre

- [x] **6.1** `npm run lint` y `npm run build`. Dónde suele romper: `useSearchParams()` en un
  Client Component sin `<Suspense>` arriba falla en build (el `CalendarView` ya está dentro de uno);
  tipos de `@dnd-kit/core` en `over.id` (`UniqueIdentifier` = `string | number`, convertir con
  `String()`).
- [x] **6.2** `CLAUDE.md`: sección "Vista calendario de movimientos" bajo *Arquitectura* con: los
  parámetros `view`/`week`/`day` y que ignora `startDate`/`endDate`; que la lectura es
  `getCalendarMovements` (sin paginar, tope 1000); que arrastrar escribe **solo** `date` con
  `updateMovementDate` y que las transferencias se mueven enteras con `moveTransfer`; la convención
  00:00 = "Sin hora"; el desvío `router.refresh()` en vez de `revalidateMyDataAndRedirect` y su
  porqué; y, si se hizo 5.3, que edición/borrado aceptan `returnTo`.
- [x] **6.3** Notas de cierre al final de este documento — *las escribe el orquestador al terminar
  las pruebas, no el implementador.*

## Criterios de prueba

Van en `e2e/movements-calendar.spec.ts`, cada test nombrado `"P.n — …"`.

**Datos comunes** (en `beforeAll`, con `qaSupabase()`; borrados en `afterAll` borrando las cuentas,
que arrastran sus movimientos en cascada, como `e2e/transfers.spec.ts`):

- Dos cuentas `uniqueName("calendar", "a")` y `uniqueName("calendar", "b")`. Todos los criterios
  filtran por `accountId=<cuenta A>` salvo que digan otra cosa, así los datos propios del usuario de
  QA no interfieren.
- Un tipo de movimiento existente cualquiera distinto de `Transferencia` (leído de `movement_types`;
  el usuario de QA **no puede crear tipos**).
- Semana fija en el pasado: **lunes 2026-01-05 a domingo 2026-01-11** (`week=2026-01-05`).
- Para ubicar un punto de la grilla: `[data-day="<día>"]` y `HOUR_HEIGHT = 64` px por hora desde el
  borde superior de la columna. Para arrastrar: `page.mouse.down()` sobre el bloque,
  `page.mouse.move(x, y, { steps: 10 })` hasta el destino, `page.mouse.up()`.

- **P.1** (4.1, 5.1) — En `/protected/movements?accountId=<A>` se ve el toggle "Lista | Calendario".
  Clic en "Calendario" ⇒ la URL tiene `view=calendar` y `accountId=<A>`, y se ven 7 encabezados de
  día (`LUN` … `DOM`). Clic en "Lista" ⇒ vuelve la tabla y la URL no tiene `view=calendar`.
- **P.2** (3.1, 3.3, 4.3, 4.4, 4.10) — Con un débito `"<único> almuerzo"` de Gs. 50.000 a las
  `2026-01-07T14:30`, en `?view=calendar&accountId=<A>&week=2026-01-05`: el bloque está dentro de
  `[data-day="2026-01-07"]`, muestra la descripción y `"14:30 · −Gs. 50.000"`, y su borde superior
  está a 14,5 × 64 = 928 px (± 4) del borde superior de la columna. Con `week=2026-01-08` (un
  jueves) la etiqueta es la misma: `"5 – 11 ene 2026"`.
- **P.3** (3.2, 3.4, 4.5) — Arrastrar el bloque de P.2 a `[data-day="2026-01-09"]` a la altura de
  las 10:00 (640 px) ⇒ el bloque queda en la columna del 9; consultando la base, `date` es
  `2026-01-09T10:00:00`; después de `page.reload()` sigue en la columna del 9 con `"10:00"`.
  Soltarlo en el mismo lugar del que salió no cambia `updated_at` (no hubo escritura).
- **P.4** (4.6, 4.5) — Con un movimiento a `2026-01-06T00:00`: aparece en `[data-allday="2026-01-06"]`
  y **no** dentro de `[data-day="2026-01-06"]`. Arrastrarlo a `[data-day="2026-01-06"]` a las 09:00
  ⇒ `date` = `2026-01-06T09:00:00` y sale de la banda. Arrastrar el bloque de P.3 a
  `[data-allday="2026-01-10"]` ⇒ `date` = `2026-01-10T00:00:00`.
- **P.5** (4.6) — Con 4 movimientos a `2026-01-08T00:00`: la celda `[data-allday="2026-01-08"]`
  muestra 3 bloques y `"+1 más"`; clic ⇒ muestra los 4 y el botón dice "Mostrar menos".
- **P.6** (3.2) — Con 5 movimientos a `2026-01-05T12:00`: dentro de `[data-day="2026-01-05"]` se
  ven 2 bloques y un chip `"+3"`; clic en el chip abre un popover con las 3 descripciones restantes.
- **P.7** (3.5, 4.5) — Con una transferencia de A a B creada con la RPC `create_transfer` a
  `2026-01-07T12:00`: en `?view=calendar&accountId=<A>&week=2026-01-05` arrastrar su bloque a
  `[data-day="2026-01-08"]` a las 15:00 ⇒ en la base **las dos filas** con ese `transfer_id` tienen
  `date` = `2026-01-08T15:00:00`.
- **P.8** (4.2, 5.1, 5.2) — En `?view=calendar&accountId=<A>&week=2026-01-05`:
  - "Semana siguiente" ⇒ `week=2026-01-12`, etiqueta `"12 – 18 ene 2026"`; "Semana anterior" vuelve.
  - "Hoy" ⇒ la etiqueta contiene el día de hoy (el test lo calcula en `America/Asuncion`).
  - El filtro "Período" (`DateRangeFilter`) no se ve.
  - Cambiar "Tipo de movimiento" ⇒ la URL conserva `view=calendar` y `week`.
  - "Limpiar filtros" ⇒ la URL tiene `view=calendar`, `week=2026-01-05` y `accountId=all`.
  - El card "Egresos" muestra la suma de los débitos de A en esa semana (con los datos de P.2, recién
    creados: `Gs. 50.000`) — no la de todo el historial.
- **P.9** (4.10) — En `?view=calendar&accountId=<B>&week=2025-06-02` (semana sin datos de B) se ve
  `"No hay movimientos en esta semana."` y la grilla igual se dibuja (hay 7 `[data-day]`).
- **P.10** (4.7) — Con viewport 390 × 844 y el movimiento de P.2 (recreado a `2026-01-07T14:30`):
  hay un solo `[data-day]`; la tira muestra 7 botones; clic en `"MIÉ 7"` ⇒ la URL tiene
  `day=2026-01-07` y el bloque se ve. Arrastrarlo (con mouse) sobre el botón `"VIE 9"` ⇒ `date` =
  `2026-01-09T14:30:00`.
- **P.11** (4.5) — Interceptando con `page.route` los `PATCH` a `**/rest/v1/movements*` y
  respondiendo 500: arrastrar un bloque a otro día ⇒ aparece el toast
  `"No se pudo mover el movimiento"` y el bloque vuelve a su columna original.
- **P.12** (4.9, 5.3) — Clic (sin arrastrar) en un bloque normal ⇒ URL
  `/protected/movements/edit/<id>?returnTo=…`; "Guardar" sin cambios ⇒ vuelve a
  `?view=calendar&accountId=<A>&week=2026-01-05`. Clic en el bloque de una transferencia ⇒
  `/protected/transfers/edit/<transfer_id>?returnTo=…`. Después de un arrastre (P.3), la URL sigue
  siendo la del calendario (el drag no abrió la edición).
- **P.13** (4.8) — En `?view=calendar&accountId=<A>` (semana actual) existe `[data-now-line]` dentro
  de la columna de hoy; en `week=2026-01-05` no existe.
- **P.14** (5.4, solo si se implementó) — Clic en un hueco de `[data-day="2026-01-08"]` a la altura
  de las 16:00 ⇒ `/protected/movements/create?…&date=2026-01-08T16:00` y el campo Fecha muestra esa
  fecha y hora.

**No cubierto por e2e**:

- **Tope de 1000 filas (`truncated`)** — crear más de 1000 movimientos en una semana no es razonable
  contra la base remota. Se verifica leyendo `getCalendarMovements` en la revisión del código.
- **Drag con touch real (long-press de 250 ms)** — P.10 usa el mouse en viewport mobile. Se verifica
  a mano en un teléfono.
- **Que el scroll táctil no arranque un drag** — a mano, en un teléfono.

## Fuera de alcance

- **Vista de mes** — descartada en D1: es otro layout (celdas sin horas) y duplica la fase 4.
- **Scroll horizontal de la semana en mobile** — descartado en D1: choca con el drag táctil.
- **Usar `startDate`/`endDate` como período del calendario** — descartado en D2.
- **Dibujar los movimientos de las 00:00 en la grilla** — descartado en D3: van a la banda "Sin hora".
- **Dejar las transferencias fijas** — descartado en D4.
- **Redimensionar bloques / duración** — un movimiento no tiene duración (restricción 2).
- **Arrastrar con teclado (`KeyboardSensor`)** — requiere un `coordinateGetter` propio para una
  grilla de tiempo; la alternativa accesible es el formulario de edición (4.9). Entra en un plan
  aparte si hace falta.
- **Arrastrar desde el popover "+N" o desde la banda expandida en el popover** — los ocultos solo se
  abren para editar.
- **Total de ingresos/egresos por día en el encabezado** — considerado al planificar y descartado: sumar filas
  en JS va contra la regla de agregaciones por RPC de `CLAUDE.md`, y una RPC nueva no se justifica
  para esta vista. Los totales de la semana ya están en `MovementsTotals`.
- **Editar otros campos en el calendario (monto, descripción) o "Deshacer" después de soltar** —
  no se pidió.
- **Crear arrastrando sobre un rango** (como Google) — sin duración no tiene sentido; la variante de
  click está en 5.4 (opcional).

El usuario revisó los puntos propuestos y no eliminó ninguno.

## Riesgos conocidos

- **Pantallas que ya funcionan y este plan toca:** `app/protected/movements/page.tsx`,
  `components/movements/filters.tsx` (`clearFilters`) y, con 5.3, las páginas y formularios de
  edición y borrado de movimientos y transferencias. Sin `view`/`returnTo` todo tiene que
  comportarse exactamente igual que hoy: correr la suite completa (`npm run test:e2e`), en especial
  `e2e/transfers.spec.ts`, `e2e/amount-input-calculator.spec.ts` y
  `e2e/movement-types-inline-create.spec.ts`, que pasan por esas pantallas.
- **Precisión del drag en los tests** — el snap a 15 min tolera ± 7 minutos (≈ 7 px); si los tests
  resultan inestables, el tester apunta al centro del slot y no al borde.
- **Hidratación del media query** — el primer render es el skeleton; si se ve un parpadeo molesto al
  entrar a la vista, es esperado y aceptado (ver 4.7).
- **Peer de React 19 en `@dnd-kit/core`** — ver 1.1.
- **Semanas con muchos importados** — la banda expandida puede ser muy alta; aceptado.
- **Un movimiento real a las 00:00 exactas se ve como "Sin hora"** — aceptado (D3).

## Registro de ejecución

**Inicio:** 2026-11-21 — orquestado con la skill `ejecutar-plan`.

### Ronda 1 — implementación

- **Hechos:** 1.1, 3.1–3.5, 4.1–4.10, 5.1–5.3, 6.1, 6.2. `[x]` verificados contra el reporte.
- **Sin hacer:** 5.4 (opcional, el implementador lo dejó fuera para no complicar el resto) ⇒ P.14 no aplica.
- **lint / build:** OK.
- **Desvíos declarados por el implementador:**
  - `layoutDayEvents` devuelve `{ placed: { event, column, columns }[], overflow: { top, hidden }[] }`, con `overflow.top` en minutos.
  - `addDays` ya existía en `lib/dashboard/date-range.ts`. Se reexporta desde `lib/movements/calendar.ts` en vez de duplicarlo.
  - Usa `collisionDetection={pointerWithin}`: el destino lo decide la posición del puntero. Los minutos salen del top del bloque arrastrado menos el top de la columna.
  - Archivo extra `components/movements/calendar/day-labels.ts` (`DAY_LABELS`), compartido por el encabezado y la tira mobile.
  - `@dnd-kit/core@^6.3.1` se instaló sin quejas del peer de React 19.

### Ronda 1 — pruebas

- **Suite completa:** 52 pasan, 3 fallan (P.3, P.4, P.7, las tres por I-1). No hay regresiones en las pantallas existentes.
- **Pasan:** P.1, P.2, P.5, P.6, P.8, P.9, P.10, P.11, P.12 (salvo "después de un arrastre no navega", que está dentro de P.3), P.13. P.14 no aplica.
- **Tests:** `e2e/movements-calendar.spec.ts` con 15 tests. Usa viewport 1280×1600 porque con 720 px de alto el autoscroll de dnd-kit desplaza los destinos.
- **I-1 [bug]** (4.3 / 4.4 / 4.5): al activarse el drag, el `DragOverlay` aparece unos 12 px más abajo que el bloque original y mantiene ese desfase todo el arrastre. Por eso el minuto destino sale siempre 15 min tarde (10:15, 09:15, 15:15), y soltar en el mismo lugar escribe 14:30 → 14:45. No depende del scroll ni de la distancia arrastrada. → Enviada al implementador (intento 1/3).

### Ronda 2 — corrección de I-1
- **Causa (implementador):** `MovementsCalendar` devolvía `<DndContext>` sin un elemento raíz propio. Así el `DragOverlay`, que va con `position: fixed`, quedaba como hermano dentro del `space-y-3` de `CalendarView` y heredaba `margin-top: 0.75rem` (12 px).
- **Corrección:** un `<div>` raíz alrededor de `DndContext` en `movements-calendar.tsx`, sin constantes de compensación. lint y build OK. → Re-test.

### Ronda 2 — pruebas
- **I-1:** resuelta. P.3, P.4 y P.7 pasan sin tocar sus expectativas. P.3 ahora sí verifica que el horario siga en 10:00 después de recargar y que el drag no abra la edición. Soltar el bloque en el mismo lugar no escribe nada.
- **Suite completa:** 55 pasan, 0 fallan.
- **Viewport de 720 px de alto:** el drag sigue cayendo en horas arbitrarias. El tester lo atribuye al autoscroll de la ventana de dnd-kit (el puntero queda en el 20% inferior de la ventana) y no a un error en el cálculo de minutos. No abrió incidencia. El spec mantiene el viewport de 1280×1600, con un comentario que explica por qué. → Se lo planteo al usuario en el cierre.

## Notas de cierre

**Resultado:** el plan quedó implementado salvo 5.4 (opcional). Pasan todos los criterios P.1–P.13; P.14 no aplica. La suite completa da 55/55.

**Desvíos respecto del plan:**
- `layoutDayEvents` devuelve `{ placed, overflow }`, con `overflow.top` en minutos. La forma cambió, el algoritmo no.
- `addDays` ya existía en `lib/dashboard/date-range.ts`: se reexporta en vez de duplicarse.
- La colisión de dnd-kit es `pointerWithin`: el destino es la celda bajo el puntero. Los minutos se calculan con el top del bloque arrastrado, como pide 4.5.
- Archivo extra: `components/movements/calendar/day-labels.ts` (`DAY_LABELS`), compartido por el encabezado y la tira mobile.
- `MovementsCalendar` envuelve `DndContext` en un `<div>` raíz. Es el arreglo de I-1: sin él, el `DragOverlay` heredaba el `space-y-3` del contenedor.

**Sin hacer:** 5.4 (crear un movimiento haciendo click en un hueco vacío de la grilla). Era opcional y el implementador lo dejó fuera, así que tampoco se escribió P.14.

**Incidencias:**
- **I-1 [bug]:** todo drag caía 15 min tarde por un margen de 12 px heredado por el `DragOverlay`. Se resolvió en 1 intento.

**Tests:** `e2e/movements-calendar.spec.ts`, con 15 tests (P.1–P.13; P.10 en un `describe` mobile y P.12 dividido en dos). Crean sus propias cuentas A/B y las borran en `afterAll`. Corren con viewport 1280×1600.

**Qué no se pudo verificar:**
- **Drag con un viewport bajo (≈720 px de alto, una laptop común):** el autoscroll de la ventana desplaza la grilla bajo el puntero y el bloque cae en otra hora. Los tests lo esquivan con un viewport alto, así que **la suite no cubre el caso de una pantalla baja**. Sigue abierto: hay que decidir si es aceptable.
- **Tope de 1000 filas (`truncated`):** no hay test e2e. Se verifica leyendo `getCalendarMovements`.
- **Drag táctil real (long-press de 250 ms) y que el scroll táctil no arranque un drag:** P.10 usa el mouse en un viewport mobile. Falta probarlo a mano en un teléfono.
- **Parpadeo del skeleton al hidratar el media query:** no se evaluó. El plan lo da por aceptado.
