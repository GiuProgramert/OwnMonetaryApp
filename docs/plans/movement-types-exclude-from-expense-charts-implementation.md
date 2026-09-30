# Plan: excluir tipos de movimiento de los gráficos de gastos por tipo

**Fecha:** 2026-09-29
**Estado:** terminado — implementado y probado (P.1–P.7); pendiente verificación manual del dueño, ver Notas de cierre

## Objetivo

Cada tipo de movimiento tiene un campo nuevo, "Excluir de los gráficos de gastos", que se marca
desde el alta y la edición del tipo. Los gastos de un tipo marcado dejan de aparecer en los cards
"Gastos por tipo" y "Gastos diarios por tipo" del dashboard. Siguen contando en saldos, en
"Egresos", en el flujo mensual, en los presupuestos y en el listado de movimientos. El caso que lo
motiva es el tipo `Prestado`: figura como gasto, pero esa plata vuelve, y ensucia los dos gráficos.

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

- `supabase/schemas/public/functions/get_expenses_by_movement_type.sql` y
  `get_daily_expenses_by_movement_type.sql` — las dos RPC que alimentan los cards. Ya filtran
  `m.type = 'debit'` y `m.transfer_id is null` y hacen `join public.movement_types mt`, así que el
  filtro nuevo es una condición más en el mismo `where`.
- `lib/services/dashboard.ts` — `getExpensesByMovementType` y `getDailyExpensesByMovementType`
  consumen esas RPC, calculan porcentajes y agrupan en "Otros" (`OTROS_TOP_N = 8`). **No cambian.**
- `components/accounts/create-form.tsx` y `components/accounts/edit.form.tsx` — el molde del
  checkbox booleano: `Controller` + `Checkbox` (`components/ui/checkbox.tsx`) + `Label` + texto de
  ayuda en `text-sm text-muted-foreground`, con `onCheckedChange={(checked) => field.onChange(checked === true)}`.
  El campo `is_primary` es `z.boolean()` en `lib/schemas/accounts.ts`.
- `components/accounts/table.tsx` — el molde del `Badge variant="secondary"` junto al nombre
  ("Principal"), en la tabla de escritorio y en el `RecordCard` de mobile.
- `components/dashboard/expenses-by-type-card.tsx` y `daily-expenses-card.tsx` — los dos cards, con
  su `CardDescription`.
- `lib/services/movement-types.ts` — `getMovementTypes` y `getMovementTypeById`, cada uno con su
  `.select("id,name,description,color,created_at,updated_at")` literal.

Restricciones que condicionan el diseño:

1. **El filtro va en SQL, no en JS.** La agrupación en "Otros" (top 8) y los porcentajes de "Gastos
   por tipo" se calculan en `lib/services/dashboard.ts` sobre lo que devuelve la RPC. Si el tipo
   excluido se quitara después en JS, ya habría ocupado uno de los 8 lugares del top y entrado en el
   total de los porcentajes. Además, la regla del módulo es que toda agregación va por RPC
   (`CLAUDE.md`, sección Dashboard).
2. **`movement_types` es una tabla global, sin dueño.** La lectura está abierta a cualquier
   autenticado y la escritura está restringida al UUID literal del dueño de la app
   (`supabase/schemas/public/tables/movement_types.sql`). Por eso el campo nuevo también es global:
   marcar un tipo lo excluye para todos los usuarios. Hoy la app tiene un solo usuario real.
3. **⚠️ El usuario de QA no puede crear ni editar `movement_types`.** El tester no puede marcar ni
   desmarcar el campo. Los tests necesitan un tipo que ya esté marcado; el punto 1.2 marca `Prestado`
   para que exista. Guardar el campo desde el formulario se verifica a mano (ver *No cubierto por
   e2e*).
4. **⚠️ `components/movement-types/create-form.tsx` no pasa `defaultValues` a `useForm`.** Con
   `z.boolean()` en el schema, un checkbox que nunca se tocó queda `undefined` y el formulario no
   se envía. Hay que agregar `defaultValues` (ver 3.1).
