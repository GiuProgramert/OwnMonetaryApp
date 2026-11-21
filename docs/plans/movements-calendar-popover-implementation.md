# Plan: popover de detalle al hacer click en un movimiento del calendario

**Fecha:** 2026-11-21
**Estado:** implementado y probado — P.1–P.12 pasan (2026-11-21)

## Objetivo

En la vista calendario de `/protected/movements?view=calendar`, hacer click en un movimiento ya no
navega a la edición: abre un **popover anclado al bloque, como el de Google Calendar**, con un
detalle corto del movimiento y tres botones arriba a la derecha — **Editar**, **Eliminar** y
**Cerrar**. El popover se cierra con la X, con Escape o haciendo click fuera de él. Lo mismo pasa con
los movimientos que se abren desde el chip "+N" y desde la banda "Sin hora", y funciona igual en
mobile.

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

- `components/movements/calendar/movements-calendar.tsx` — `MovementsCalendar`. Tiene `onOpen`,
  que hoy hace `router.push(editHref(movement))`, y `editHref`, que arma
  `/protected/movements/edit/<id>` o `/protected/transfers/edit/<transfer_id>` con
  `withReturnTo(..., pathname + query)` (`lib/return-to.ts`). También tiene `draggedRef` (ignora el
  `click` que el navegador dispara después de soltar un arrastre) e `isDesktop`
  (`useMediaQuery("(min-width: 768px)")`).
- `components/movements/calendar/calendar-event.tsx` — `CalendarEvent` (bloque arrastrable con
  `useDraggable`, llama a `onOpen` en `onClick` y en Enter) y los helpers `signedAmount(movement)`
  ("−Gs. 50.000" / "+Gs. 50.000") y `movementTime(movement)`.
- `components/movements/calendar/all-day-band.tsx` (`AllDayBand` / `AllDayCell`) y
  `components/movements/calendar/day-column.tsx` (`DayColumn`) — pasan `onOpen` a cada
  `CalendarEvent`. `DayColumn` además dibuja el chip "+N" de los movimientos solapados ocultos: un
  `Popover` **no controlado** cuya lista son `<Link href={editHref(item.movement)}>`.
- `components/ui/popover.tsx` — `Popover`, `PopoverContent`, `PopoverAnchor`, `PopoverClose` (shadcn
  sobre `radix-ui` 1.x; `PopoverContent` ya lleva `role="dialog"` y portal).
- `lib/movements/calendar.ts` — `splitMovementDate(date)` → `{ day: "YYYY-MM-DD", minutes,
  isAllDay }` (`isAllDay` = 00:00, la convención "Sin hora").
- Páginas de borrado con `?returnTo=`: `app/protected/movements/delete/[id]/page.tsx` (si el
  movimiento es una transferencia, redirige a la de transferencias conservando `returnTo`) y
  `app/protected/transfers/delete/[id]/page.tsx`. Sus formularios (`components/movements/delete-form.tsx`,
  `components/transfers/delete-form.tsx`) ya redirigen a `returnTo` después de borrar y "Cancelar"
  hace `router.back()`.

Restricciones que condicionan el diseño:

1. **El bloque es arrastrable con dnd-kit.** No se puede envolver en un `PopoverTrigger`: el
   `Trigger` de Radix agrega sus propios handlers de puntero y de click, que se pisan con los
   `listeners` de `useDraggable`. Por eso el popover es **uno solo, controlado, en
   `MovementsCalendar`**, y se ancla al elemento clickeado con `PopoverAnchor virtualRef` (Radix
   1.1.x lo soporta: `PopperAnchorProps.virtualRef?: RefObject<Measurable>`; un `HTMLElement`
   cumple `Measurable`).
2. **Radix cierra un popover no modal en `pointerdown` afuera y en foco afuera.** Lo de "click
   afuera cierra" viene gratis; pero cualquier cosa que mueva el foco fuera del popover al abrirlo
   (por ejemplo, la lista del chip "+N" devolviendo el foco a su trigger al cerrarse) lo cierra en
   el acto. Ver ⚠️ en 2.7.
