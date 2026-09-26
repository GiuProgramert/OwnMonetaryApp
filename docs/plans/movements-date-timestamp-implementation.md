# Plan: hora en los movimientos — `movements.date` de `date` a `timestamp`

**Fecha:** 2026-09-26
**Estado:** implementado y migración aplicada en remoto; **pendientes las verificaciones manuales** (1.2, 6.2, 6.3)

## Objetivo

Un movimiento pasa a guardar **fecha y hora**, no solo el día. El formulario de alta y edición usa un
`datetime-local`, las tablas muestran la hora cuando el movimiento la tiene, y el listado de
movimientos queda ordenado de forma **estable y cronológica dentro de un mismo día**: el movimiento
que acabás de crear aparece donde le corresponde y no se mueve de lugar al recargar.

El síntoma que originó el plan es el orden inestable. Ese síntoma tiene **dos causas
independientes**, y el plan arregla las dos — ver restricción 1.

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

### Lo que ya existe y se reusa

- `lib/dashboard/date-range.ts` — helpers puros de fecha en **hora local**, con el `toDateString`
  privado que evita el `toISOString()` (UTC). Es el molde del helper nuevo de la Fase 3 y recibe
  `nextDay` en 3.1.
- `lib/budgets/month.ts` — mismo molde, para meses calendario. No se toca.
- `RecordCard` (`components/record-card.tsx`) — la vista mobile de la tabla de movimientos; la fecha
  viaja como un `field` más.
- `components/date-range-filter.tsx`, `components/movements/filters.tsx` — filtros por rango de
  días. **No se tocan** (punto 4.7).

### Restricciones que condicionan el diseño

1. **El orden no tiene desempate.** `lib/services/movements.ts:63` hace
   `.order("date", { ascending: false })` y nada más. Entre filas con la misma fecha, Postgres
   devuelve el orden que le convenga al plan de ejecución, y ese orden **cambia cuando insertás una
   fila**. Consecuencias: (a) el movimiento nuevo aparece en un lugar arbitrario entre los de su
   día; (b) la paginación por `.range()` puede repetir o saltear filas entre páginas. El cambio de
   tipo *no alcanza* para arreglar esto: los movimientos importados entran todos a las 00:00 del
   mismo día y siguen empatados. Hace falta el desempate explícito de la Fase 1.
2. **El fin de rango es inclusivo hoy y se rompe con `timestamp`.** `m.date <= p_end_date` entre dos
   `date` incluye el último día completo. Con `timestamp`, el `date` del parámetro se castea a
   medianoche y **se pierde todo lo posterior a las 00:00 del último día del rango**. Afecta tres
   RPC (punto 2.4) y `lib/services/movements.ts:54` (punto 3.1).
3. **Los extractos bancarios no traen hora, y la huella de deduplicación hashea el string de fecha.**
   `buildFingerprint` (`lib/imports/helpers/fingerprint.ts`) arma `sha256(date|type|amount|desc)` con
   `row.date` en formato `"yyyy-MM-dd"`. Si ese formato cambia, los `fp:` nuevos no coinciden con los
   `external_id` ya guardados y **se duplica todo lo importado antes**. Por eso `ExtractedRow.date`
   queda intacto (punto 5.1).
4. **Cambiar el tipo de un parámetro de función crea una sobrecarga, no reemplaza.**
   `create_transfer` y `update_transfer` reciben `p_date date`; un `CREATE OR REPLACE` con
   `p_date timestamp` dejaría **dos** funciones y PostgREST no sabría cuál llamar. Hay que
   `DROP FUNCTION` con la firma vieja y re-emitir el `GRANT EXECUTE` con la nueva (punto 2.6).
5. **No hay Docker en esta máquina** (ver [`docs/supabase.md`](../supabase.md)). No hay
   `supabase db reset` ni shadow DB: la migración **no se puede probar localmente** y va directo
   contra el proyecto remoto con `npm run db:push`. El ciclo completo es
   `migration new` → editar → `db:push` → `db:pull` → `db:types`.