5. **`updateMovementTypeClient` (`lib/services/movement-types.client.ts`) manda `params` a
   `.update()`, no `parsed.data`.** Los dos formularios mandan todos los campos del schema, así que el
   campo nuevo viaja igual. No se toca (ver *Fuera de alcance*).
6. **`db:push` va directo a producción y no hay staging** (`docs/supabase.md`).
7. **Las RPC redefinidas tienen que seguir siendo `security invoker` con `set search_path to ''`.**
   Si una perdiera eso, correría con los permisos del dueño y devolvería movimientos de todos los
   usuarios. Probarla desde el SQL editor de Supabase no detecta el problema, porque ese editor
   corre como `postgres` (`docs/database.md`, "Funciones RPC del dashboard").

## Decisiones tomadas

- **La exclusión aplica solo a "Gastos por tipo" y "Gastos diarios por tipo".** Se evaluó extenderla
  al card "Mayores gastos" (`TopExpensesCard`), donde un `Prestado` grande también mete ruido, y se
  descartó. Hacía falta un parámetro nuevo en `getMovements`, porque el card filtra en JS después
  de traer una página y podía quedar con menos de 5 gastos. Contrapartida aceptada: un tipo excluido
  puede seguir apareciendo en "Mayores gastos".
- **"Egresos", flujo mensual, presupuestos y saldos no respetan el campo.** Esas vistas reflejan el
  movimiento real de plata y tienen que cuadrar con el saldo de las cuentas. Contrapartida aceptada:
  la suma de las barras de "Gastos por tipo" puede ser menor que "Egresos" en el mismo período. La
  nota "No incluye: …" (3.4, opcional) lo explica en pantalla.
- **Filtro fijo, sin interruptor en los cards.** Se evaluó un "Incluir excluidos" en cada card, y
  se descartó: pedía un parámetro nuevo en cada RPC, un parámetro de URL por card y una prueba más.
  Para volver a ver un tipo en los gráficos se desmarca el campo desde su edición.
- **Campo global en `movement_types`, no por usuario.** Ver restricción 2. En el plan de
  transferencias ya se había descartado agregar `user_id` a esta tabla.
- **Nombre de la columna: `exclude_from_expense_charts`.** Dice lo que hace. Un nombre semántico
  ("no es gasto real") invitaría a aplicarlo a "Egresos" y al flujo, y eso es lo que se descartó
  arriba.
- **La misma migración marca `Prestado`.** Es el tipo que el usuario nombró, y así los gráficos quedan
  limpios apenas se aplica la migración. También garantiza el tipo marcado que necesitan los tests
  (restricción 3). `movement_types.name` es único (`movement_types_name_key`), así que filtrar por
  nombre es seguro.

## Arquitectura

```
movement_types.exclude_from_expense_charts  (boolean not null default false)
        │
        ├─ get_expenses_by_movement_type        ─┐  and not mt.exclude_from_expense_charts
        ├─ get_daily_expenses_by_movement_type  ─┘
        │        └─ lib/services/dashboard.ts   (sin cambios: top 8, "Otros", porcentajes)
        │
        └─ formularios / tabla de /protected/movement-types  (checkbox + badge)

No lo leen: get_movements_totals, get_monthly_flow, get_budget_status,
            get_budget_history, getMovements (TopExpensesCard, listado).
```

## Fase 1 — Base de datos

- [x] **1.1** Migración con `npx supabase migration new add_movement_types_exclude_from_expense_charts`,
  escrita a mano (flujo en `docs/supabase.md`). Contiene, en este orden:
  - `alter table public.movement_types add column exclude_from_expense_charts boolean not null default false;`
  - `comment on column public.movement_types.exclude_from_expense_charts is` con un texto que diga
    que excluye el tipo de "Gastos por tipo" y de "Gastos diarios por tipo", y que no afecta a
    saldos, totales, flujo mensual ni presupuestos.
  - `create or replace function public.get_expenses_by_movement_type(...)` y
    `create or replace function public.get_daily_expenses_by_movement_type(...)`, copiadas de
    `supabase/schemas/public/functions/*.sql` **sin otro cambio** que agregar
    `and not mt.exclude_from_expense_charts` en el `where`. En la diaria, la condición va dentro
    del CTE `by_day`.
  - Arriba de la migración, un comentario con el porqué del filtro en SQL (restricción 1), como en
    `20260927174257_add_get_daily_expenses_by_movement_type.sql`.
  - ⚠️ Conservar exactamente los parámetros (nombres, orden y defaults), el `RETURNS TABLE`, `language sql`,
    `stable`, `set search_path to ''` y los `GRANT EXECUTE`. Si cambia la firma, `create or replace`
    crea una función nueva al lado de la vieja en vez de reemplazarla. Nunca `security definer`
    (restricción 7).