3. **La grilla scrollea adentro de su propio contenedor** (`max-h-[70vh] overflow-y-auto`). Pasar
   el elemento DOM real como `virtualRef` (no un objeto `{ getBoundingClientRect }` armado a mano)
   es lo que permite que floating-ui detecte ese contenedor como ancestro con scroll y reposicione
   el popover.
4. **Hay tests que hoy fijan el comportamiento viejo** en `e2e/movements-calendar.spec.ts`: los dos
   `P.12` (click ⇒ URL de edición) y `P.6` (la lista del "+3" tiene 3 `link`). Con este plan dejan
   de pasar; el tester los actualiza (ver *Criterios de prueba*).

## Decisiones tomadas

- **Eliminar navega a la página de borrado existente; no se borra desde el popover.** El botón
  Eliminar es un link a `/protected/movements/delete/<id>?returnTo=<calendario>` (o
  `/protected/transfers/delete/<transfer_id>?returnTo=…` si es transferencia). El usuario lo eligió
  porque eliminar es poco frecuente: no justifica una confirmación inline nueva con su manejo de
  errores. Contrapartida aceptada: se sale del calendario y, al volver, la grilla pierde el scroll
  vertical (vuelve a `INITIAL_SCROLL_HOUR`). Alternativas descartadas: confirmación dentro del
  popover con `deleteMovement`/`deleteTransfer` + `router.refresh()`, y borrar al instante con
  "Deshacer" estilo Google Calendar (deshacer una transferencia la recrearía con otros ids).
- **Los ítems de la lista del chip "+N" abren el mismo popover de detalle**, anclado al chip, en
  vez de navegar a la edición como hoy. Así todo click sobre un movimiento del calendario hace lo
  mismo. Contrapartida: el `Popover` del chip pasa a ser controlado y hay que cuidar el foco (2.7).
- **En mobile se usa el mismo popover anclado**, no un panel inferior (`Dialog`/sheet). `w-72`
  (288 px) entra en pantallas de 360 px con `collisionPadding`. Contrapartida: se ve menos "nativo"
  que un bottom sheet; a cambio es un solo componente y un solo camino de código.
- **Lado del popover según el ancho**: `side="right"` en desktop (como Google Calendar, al costado
  del bloque) y `side="bottom"` en mobile. En mobile la columna ocupa casi todo el ancho, así que ni
  derecha ni izquierda entran y Radix solo prueba el lado opuesto antes de desbordar.
- **Click en otro bloque con el popover abierto cambia el detalle a ese otro movimiento; click en
  el mismo bloque lo deja abierto** (el `pointerdown` afuera lo cierra y el `click` lo vuelve a
  abrir). No es un toggle.
- **El detalle no muestra la cuenta contraparte de una transferencia**: la fila de `movements` solo
  embebe su propia cuenta (`accounts`), y buscarla obligaría a una lectura más. Ver *Fuera de
  alcance*.

## Fase 1 — Lógica pura

- [x] **1.1** `lib/movements/calendar.ts` — agregar `formatEventDay(day: string): string`, que
  recibe `YYYY-MM-DD` (el `day` de `splitMovementDate`) y devuelve `"Miércoles, 7 de enero"`: arma
  `new Date(year, month - 1, date)` en hora local, formatea con
  `Intl.DateTimeFormat("es-PY", { weekday: "long", day: "numeric", month: "long" })` y pone en
  mayúscula la primera letra. ⚠️ Nunca `new Date("YYYY-MM-DD")` (lo interpreta como UTC y en
  Paraguay da el día anterior) ni `toISOString()`. Sin año: el calendario ya muestra la semana.

## Fase 2 — Componentes