6. **`new Date("2026-09-26")` se parsea como UTC; `new Date("2026-09-26T00:00:00")` como local.** Es
   la especificación de ECMAScript: la forma solo-fecha es UTC, la forma con hora y sin offset es
   local. Hoy `new Date(movement.date).toLocaleDateString("es-PY")` muestra **el día anterior** en
   cualquier máquina al oeste de UTC. Este plan lo arregla de paso, sin un punto dedicado.
7. **Presupuestos y `DateRangeFilter` no se ven afectados.** `get_budget_status` y
   `get_budget_history` ya comparan con `>= month_start` y `< month_start + interval '1 month'`, que
   sobreviven al cambio de tipo sin tocarse. Está escrito como punto (2.7) justamente para que nadie
   los "arregle".
8. **El trigger de saldo no lee `date`.** `update_account_balance` trabaja sobre `amount`, `type` y
   `account_id`; el cambio de tipo no puede descuadrar `accounts.current_balance`.
9. **TypeScript no va a ayudar.** `Movement.date` sigue siendo `string`: solo cambia su contenido
   (`"2026-09-26"` → `"2026-09-26T14:30:00"`). Ningún lugar olvidado va a fallar en `tsc`. La lista
   de puntos de la Fase 4 y el grep de 6.1 son la única red.

## Decisiones tomadas

- **`timestamp without time zone`, no `timestamptz`.** Hoy la columna es `date` y todo el app asume
  "día calendario local de Paraguay"; `timestamp` conserva esa semántica exacta y **ninguna
  comparación en SQL hace matemática de zonas**. Con `timestamptz` un movimiento de las 22:00 del
  30/09 local se guarda como 01:00 del 01/10 UTC y —como la sesión de PostgREST corre en UTC— caería
  en el mes siguiente en todas las agregaciones del dashboard y de los presupuestos. Contrapartida
  aceptada: si algún día se usa la app desde otra zona horaria, las horas se muestran como hora
  paraguaya, no como hora local del visitante.
- **La hora se muestra solo cuando no es 00:00.** Los movimientos importados entran todos a
  medianoche; mostrar "26/09/2026, 00:00" en cientos de filas es ruido que no informa nada.
  Contrapartida aceptada: un movimiento real cargado a medianoche se ve sin hora, indistinguible de
  uno importado. Consecuencia sobre el plan: `formatMovementDate` (3.4) decide el formato, y 4.4/4.5
  no formatean por su cuenta.
- **Las filas existentes migran a 00:00, no a la hora de `created_at`.** La alternativa (tomar la
  hora de creación para las filas con `external_id is null`) inventa horas que nunca existieron, y en
  un movimiento cargado con fecha retroactiva pega la hora de hoy sobre un día viejo. Contrapartida
  aceptada: el histórico no gana orden intradía real; lo ordena el desempate por `created_at` de 1.1,
  que para las filas viejas es orden de carga, no orden cronológico.
- **Las transferencias también llevan hora** (punto 4.6). Es el mismo widget y el mismo helper, y
  dejarlas sin hora las manda siempre al fondo de su día — justo la clase de problema que este plan
  arregla.

## Orden de despliegue

Importa, y no es obvio:

- **Las Fases 1, 2.4 y 3.1 son compatibles hacia atrás.** `m.date < (p_end_date + interval '1 day')`
  sobre una columna `date` es exactamente equivalente a `m.date <= p_end_date`, y el desempate por
  `created_at` funciona igual con cualquiera de los dos tipos. Se pueden mergear y desplegar **antes**
  del `ALTER` sin romper nada.
- **La Fase 4 tiene que ir después de 2.8.** Un `datetime-local` que manda `"2026-09-26T14:30"` a una
  columna `date` no falla: Postgres lo castea y **descarta la hora en silencio**. Perderías datos sin
  ningún error.