- [x] **1.2** En la misma migración, después del `alter table`:
  `update public.movement_types set exclude_from_expense_charts = true where name = 'Prestado';`.
  Si el tipo no existe, el update no toca filas y la migración no falla; eso está bien.
- [x] **1.3** ⚠️ `supabase db push --linked --dry-run`, mostrarle la salida al usuario y **esperar su
  confirmación** antes de `npm run db:push` (restricción 6). Después, `npm run db:pull`: actualiza
  `supabase/schemas/public/tables/movement_types.sql` y los dos archivos de funciones. Por último,
  `npm run db:types`. Si `db:types` falla, el archivo queda vacío: volver a correrlo, no editarlo a
  mano.

## Fase 2 — Schema y servicios

Depende de la Fase 1: el `select` de 2.2 falla si la columna todavía no existe.

- [x] **2.1** `lib/schemas/movement-types.ts`: agregar `exclude_from_expense_charts: z.boolean()` a
  `movementTypeSchema`, sin `.default()`, igual que `is_primary` en `lib/schemas/accounts.ts`.
  Agregar `exclude_from_expense_charts: boolean;` al tipo `MovementType`.
- [x] **2.2** `lib/services/movement-types.ts`: sumar `exclude_from_expense_charts` al `.select(...)`
  de `getMovementTypes` y al de `getMovementTypeById`.
- [x] **2.3** `lib/services/dashboard.ts` **no se modifica.** El filtro ya viene aplicado desde la
  RPC. No agregar ningún filtro en JS por este campo (restricción 1).

## Fase 3 — Componentes

Depende de la Fase 2. 3.1, 3.2 y 3.3 son independientes entre sí; 3.4 depende de 3.4.1.

- [x] **3.1** `components/movement-types/create-form.tsx`:
  - agregar `control` a lo que se desestructura de `useForm` y
    `defaultValues: { exclude_from_expense_charts: false }` (restricción 4). No agregar defaults
    para los otros campos: el formulario queda como está salvo por esto;
  - debajo del grid de inputs y antes del botón, el bloque de checkbox copiado de
    `components/accounts/create-form.tsx` (`Controller` + `Checkbox` + `Label` + ayuda), con
    `id="exclude_from_expense_charts"`;
  - etiqueta: **"Excluir de los gráficos de gastos"**;
  - ayuda: **"No aparece en «Gastos por tipo» ni en «Gastos diarios por tipo». Sigue contando en
    saldos, egresos y flujo mensual."**
- [x] **3.2** `components/movement-types/edit-form.tsx`: el mismo bloque, con la misma etiqueta y la
  misma ayuda. El `Controller` lleva `defaultValue={initialValues.exclude_from_expense_charts}`, o
  bien se pasa `defaultValues: { exclude_from_expense_charts: initialValues.exclude_from_expense_charts }`
  a `useForm`; elegir uno solo. Los demás inputs siguen con su `defaultValue` por input, sin
  refactor.
- [x] **3.3** `components/movement-types/table.tsx`: `<Badge variant="secondary" className="shrink-0">`
  con el texto **"Excluido de gráficos"** junto al nombre cuando `exclude_from_expense_charts` es
  `true`. Va en la celda de nombre de la tabla de escritorio (envolver en
  `flex items-center gap-2 min-w-0`, como `components/accounts/table.tsx`) y en el `title` del
  `RecordCard` de mobile.