- [x] **2.1** Nuevo `components/movements/calendar/event-details-popover.tsx` (`"use client"`,
  export default `EventDetailsPopover`). Props: `movement: Movement`, `anchorRef:
  RefObject<HTMLElement | null>`, `side: "right" | "bottom"`, `onClose: () => void`, `editHref:
  string`, `deleteHref: string`. Renderiza `<Popover open onOpenChange={(open) => { if (!open) {
  onClose(); } }}>` con `<PopoverAnchor virtualRef={anchorRef} />` y un `<PopoverContent>` con
  `side={side}`, `align="start"`, `collisionPadding={16}`, `hideWhenDetached` (si el bloque sale del
  área visible de la grilla al scrollear, el popover se oculta en vez de flotar sobre la cabecera),
  `className="w-72 p-4"` y `aria-label={movement.description}` (para que los tests lo encuentren con
  `getByRole("dialog", { name })`). El componente solo se monta mientras hay un movimiento
  seleccionado (ver 2.5), por eso `open` es siempre `true`.
- [x] **2.2** Cabecera de `EventDetailsPopover`: tres botones de ícono alineados a la derecha, en
  este orden y como en Google Calendar — **Editar** (`Pencil`), **Eliminar** (`Trash2`) y **Cerrar**
  (`X`), todos con `Button variant="ghost" size="icon"` y `aria-label` exactos `"Editar"`,
  `"Eliminar"` y `"Cerrar"` (más `title` con el mismo texto). Editar y Eliminar son
  `<Button asChild><Link href={…}></Button>` (rol `link`): Editar a `editHref`, Eliminar a
  `deleteHref`. Cerrar es un botón que llama a `onClose`.
- [x] **2.3** Cuerpo de `EventDetailsPopover`, de arriba abajo:
  - Una muestra cuadrada del color del tipo (`movement.movement_types.color`, `size-3 rounded-sm`) y
    la descripción como título (`text-lg`, puede ocupar varias líneas — no truncar).
  - `"<formatEventDay(day)> · <hora>"`, con la hora de `movementTime(movement)`, o
    `"<formatEventDay(day)> · Sin hora"` cuando `splitMovementDate(movement.date).isAllDay`.
  - El monto con `signedAmount(movement)`, en verde si es `credit` y rojo si es `debit` (mismas
    clases que `EventBlock` en `calendar-event.tsx`).
  - Filas con ícono de lucide a la izquierda: cuenta (`Wallet`, un punto con
    `movement.accounts.color` y `movement.accounts.name`) y tipo de movimiento (`Tag`,
    `movement.movement_types.name`).
  - Si `movement.transfer_id`: una fila `ArrowLeftRight` con el texto `"Transferencia"`.
- [x] **2.3.1** Si `movement.debts` no es `null`: una fila (`Receipt`) con `"Pago de "` y un
  `<Link href={`/protected/debts/${movement.debts.id}`}>` con `movement.debts.name`. Sin `returnTo`:
  la página de detalle de la deuda no lo usa.
- [x] **2.4** `movements-calendar.tsx` — reemplazar `editHref` por
  `actionHref(movement: Movement, action: "edit" | "delete"): string`, que arma
  `/protected/transfers/<action>/<transfer_id>` si `movement.transfer_id` y
  `/protected/movements/<action>/<id>` si no, siempre con `withReturnTo(…, returnTo)` y el mismo
  `returnTo` que hoy (`pathname` + `searchParams`). Para transferencias se va directo a la página de
  transferencias, sin pasar por el `redirect` de `movements/delete/[id]`.
- [x] **2.5** `movements-calendar.tsx` — estado `selected: Movement | null` y `anchorRef =
  useRef<HTMLElement | null>(null)`. `onOpen(movement, anchor: HTMLElement)` mantiene el corte por
  `draggedRef`, guarda `anchorRef.current = anchor` y hace `setSelected(movement)` (ya no hay
  `router.push`). Se renderiza `{selected && <EventDetailsPopover key={selected.id} … />}` dentro de
  la raíz del calendario, con `side={isDesktop ? "right" : "bottom"}`, `editHref={actionHref(selected,
  "edit")}` y `deleteHref={actionHref(selected, "delete")}`. El `key` por id es necesario: cambia el
  `anchorRef.current` pero no el objeto ref, y sin remontar Radix no se entera del nuevo ancla y deja
  el popover pegado al bloque anterior. `handleDragStart` hace `setSelected(null)`: empezar a
  arrastrar cierra el popover.
  - ⚠️ No usar `useRouter` para Editar/Eliminar: son links. `router` sigue haciendo falta para el
    `router.refresh()` del arrastre.