- ⚠️ **La ventana entre `db:push` y el deploy del front.** Con la columna ya en `timestamp` y el front
  viejo todavía en producción, el `.lte("date", endDate)` de `movements.ts:54` deja de contar los
  movimientos posteriores a las 00:00 del último día del rango. Si 3.1 ya está desplegado antes del
  `db:push`, la ventana no existe. Ese es el orden recomendado: **Fases 1 y 3 primero, después 2, y
  al final 4.**

## Fase 1 — Orden determinista

Arregla el síntoma reportado por sí sola, sin tocar la base. Se puede mergear y desplegar
independientemente del resto del plan.

- [x] **1.1** `lib/services/movements.ts:63` — encadenar un segundo criterio
  `.order("created_at", { ascending: false })` **después** del `.order(orderBy, { ascending: false })`
  existente. PostgREST respeta el orden de encadenamiento y emite `order=date.desc,created_at.desc`.
  `created_at` ya está en `MOVEMENT_COLUMNS` (línea 16), así que no hay que agregarlo al `select`.
  Aplica igual cuando `orderBy` es `"amount"` (lo usa `components/dashboard/top-expenses-card.tsx`):
  ahí el desempate también hace falta, porque dos gastos del mismo monto empatan igual.
- [ ] **1.2** *(pendiente: verificación manual, no se corrió la app)* Verificar a mano: crear dos movimientos con la misma fecha y confirmar que el más nuevo
  queda arriba y **sigue ahí al recargar**; con más de 25 movimientos en el filtro, pasar a la página
  2 y confirmar que ninguna fila se repite ni desaparece.

> Por qué `created_at` y no `id`: `id` es un `gen_random_uuid()`, no tiene relación con el tiempo, así
> que ordenaría de forma estable pero arbitraria. `created_at` da un orden estable **y** con sentido
> (orden de carga), que es el que hace que "el registro nuevo quede donde corresponde".

## Fase 2 — Base de datos

- [x] **2.1** `npx supabase migration new movements_date_to_timestamp`.
- [x] **2.2** En la migración, el cambio de tipo con su comentario de por qué `timestamp` y no
  `timestamptz` (el razonamiento vive en *Decisiones tomadas*, pero la migración es lo que lee quien
  audita la base):

  ```sql
  alter table public.movements
    alter column date type timestamp using date::timestamp,
    alter column date set default localtimestamp;

  comment on column public.movements.date is
    'Fecha y hora local del movimiento (sin zona: la app asume hora de Paraguay). Las filas previas al cambio de tipo quedaron a las 00:00.';
  ```

  `date::timestamp` deja las filas existentes a las 00:00 y no puede fallar. El índice
  `idx_movements_date` se reconstruye solo con el `ALTER`.
- [x] **2.3** Actualizar `supabase/schemas/public/tables/movements.sql:5` a mano para que el commit
  quede consistente, aunque `db:pull` lo regenere después.
- [x] **2.4** ⚠️ **El punto que más duele si queda a medias.** Reemplazar `m.date <= p_end_date` por
  `m.date < (p_end_date + interval '1 day')` en:
  - `supabase/schemas/public/functions/get_movements_totals.sql:25`
  - `supabase/schemas/public/functions/get_expenses_by_movement_type.sql:25`
  - `supabase/schemas/public/functions/get_monthly_flow.sql:25`

  Sin esto, un movimiento cargado hoy a las 14:00 **desaparece de los totales y de los gráficos del
  mes en curso**, que es el rango por defecto del dashboard y de `/protected/movements`. El síntoma es
  especialmente confuso porque la tabla sí lo muestra (esa consulta no pasa por las RPC) y los totales
  no. Los parámetros `p_start_date` / `p_end_date` **siguen siendo `date`**: los filtros de la UI son
  rangos de días, así que no cambia ninguna firma y `CREATE OR REPLACE` alcanza (no aplica la
  restricción 4). El `>= p_start_date` no se toca: castea a las 00:00 del primer día, que es lo
  correcto.