- [x] **3.4** *(opcional)* Nota de tipos excluidos en los dos cards del dashboard:
  - [x] **3.4.1** En `lib/services/movement-types.ts`, `getExcludedFromExpenseChartsTypeNames(): Promise<string[]>`:
    `from("movement_types").select("name").eq("exclude_from_expense_charts", true).order("name")`.
    Devuelve los nombres. No hace falta `getUser()` ni scoping, porque `movement_types` es global.
  - [x] **3.4.2** `components/dashboard/expenses-by-type-card.tsx`: llamarla junto con
    `getExpensesByMovementType` (en paralelo, con `Promise.all`). Si la lista no está vacía, agregar
    a la descripción ` No incluye: ${names.join(", ")}.` después de "Distribución de egresos del
    período seleccionado."
  - [x] **3.4.3** `components/dashboard/daily-expenses-card.tsx`: lo mismo, agregando
    ` No incluye: …` al final de `description`, tanto en la rama del rango futuro como en la
    normal.

## Fase 4 — Cierre

- [x] **4.1** `npm run lint` y `npm run build`. Donde suele romper: el tipo inferido del formulario
  con `defaultValues` parciales, y `database.types.ts` sin regenerar (el `select` de 2.2 no
  tipa).
- [x] **4.2** `docs/database.md`:
  - en "Funciones RPC del dashboard", anotar en la tabla que `get_expenses_by_movement_type` y
    `get_daily_expenses_by_movement_type` excluyen los tipos con `exclude_from_expense_charts`;
  - un párrafo corto que diga por qué el filtro está en SQL (restricción 1) y por qué las demás
    agregaciones no lo respetan (tienen que cuadrar con los saldos).
- [x] **4.3** `CLAUDE.md`, sección "Dashboard": una oración que diga que los cards "Gastos por
  tipo" y "Gastos diarios por tipo" excluyen los tipos con `movement_types.exclude_from_expense_charts`
  desde la RPC, y que "Egresos", el flujo mensual, los presupuestos y "Mayores gastos" no lo
  respetan a propósito.
- [x] **4.4** Notas de cierre al final de este documento, con lo que se desvió del plan — *las
  escribe el orquestador al terminar las pruebas, no el implementador.*

## Criterios de prueba

Van en `e2e/movement-types-exclude.spec.ts`, cada test nombrado con su id (`test("P.1 — …")`).

**Datos comunes (`beforeAll` / `afterAll`):**

- Con `qaSupabase()`, buscar un tipo **E** con `exclude_from_expense_charts = true`. Si no hay
  ninguno, lanzar un error que diga "No hay ningún tipo marcado como excluido; el punto 1.2 marca
  Prestado". Buscar también un tipo **N** con `exclude_from_expense_charts = false` que no sea
  `Transferencia` (`e7f1b48a-be01-48a5-9982-5a4d4025493c`).
- Crear una cuenta propia `e2e-movement-types-exclude-<timestamp>` y, con fecha de hoy en
  `America/Asuncion`, dos movimientos `debit`: uno de E por Gs. 900.000 y otro de N por Gs. 100.000.
- En `afterAll`, borrar la cuenta; sus movimientos se borran en cascada.
- ⚠️ No crear ni editar tipos: el usuario de QA no tiene permiso (restricción 3).

Criterios:

- **P.1** (1.1, 2.3) — En `/protected?accountId=<cuenta>`, el card "Gastos por tipo" muestra el
  nombre de N en el eje y **no** muestra el de E.
- **P.2** (1.1, 2.3) — En `/protected?accountId=<cuenta>&dailyRange=7d`, la leyenda del card
  "Gastos diarios por tipo" muestra N y **no** muestra E. El total dibujado sobre la barra de hoy
  es "100 mil" (solo N), no el de los dos gastos sumados.
- **P.3** (decisión "Egresos no respeta el campo") — En la misma URL que P.1, el card "Egresos" de
  `MovementsTotals` muestra `Gs. 1.000.000`, con los dos gastos sumados. En
  `/protected/movements?accountId=<cuenta>`, el movimiento de E aparece en el listado.
- **P.4** (1.1) — Borde: con una segunda cuenta propia del test cuyo único gasto es uno de E por
  Gs. 50.000 hoy, `/protected?accountId=<esa cuenta>&dailyRange=7d` muestra "No hay gastos
  registrados en este período." en **los dos** cards.