- [x] **2.6** `calendar-event.tsx` — `onOpen` pasa a ser `(movement: Movement, anchor: HTMLElement)
  => void` y el bloque lo llama con `event.currentTarget` tanto en `onClick` como en el Enter de
  `onKeyDown`. Agregar al bloque `aria-haspopup="dialog"`. Propagar la firma nueva en
  `all-day-band.tsx` (`AllDayCell`, `AllDayBand`) y `day-column.tsx` (`DayColumn`); `DayColumn` deja
  de recibir `editHref`.
- [x] **2.7** `day-column.tsx` — extraer el chip "+N" a un componente local `OverflowChip` (en el
  mismo archivo) con su `Popover` **controlado** (`useState`). Cada ítem de la lista deja de ser un
  `<Link>` y pasa a ser un `<button type="button">` con el mismo contenido (descripción + hora ·
  monto); al hacer click cierra la lista y llama a `onOpen(item.movement, chipElement)`, donde
  `chipElement` es el botón del chip (ref). Depende de 2.6.
  - ⚠️ En el `PopoverContent` de la lista, `onCloseAutoFocus={(event) => event.preventDefault()}`.
    Si no, al cerrarse la lista Radix devuelve el foco al chip, que queda **fuera** del popover de
    detalle recién abierto, y este se cierra solo (restricción 2). Probarlo: es el modo de falla
    esperable de este punto.
- [x] **2.8** `event-details-popover.tsx` — al cerrar, devolver el foco al bloque: en el
  `PopoverContent`, `onCloseAutoFocus={(event) => { event.preventDefault();
  anchorRef.current?.focus(); }}`. Sin `PopoverTrigger`, Radix no sabe a dónde volver y el foco cae
  en `body`, así que con teclado (Enter abre, Escape cierra) se pierde la posición. ⚠️ Como el
  componente se desmonta (no pasa a `open=false`), verificar que `onCloseAutoFocus` se ejecute de
  verdad; si no, mover el `focus()` a `onClose` en `MovementsCalendar` y reportar el desvío.

## Fase 3 — Cierre

- [x] **3.1** `npm run lint` y `npm run build`. Lo esperable: `virtualRef` tipado como
  `RefObject<Measurable>` contra `RefObject<HTMLElement | null>` — si TS se queja, castear en el
  punto de uso con un comentario, sin cambiar el tipo del ref.
- [x] **3.2** `CLAUDE.md`, sección "Vista calendario de movimientos": agregar un ítem **Click** —
  abre `EventDetailsPopover` (un único `Popover` controlado en `MovementsCalendar`, anclado con
  `PopoverAnchor virtualRef` porque el bloque es arrastrable y no puede ser `PopoverTrigger`);
  Editar y Eliminar son links a las páginas existentes con `returnTo`; la lista del chip "+N" abre
  el mismo popover. Ajustar el ítem `returnTo` existente si hace falta.
- [x] **3.3** Notas de cierre al final de este documento — *las escribe el orquestador al terminar
  las pruebas, no el implementador.*

## Criterios de prueba

Van en `e2e/movements-calendar-popover.spec.ts`, con el mismo armado de datos que
`e2e/movements-calendar.spec.ts` (`qaSupabase`, `uniqueName`): el test crea dos cuentas propias A y
B, inserta los movimientos con un tipo de movimiento **existente** (el usuario de QA no puede crear
`movement_types`), trabaja en la semana fija `week=2026-01-05` con `accountId=<A>` y borra todo en el
`afterAll`. Viewport de escritorio 1280 × 1600 salvo donde se indica.