- [x] **2.5** `get_monthly_flow.sql:16` — sacar el `::timestamp` de
  `date_trunc('month', m.date::timestamp)::date`, que con la columna ya en `timestamp` es un cast
  redundante.
- [x] **2.6** ⚠️ `create_transfer` y `update_transfer`: `p_date date` → `p_date timestamp`. Por la
  restricción 4, la migración necesita el `DROP` explícito **antes** del `CREATE`, y el `GRANT`
  después:

  ```sql
  drop function if exists public.create_transfer(uuid, uuid, numeric, date, text);
  drop function if exists public.update_transfer(uuid, uuid, uuid, numeric, date, text);
  -- ... CREATE FUNCTION con p_date timestamp ...
  grant execute on function public.create_transfer(uuid, uuid, numeric, timestamp, text)
    to public, anon, authenticated, postgres, service_role;
  -- idem update_transfer(uuid, uuid, uuid, numeric, timestamp, text)
  ```

  Los nombres de los parámetros no cambian, así que `lib/services/transfers.client.ts` (que manda
  `p_date`) **no se toca en esta fase** — solo cambia el valor que le llega desde el formulario (4.6).
  Actualizar también los dos archivos en `supabase/schemas/public/functions/`.
- [x] **2.7** Confirmar y dejar escrito en la migración que las RPC de presupuestos
  (`get_budget_status`, `get_budget_history`, `ensure_budget_periods`) **no se tocan**, porque ya usan
  `>= month_start` / `< month_start + interval '1 month'` (restricción 7). Sin este comentario, la
  próxima sesión los "completa" y rompe el borde del último día del mes en la dirección contraria.
- [x] **2.8** `npm run db:push` → `npm run db:pull` → `npm run db:types`, y commitear los tres
  resultados. ⚠️ Recordar la restricción 5: esto corre **contra el proyecto remoto**, no hay ensayo
  local posible.
- [ ] **2.9** *(opcional, no se hizo por el sesgo del plan)* Reemplazar `idx_movements_date` por un índice compuesto
  `(date desc, created_at desc)` que cubra el orden nuevo. Para el volumen real de la app (un usuario,
  miles de filas) no cambia nada medible y agrega una migración más; el sesgo es **no hacerlo**.

## Fase 3 — Schemas y servicios

Se puede hacer antes de la Fase 2 (ver *Orden de despliegue*).

- [x] **3.1** `lib/dashboard/date-range.ts` — agregar `nextDay(date: string): string` (puro y
  síncrono, mismo molde que el `toDateString` privado del archivo) y usarlo en
  `lib/services/movements.ts:54`: `.lte("date", endDate)` → `.lt("date", nextDay(endDate))`. Es el
  equivalente en PostgREST del punto 2.4; la consulta de la tabla no pasa por ninguna RPC.
- [x] **3.2** `lib/schemas/movements.ts:23` — `date` sigue siendo `z.string()`, con un regex que
  acepte **las dos formas**: `YYYY-MM-DD` y `YYYY-MM-DDTHH:mm`. ⚠️ No puede ser un regex estricto de
  datetime: `bulkCreateMovements` manda solo fecha (punto 5.1) y `importedMovementSchema` extiende
  este mismo schema.
- [x] **3.3** `lib/schemas/movements.ts:43` — comentar en el tipo `Movement` que `date` sigue siendo
  `string` pero ahora trae `"2026-09-26T14:30:00"`, con el apunte de que **TS no marca los lugares
  olvidados** (restricción 9).