- **P.5** (2.1, 2.2, 3.2, 3.3) — En `/protected/movement-types`, la fila de E muestra el badge
  "Excluido de gráficos" y la de N no. Verificar en escritorio y en viewport mobile (el badge
  también va en el `RecordCard`). En `/protected/movement-types/edit/<E.id>`, el checkbox
  "Excluir de los gráficos de gastos" aparece marcado; en `/protected/movement-types/edit/<N.id>`,
  desmarcado. **Solo lectura: no enviar el formulario.**
- **P.6** (3.1) — `/protected/movement-types/create` muestra el checkbox "Excluir de los gráficos
  de gastos" desmarcado, con su texto de ayuda. **No enviar el formulario.**
- **P.7** (3.4) — *Solo si se implementó 3.4.* En la URL de P.1, la descripción de "Gastos por
  tipo" contiene "No incluye:" y el nombre de E. La de "Gastos diarios por tipo", también.

**No cubierto por e2e:**

- **Guardar el campo desde alta y edición (3.1, 3.2)** — el usuario de QA no puede escribir
  `movement_types`. Lo verifica el dueño a mano:
  - crear un tipo con el checkbox marcado y ver el badge en el listado;
  - editar un tipo existente, marcarlo y ver que desaparece de los dos gráficos;
  - desmarcarlo y ver que vuelve;
  - crear un tipo **sin tocar** el checkbox y confirmar que se guarda (el caso de la restricción 4).
- **Que las RPC redefinidas sigan siendo `security invoker` (1.1)** — correr la verificación de
  `docs/database.md` ("Cómo verificar", `prosecdef = false`) sobre las dos funciones. P.1 y P.2
  no lo detectan: los datos del test son del propio usuario de QA.

## Fuera de alcance

- **Excluir los tipos marcados de "Mayores gastos" (`TopExpensesCard`)** — se propuso y el usuario
  eligió no hacerlo. Pedía un parámetro nuevo en `getMovements`. **No agregarlo.**
- **Interruptor "Incluir excluidos" en los cards** — se propuso y el usuario eligió el filtro fijo.
  Pedía un parámetro en cada RPC y un parámetro de URL por card. **No agregarlo.**
- **Excluir los tipos marcados de "Egresos" (`get_movements_totals`), del flujo mensual
  (`get_monthly_flow`) o de los presupuestos (`get_budget_status`, `get_budget_history`)** — esas
  vistas tienen que cuadrar con los saldos. Ver *Decisiones tomadas*.
- **Campo por usuario (tabla de preferencias o `user_id` en `movement_types`)** — `movement_types`
  es global (restricción 2), y `user_id` ya se descartó en el plan de transferencias.
- **Distinción ingreso/egreso (`kind`) en `movement_types`** — es otro problema, ya anotado como
  fuera de alcance en `docs/plans/transfers-implementation.md`.
- **Seguimiento de préstamos por cobrar** (vincular un "Prestado" con su devolución) — es otra
  feature. Este plan solo saca el ruido de los gráficos.
- **Cambiar `updateMovementTypeClient` para que mande `parsed.data`** — funciona igual con el campo
  nuevo (restricción 5). Tocarlo es un refactor ajeno a este plan.
- **Refactorizar los formularios de tipos** (pasar todos los campos a `defaultValues`, usar
  `revalidateMyDataAndRedirect` en el alta en vez de `router.back()`) — no entra; solo se agrega el
  checkbox.

El usuario revisó los puntos propuestos y no eliminó ninguno. Las dos alternativas descartadas son
las decisiones que tomó.

## Riesgos conocidos

1. **Redefinir las dos RPC toca cards que hoy funcionan.** Si se pierde `security invoker` o el
   `search_path`, las funciones devuelven datos de todos los usuarios (restricción 7). Si cambia la
   firma, queda una función duplicada y `supabase.rpc` puede llamar a la vieja. Mitigación: el
   `--dry-run` de 1.3, el diff de `db:pull` contra los archivos actuales (solo debería aparecer
   la línea nueva del `where`) y los tests existentes de `e2e/dashboard.spec.ts`, que tienen que
   seguir pasando.