- **P.1** (1.1, 2.1, 2.3, 2.5, 2.6) — Con un débito de Gs. 50.000 "`<prefijo> detalle`" el
  2026-01-07 14:30 en la cuenta A, click en su bloque ⇒ aparece `getByRole("dialog", { name:
  "<prefijo> detalle" })` con los textos `"Miércoles, 7 de enero · 14:30"`, `"−Gs. 50.000"`, el
  nombre de la cuenta A y el nombre del tipo; la URL **no cambia** (sigue con `view=calendar`).
- **P.2** (2.1, 2.2) — Con el popover de P.1 abierto: click en `"Cerrar"` lo cierra; reabrirlo y
  apretar Escape lo cierra; reabrirlo y hacer click en una zona vacía de la grilla (otra columna,
  lejos del popover) lo cierra. En los tres casos la URL no cambia y el movimiento sigue en la base.
- **P.3** (2.2, 2.4) — Desde el popover, `"Editar"` (link) ⇒ URL
  `/protected/movements/edit/<id>?returnTo=…`; "Guardar" vuelve a `/protected/movements` con
  `view=calendar`, `accountId=<A>` y `week=2026-01-05`. Reemplaza al primer `P.12` de
  `movements-calendar.spec.ts`.
- **P.4** (2.3, 2.4) — Con una transferencia de A a B creada con la RPC `create_transfer` el
  2026-01-07 12:00, click en su bloque ⇒ el popover muestra `"Transferencia"`; `"Editar"` lleva a
  `/protected/transfers/edit/<transfer_id>?returnTo=…`. Reemplaza al segundo `P.12`.
- **P.5** (2.2, 2.4) — Desde el popover de un movimiento normal, `"Eliminar"` ⇒ URL
  `/protected/movements/delete/<id>?returnTo=…`; confirmar con "Eliminar" vuelve al calendario
  (`view=calendar`, `week=2026-01-05`), el bloque ya no está y la fila no existe en la base. Con
  otro movimiento, "Cancelar" en la página de borrado vuelve al calendario y el bloque sigue.
- **P.6** (2.4) — Con la transferencia de P.4, `"Eliminar"` desde el popover ⇒ URL
  `/protected/transfers/delete/<transfer_id>?returnTo=…` (directo, no `movements/delete`);
  confirmar vuelve al calendario y las **dos** filas del `transfer_id` no existen en la base.
- **P.7** (2.3) — Con un movimiento el 2026-01-08 a las 00:00, click en su bloque de la banda "Sin
  hora" ⇒ el popover dice `"Jueves, 8 de enero · Sin hora"`.
- **P.8** (2.7) — Con 5 movimientos el 2026-01-05 a las 12:00, click en el chip `"+3"` ⇒ la lista
  muestra 3 **botones** con el prefijo; click en el primero ⇒ la lista se cierra y queda abierto el
  `dialog` con la descripción de ese movimiento (el caso del ⚠️ de 2.7: si el foco lo cierra, este
  criterio falla). La URL no cambia.
- **P.9** (2.5) — Con dos movimientos en días distintos, abrir el popover del primero y hacer click
  en el bloque del segundo ⇒ queda un solo `dialog`, con la descripción del segundo.
- **P.10** (2.5) — Arrastrar un bloque a otro día (mismo método que el `P.3` de
  `movements-calendar.spec.ts`) **no** deja ningún `dialog` abierto al soltar, y la fecha se
  escribe.
- **P.11** (2.1, 2.5) — Viewport 390 × 844 (mobile): con el movimiento de P.1 y `day=2026-01-07`,
  tocar el bloque ⇒ aparece el `dialog` y su `boundingBox()` queda completo dentro del viewport
  (`x >= 0`, `x + width <= 390`).
- **P.12** (2.6, 2.8) — Enfocar un bloque con Tab y apretar Enter abre el popover; Escape lo cierra
  y el foco vuelve al bloque (`expect(block).toBeFocused()`).

**Tests existentes a actualizar** en `e2e/movements-calendar.spec.ts` (plan
`movements-calendar-implementation.md`):

- Borrar los dos `P.12` ("click abre la edición…" y "click en una transferencia…"): los reemplazan
  P.3 y P.4 de este plan.
- `P.6` ("chip '+3' con popover"): cambiar `getByRole("link")` por `getByRole("button")` dentro de
  la lista; el resto del test queda igual.