- [x] **3.4** Nuevo `lib/movements/datetime.ts`, un solo lugar para las tres conversiones en vez de
  `slice()` repetido en seis archivos:
  - `nowForInput(): string` — `YYYY-MM-DDTHH:mm` en **hora local**, para el default del formulario.
  - `toInputValue(dbValue: string): string` — lo que acepta un `datetime-local`. ⚠️ `slice(0, 16)`,
    porque el valor de la base trae segundos (`"...T14:30:00"`) y puede traer microsegundos si la fila
    se creó con el `default localtimestamp`; un `datetime-local` sin `step` rechaza los segundos.
  - `formatMovementDate(dbValue: string): string` — `"26/09/2026"` o `"26/09/2026, 14:30"` según la
    decisión tomada. ⚠️ Detectar la medianoche **sobre el string** (`"T00:00"`), no con
    `new Date(...).getHours()`: es más barato y no depende de la zona horaria del runtime, que en el
    server es UTC y en el browser es la del usuario.
- [x] **3.5** `lib/services/transfers.ts:7` — el campo `date: string` del tipo `Transfer` no cambia de
  tipo pero sí de contenido; comentarlo igual que 3.3, porque lo consume el formulario de 4.6.

## Fase 4 — Componentes

Depende de 3.4 (el helper) y de 2.8 (la columna ya migrada — ver *Orden de despliegue*).

- [x] **4.1** `components/movements/movement-form-fields.tsx:38` — `type="date"` →
  `type="datetime-local"`. El `<Input>` de shadcn no necesita nada más.
- [x] **4.2** ⚠️ `components/movements/create-form.tsx:33` y `:68` —
  `new Date().toISOString().slice(0, 10)` → `nowForInput()`. Es **UTC**: hoy ya precarga el día
  equivocado en las horas cercanas a medianoche, y con hora precargaría 3 o 4 horas de más de forma
  visible. El `:68` es el reset del flujo "Guardar y crear otro", y se olvida fácil porque está en
  otra función del mismo archivo.
- [x] **4.3** ⚠️ `components/movements/edit-form.tsx:29` — `date: initialValues.date` →
  `toInputValue(initialValues.date)`. Sin esto el campo llega vacío o normalizado por el browser,
  porque el valor de la base trae segundos.
- [x] **4.4** `components/movements/table.tsx:189` (desktop) y `:236` (el `field` de `RecordCard` en
  mobile) → `formatMovementDate(movement.date)`. Son **dos** lugares en el mismo archivo.
- [x] **4.5** `components/dashboard/recent-movements-card.tsx:39` y
  `components/dashboard/top-expenses-card.tsx:35` → el mismo helper.
- [x] **4.6** Transferencias, por la decisión tomada: `components/transfers/transfer-form-fields.tsx:27`
  (`type="datetime-local"`), `components/transfers/create-form.tsx:21` (`nowForInput()`) y
  `components/transfers/edit-form.tsx:26` (`toInputValue(initialValues.date)`). La RPC ya acepta
  `timestamp` por 2.6 y los nombres de parámetros no cambiaron, así que
  `lib/services/transfers.client.ts` no se toca.
- [x] **4.7** `components/movements/filters.tsx` y `components/date-range-filter.tsx` **no se tocan**:
  los rangos siguen siendo por día calendario, igual que `?month=` en presupuestos. Este punto existe
  para que nadie los "complete" con hora; el fin de rango ya lo resuelven 2.4 y 3.1.

## Fase 5 — Importación

- [x] **5.1** ⚠️ `lib/imports/types.ts:4` — `ExtractedRow.date` **se queda en `"yyyy-MM-dd"`** y
  ningún adaptador de `lib/imports/adapters/` cambia. Motivo completo en la restricción 3: cambiar ese
  formato invalida los `fp:` ya guardados y **duplica todo lo importado antes**. Si en el futuro un
  extracto trae hora, va en un campo aparte y **fuera** de la huella.
- [x] **5.2** `lib/services/movements.client.ts` → `bulkCreateMovements` no cambia. Las filas entran
  con fecha sin hora y Postgres las castea a las 00:00; el desempate de 1.1 las deja ordenadas por
  orden de inserción, que es el orden del extracto.