2. **"Gastos por tipo" deja de sumar lo mismo que "Egresos".** Es a propósito, pero sin la nota del
   3.4 no hay nada en pantalla que lo explique.
3. **El campo es global.** Si algún día hay más de un usuario real, marcar `Prestado` lo excluye
   para todos.
4. **P.1 a P.5 dependen de datos del dueño:** que exista al menos un tipo marcado. Si el dueño
   desmarca todos, los tests fallan en `beforeAll` con un mensaje claro, no con un falso negativo.

## Registro de ejecución

**Inicio:** 2026-09-29 — orquestado con la skill `ejecutar-plan`.

### Ronda 1 — implementador (fase 1 hasta el dry-run)

- Hechos: 1.1, 1.2. Migración `supabase/migrations/20260930021123_add_movement_types_exclude_from_expense_charts.sql`.
- 1.3 detenido en `supabase db push --linked --dry-run` (a pedido del orquestador): solo figura esa migración.
- Verificado por el orquestador: el cuerpo de las dos RPC difiere de `supabase/schemas/public/functions/*.sql`
  solo en la línea `and not mt.exclude_from_expense_charts`; sin `security definer`, con `search_path ''` y los GRANT.
- Desvíos: ninguno.

- **Usuario (1.3):** confirmó aplicar la migración — "Sí, aplicar".

### Ronda 2 — implementador (1.3 a 4.3)

- Hechos: 1.3 (`db:push` aplicado, `db:pull` y `db:types` OK), 2.1–2.3, 3.1–3.3, 3.4 (3.4.1–3.4.3), 4.1–4.3.
- Diff de `db:pull`: en las funciones solo aparece la línea nueva del `where`; en `movement_types.sql`, la columna, su
  `COMMENT` y el realineado de columnas.
- Elecciones dentro del plan: en 3.2, `defaultValue` en el `Controller`; en 3.4.3, `fullDescription = description + excludedNote`
  para las dos ramas.
- Desvíos: ninguno. `lint` y `build` OK.

### Ronda 3 — tester

- P.1–P.7 pasan. Sin incidencias.
- `e2e/movement-types-exclude.spec.ts` (nuevo, 7 tests). Suite completa: 16 pasan, 0 fallan (`dashboard.spec.ts` sigue pasando).
- Entorno: la primera corrida de `setup` dio timeout en el login con el dev server compilando en frío; pasó al re-ejecutar.

## Notas de cierre

**Cerrado:** 2026-09-29.

- **Desvíos del plan:** ninguno. Elecciones que el plan dejaba abiertas: en 3.2, `defaultValue` en el `Controller` (no
  `defaultValues` en `useForm`); en 3.4.3, la nota se arma una vez (`fullDescription`) y la usan las dos ramas.
- **Sin hacer:** nada. 3.4 (opcional) se implementó.
- **Base:** migración `20260930021123_add_movement_types_exclude_from_expense_charts.sql` aplicada a producción tras la
  confirmación del usuario sobre el `--dry-run`. `Prestado` quedó marcado. El diff de `db:pull` solo trajo la línea nueva del
  `where` en las dos RPC y la columna nueva en `movement_types.sql`.
- **Incidencias:** ninguna.
- **Tests:** `e2e/movement-types-exclude.spec.ts` cubre P.1–P.7 y crea/borra sus propias cuentas. Correr con `npm run test:e2e`.
- **No se pudo verificar (queda para el dueño, a mano):**
  - guardar el campo desde el alta y la edición: crear un tipo marcado, marcar/desmarcar uno existente y ver que sale/vuelve
    de los dos gráficos, y **crear un tipo sin tocar el checkbox** (restricción 4). El usuario de QA no puede escribir
    `movement_types`;
  - que `get_expenses_by_movement_type` y `get_daily_expenses_by_movement_type` sigan con `prosecdef = false` (consulta de
    "Cómo verificar" en `docs/database.md`). Los tests no lo detectan porque sus datos son del propio usuario de QA. La
    migración no declara `security definer` (revisado en el archivo), pero no se consultó el catálogo.