**No cubierto por e2e:**

- **Que el popover siga al bloque cuando se scrollea la grilla con el popover abierto, y que se
  oculte al salir el bloque del área visible (`hideWhenDetached`)** — se verifica a mano;
  depende de animaciones de posición y es frágil de afirmar en Playwright.

## Fuera de alcance

- **Eliminar desde el popover** (confirmación inline con `deleteMovement`/`deleteTransfer` +
  `router.refresh()`) — se propuso y el usuario eligió navegar a la página de borrado existente
  porque eliminar es poco frecuente. No agregar estado de "eliminando" ni llamadas a servicios en
  el popover.
- **"Deshacer" después de eliminar** — descartado: deshacer una transferencia la recrearía con otros
  ids, y además eliminar no ocurre en el popover.
- **Panel inferior (bottom sheet / `Dialog`) en mobile** — descartado por el usuario; mobile usa el
  mismo popover con `side="bottom"`.
- **Los íconos de mail y "⋮" de Google Calendar** — no tienen equivalente en la app.
- **Cuenta contraparte de una transferencia en el detalle** — la fila solo embebe su propia cuenta;
  haría falta leer la otra pata. Si se quiere, es un plan aparte.
- **Popover de detalle en la vista lista** (`components/movements/table.tsx`) — el pedido es solo
  para el calendario.
- **Editar campos dentro del popover** — Editar lleva a la página de edición existente.
- **Crear un movimiento haciendo click en un hueco vacío** — era el 5.4 opcional del plan del
  calendario; sigue sin hacer y no entra acá.

El usuario revisó los puntos propuestos y no eliminó ninguno (2.3.1 y 2.8 fueron propuestos por
quien escribió el plan y quedaron).

## Riesgos conocidos

- **Arrastrar sigue funcionando** — este plan toca `onOpen` y los handlers del bloque arrastrable.
  Si `onClick`/`onKeyDown` cambian de lugar o se agrega un `onPointerDown`, dnd-kit puede dejar de
  activar el arrastre. Lo cubren `P.3`/`P.4`/`P.7`/`P.10` de `movements-calendar.spec.ts`: correr
  ese spec completo además del nuevo.
- **Al volver de Eliminar o Editar se pierde el scroll vertical** de la grilla
  (`revalidateMyDataAndRedirect` remonta la página). Es la contrapartida aceptada de la decisión
  sobre Eliminar; no es una incidencia.
- **Dos popovers de Radix a la vez** (lista "+N" y detalle) durante un instante en 2.7 — cualquier
  test que use `[data-radix-popper-content-wrapper]` sin filtrar puede encontrar dos; preferir
  `getByRole("dialog", { name })`.

## Registro de ejecución

**2026-11-21** — inicio de la ejecución con la skill `ejecutar-plan`. Árbol de trabajo limpio (solo
el plan y `.claude/worktrees/` sin seguimiento).

**Ronda 1 — implementador.** Hechos 1.1, 2.1–2.8, 3.1, 3.2 (`[x]` conciliados con el reporte).
Sin bloqueos ni desvíos declarados. 3.1: el `virtualRef` lleva el cast
`anchorRef as RefObject<HTMLElement>` con comentario. 2.8: `onCloseAutoFocus` implementado como
pide el plan, sin comprobar en el navegador que corra al desmontar (lo cubre P.12). 3.2: además del
ítem **Click**, el ítem `returnTo` de `CLAUDE.md` pasa a decir "guardar o borrar". `npm run lint` y
`npm run build` OK.

**Ronda 1 — tester.** P.1–P.8, P.10 y P.11 pasan; P.9 y P.12 fallan. Tests en
`e2e/movements-calendar-popover.spec.ts` (nuevo, P.1–P.12) y `e2e/movements-calendar.spec.ts`
actualizado (borrados los dos `P.12` viejos, `P.6` con `button`). Suite completa: 63 pasan, 2 fallan
(P.9, P.12). P.5 falló una vez en una corrida aislada y pasó en las siguientes (el tester lo atribuye
a su propio test). 2.3.1 no tiene criterio P.n y no se probó.