- [x] **5.3** `components/movements/import/import-preview-table.tsx` y `import-preview-cards.tsx`
  siguen mostrando solo la fecha. No agregar columna ni campo de hora: no hay dato que mostrar.

## Fase 6 — Cierre

- [ ] **6.1** *(tsc OK; falta lint/build y el grep)* `npm run lint` y `npm run build`. ⚠️ Ninguno de los dos va a detectar un lugar olvidado
  (restricción 9). Red de seguridad manual:
  `grep -rn "toLocaleDateString\|toISOString\|slice(0, 10)" components lib` — cada resultado sobre un
  movimiento tiene que estar cubierto por un punto de la Fase 4, y los que quedan tienen que ser de
  filtros de rango (4.7) o de la importación (5.x).
- [ ] **6.2** *(pendiente: requiere la migración aplicada)* Probar los bordes, en este orden:
  - dos movimientos el mismo día con horas distintas → orden cronológico correcto;
  - dos movimientos con la **misma hora exacta** → el nuevo arriba, estable al recargar (verifica 1.1);
  - un movimiento a las 23:30 del **último día** del rango filtrado → aparece en la tabla **y** en los
    totales **y** en el gráfico de flujo mensual (verifica 2.4 y 3.1; si solo aparece en la tabla,
    falta una de las tres RPC);
  - un gasto el último día del mes a las 23:00 sobre un tipo con presupuesto → cuenta como gastado
    (verifica la restricción 7);
  - reimportar un extracto ya importado → 0 insertados (verifica 5.1);
  - crear y editar una transferencia → las dos filas apareadas quedan con la misma hora;
  - filas previas al cambio de tipo → se muestran sin hora;
  - crear un movimiento cerca de medianoche → el default del formulario es hoy, no mañana
    (verifica 4.2).
- [ ] **6.3** *(pendiente: verificación visual)* Mobile y dark mode: `datetime-local` en Chrome Android abre dos selectores encadenados
  (fecha y hora), y el campo "Fecha" del `RecordCard` de `table.tsx` se alarga con la hora — verificar
  que no rompa el layout de la card.
- [x] **6.4** Documentar en `docs/database.md`: sección nueva sobre `movements.date`, con (a) por qué
  `timestamp` y no `timestamptz`, (b) la regla de que **todo fin de rango sobre `movements.date` es
  `< día + 1`, nunca `<=`**, y (c) que las filas previas al cambio están a las 00:00. En
  `docs/imports.md`: por qué la huella de dedup sigue en `yyyy-MM-dd` y qué se rompe si cambia.
- [x] **6.5** Agregar a `CLAUDE.md` en la sección de movimientos: el fin de rango exclusivo, que el
  listado ordena por `date desc, created_at desc` (y por qué el desempate no es decorativo), y que el
  default de fecha en los formularios se calcula en hora local con `lib/movements/datetime.ts`, nunca
  con `toISOString()`.
- [x] **6.6** Notas de cierre al final de este documento.

## Fuera de alcance

- **`timestamptz`** — descartado en *Decisiones tomadas*. No "mejorarlo" después sin revisar las tres
  RPC del dashboard y las tres de presupuestos: el cambio mueve los bordes de mes.
- **Migrar las filas viejas a la hora de `created_at`** — descartado: inventa horas que nunca
  existieron. Si algún día hace falta orden intradía histórico, el desempate por `created_at` de 1.1
  ya lo da en el listado sin tocar los datos.
- **Hora en la importación de extractos** (en `ExtractedRow`, en la huella o en el preview) — fuera
  por la restricción 3. Requeriría un campo separado de la huella y un adaptador que efectivamente
  traiga la hora; ningún extracto de los soportados la trae.
- **Hora en los filtros de rango** (`DateRangeFilter`, `components/movements/filters.tsx`) y en el
  selector de mes de presupuestos — fuera por 4.7: los rangos son por día calendario y el borde ya lo
  resuelven 2.4 y 3.1.