- **I-1 [bug] 2.8 → 2.5** — con un popover abierto, click en otro bloque deja todo cerrado (P.9).
  El `onCloseAutoFocus` del popover viejo, al desmontarse por el `key`, enfoca `anchorRef.current`,
  que ya apunta al bloque nuevo; el foco sale del popover nuevo y Radix lo cierra.
- **I-2 [bug] 2.6 / 2.8** — Enter sobre un bloque enfocado abre el popover y lo cierra enseguida
  (P.12): Radix mueve el foco a un botón del popover y la activación de Enter cae sobre ese botón.

**Ronda 2 — implementador (I-1, I-2).** La sesión se cortó a mitad de la corrección; se retomó al
mismo implementador, que completó y verificó. I-1: `EventDetailsPopover` captura su ancla al montar
(`ownAnchor`) y `onCloseAutoFocus` solo la enfoca si `anchorRef.current === ownAnchor`. I-2: el Enter
de `CalendarEvent` hace `event.preventDefault()` antes de `onOpen`. Desvíos declarados: 2.8 ya no
enfoca `anchorRef.current` a secas; 2.6 suma el `preventDefault()`. `npm run lint` y `npm run build`
OK.

**Ronda 2 — tester.** I-1 e I-2 resueltas: P.9 y P.12 pasan (en P.12, tras Escape el foco vuelve al
bloque, lo que confirma que `onCloseAutoFocus` corre al desmontar). P.8 sigue pasando; P.5 pasó en
todas las corridas. Suite completa `npm run test:e2e`: 65 pasan, 0 fallan. Una corrida suelta falló
en el proyecto `setup` (login del usuario de QA), intermitente y ajeno a los cambios.

## Notas de cierre

**Resultado:** todos los puntos hechos (1.1–3.2, y 3.3 con estas notas). P.1–P.12 pasan; suite
completa en verde (65/65).

**Desvíos del plan** (declarados por el implementador, surgidos de las incidencias):

- **2.8** — `onCloseAutoFocus` ya no enfoca `anchorRef.current` a secas: `EventDetailsPopover`
  captura su ancla al montar (`ownAnchor`) y la enfoca solo si sigue siendo la vigente
  (`anchorRef.current === ownAnchor`). Sin eso, al cambiar de bloque el popover viejo, desmontado
  por el `key`, enfocaba el bloque nuevo y Radix cerraba el popover nuevo por foco afuera (I-1).
- **2.6** — el Enter del bloque hace `event.preventDefault()` antes de `onOpen`: Radix movía el foco
  a un botón del popover y la activación del mismo Enter lo cerraba (I-2).
- **3.1** — el cast previsto: `anchorRef as RefObject<HTMLElement>` en el `virtualRef`, con
  comentario.
- **3.2** — además del ítem **Click**, el ítem `returnTo` de `CLAUDE.md` dice "guardar o borrar".

**Incidencias:** I-1 (P.9) e I-2 (P.12), ambas `bug`, resueltas en una ronda cada una. La ⚠️ de 2.7
(foco del chip "+N") no se materializó: P.8 pasó desde la primera ronda.

**Tests:** `e2e/movements-calendar-popover.spec.ts` (nuevo, P.1–P.12) y
`e2e/movements-calendar.spec.ts` actualizado (borrados los dos `P.12` viejos; `P.6` busca `button`
en la lista del "+3"). Se corren con `npm run test:e2e`.

**No verificado:**

- **2.3.1** (fila "Pago de <deuda>" con link a `/protected/debts/<id>`): implementada pero sin
  criterio P.n ni test; nadie la vio en el navegador.
- **Seguimiento del popover al scrollear la grilla y `hideWhenDetached`**: el plan lo deja para
  verificación manual y no se hizo.
- **P.5** falló una vez en una corrida aislada de la ronda 1 y no volvió a fallar; no se encontró la
  causa. El proyecto `setup` (login de QA) también falló una vez de forma intermitente.