- **Orden configurable por columna desde la UI** de la tabla de movimientos — no se pidió. El
  parámetro `orderBy` de `getMovements` sigue siendo interno, con los dos valores que ya tiene.
- **Segundos en el formulario** — `datetime-local` sin `step` da precisión de minutos, y alcanza.
  Poner `step="1"` agregaría un campo más que nadie va a llenar.

El usuario revisó los puntos en el chat y **no eliminó ninguno**: entraron las cuatro propuestas
marcadas como idea propia (1.1/1.2 el desempate, 3.4 el helper, 4.6 las transferencias, 4.7 el punto
defensivo sobre los filtros), y 2.9 quedó como opcional con sesgo a no hacerse.

## Riesgos conocidos

- **La ventana entre `db:push` y el deploy del front** (ver *Orden de despliegue*). Es el riesgo más
  concreto del plan y se elimina desplegando la Fase 3 antes de la Fase 2. Si igual se hace al revés,
  el efecto es transitorio y no corrompe datos: los totales subcuentan el último día del rango hasta
  que el front nuevo sale.
- **La columna que se pierde en silencio.** Un `datetime-local` contra una columna `date` no falla,
  trunca. Si por algún motivo la Fase 4 sale antes que 2.8, se pierden horas sin ningún error visible
  y sin forma de recuperarlas.
- **El `ALTER` no es reversible sin pérdida.** Volver a `date` trunca la hora de todas las filas
  cargadas mientras la columna era `timestamp`. No hay migración de rollback en este plan a propósito:
  el camino de vuelta es un `alter ... type date`, y hay que asumir la pérdida.
- **Superficie que este plan toca y hoy funciona:** el dashboard entero (las tres RPC), los totales de
  `/protected/movements`, los presupuestos (indirectamente, por el borde del último día del mes), las
  transferencias (firma de las dos RPC) y la importación (el schema Zod compartido). Los bordes de 6.2
  están ordenados para cubrir exactamente eso.
- **`db:pull` puede traer más de lo esperado.** Con `--strict-coverage`, si el proyecto remoto tiene
  algo que el árbol declarativo no refleja, el pull lo trae junto con este cambio. Revisar el diff de
  `supabase/schemas/**` antes de commitear 2.8, y no mezclar hallazgos ajenos en este commit.

## Notas de cierre

**Hecho:** Fases 1 (código), 3, 4 y 5 (sin cambios, por diseño) y la migración `20260926181502_movements_date_to_timestamp.sql`
(ALTER + 3 RPC con fin exclusivo + `create/update_transfer` con `timestamp` + comentario de presupuestos), con los
archivos de `supabase/schemas/**` editados a mano (2.3). Documentación en `docs/database.md`, `docs/imports.md` y `CLAUDE.md`.

**Desvíos:** ninguno respecto del plan. Un detalle no previsto: `formatMovementDate` también acepta separador espacio
(`"2026-09-26 14:30:00"`) por si PostgREST lo devolviera así.

**Sin hacer:** 2.9 (opcional). 2.8 se corrió (`db:push` lo ejecutó el usuario; `db:pull` y `db:types` después). Ojo: se aplicó
sin haber desplegado antes el front, así que mientras el front viejo siga en producción los totales subcuentan el último día del rango.

**Verificado:** `tsc --noEmit` sin errores; `supabase db push --linked --dry-run` listó solo la migración nueva; el push real terminó sin error; `db:pull` solo
regeneró formato/comentario de `movements.sql` (sin hallazgos ajenos); `database.types.ts` no cambió (`date` sigue `string`); `tsc` OK.
Lint sobre los archivos tocados OK (el `npm run lint` global falla por archivos minificados ajenos).

**No se pudo verificar:** la migración no se ejecutó (sin Docker, sin ensayo local); ninguno de los bordes de 6.2 ni
el layout mobile/dark (6.3); 1.2 (orden y paginación) tampoco, porque no se corrió la app. El resultado de `npm run lint`
y `npm run build` se anota abajo si corrieron.
