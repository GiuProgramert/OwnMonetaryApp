# Plan: transferencias entre cuentas propias

**Fecha:** 2026-09-26
**Estado:** implementado en código — falta verificación manual (6.2–6.4)

## Objetivo

Poder registrar un traspaso de plata entre dos cuentas propias como **una sola operación**, que mueve
los dos saldos en espejo y **no aparece como ingreso ni como egreso** en ningún total, gráfico ni
presupuesto. Hoy eso se carga como dos movimientos sueltos que inflan simultáneamente los ingresos y
los egresos del período, ensucian el gráfico de gastos por tipo y consumen tope de presupuesto por
plata que nunca se gastó.

De paso, este plan cierra el agujero de escritura de `movement_types`: hoy cualquier usuario
autenticado puede crear, editar y borrar tipos de movimiento de todos. La lectura queda como está
(abierta); solo el dueño de la app puede escribir.

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

- **`update_account_balance`** (`supabase/schemas/public/functions/update_account_balance.sql`) —
  trigger `AFTER INSERT OR UPDATE OR DELETE` fila por fila sobre `movements`. En el caso `UPDATE`
  revierte el movimiento viejo sobre `OLD.account_id` y aplica el nuevo sobre `NEW.account_id`.
  **No se toca:** dos filas apareadas cuadran solas, y mover una fila de cuenta también.
- **Las políticas de `accounts` y `budgets`** (`supabase/schemas/public/tables/*.sql`) — el estilo a
  copiar en la Fase 1: una política por operación (`INSERT` / `UPDATE` / `DELETE`), `to authenticated`,
  y siempre `(select auth.uid())`, nunca `auth.uid()` pelado.
- **`AccountSelect`** (`components/account-select.tsx`) — se extiende con una prop, no se duplica.
- **`AmountInput`** (`components/movements/amount-input.tsx`), **`FormContainer`**,
  **`RecordCard`**, **`revalidateMyDataAndRedirect`** — el form de transferencias sigue el mismo
  patrón `FormProvider` + `zodResolver` + `revalidateMyDataAndRedirect` que
  `components/movements/create-form.tsx`.
- **`lib/constants.ts`** — ya aloja constantes compartidas (`hexColorRegex`,
  `notFoundDetailMessage`); ahí va el id del tipo `Transferencia` (punto 3.3).
- **`docs/supabase.md`** — el ciclo `migration new` → editar a mano → `db:push` → `db:pull` →
  `db:types` es el único camino para cambiar el esquema en esta máquina.

### Restricciones que condicionan el diseño

1. **`MOVEMENT_COLUMNS` usa `movement_types!inner(name,color)`** (`lib/services/movements.ts`). Es
   un *inner join*. Un movimiento cuyo `movement_type_id` sea `NULL` — o cuyo tipo la RLS le oculte
   al usuario — **desaparece de la lista sin error**. Esto es lo que descarta hacer
   `movement_type_id` nullable para las transferencias (ver *Decisiones tomadas*), y la razón por la
   que la Fase 1 **no toca la política de lectura**.
2. **Son cinco las funciones que agregan sobre `movements`**, no tres:
   `get_movements_totals`, `get_expenses_by_movement_type`, `get_monthly_flow` (dashboard) y además
   `get_budget_status` y `get_budget_history`, que suman `m.type = 'debit'` por tipo y mes. Las cinco
   tienen que excluir transferencias; olvidarse de una deja una inconsistencia silenciosa entre
   pantallas que nada rompe y nadie ve.
3. **`movements` no tiene `user_id`.** La RLS resuelve la pertenencia por `accounts`, y cada política
   evalúa una fila a la vez. **Nada garantiza que las dos cuentas de una transferencia sean del mismo
   usuario** — eso se valida dentro de la RPC.
4. **`movement_types` no tiene dueño y es escribible por cualquier autenticado**
   (`movement_types_write`, `FOR ALL USING (true) WITH CHECK (true)`, en
   `supabase/schemas/public/tables/movement_types.sql`). Es la única tabla del proyecto sin
   restricción de escritura.
5. **No hay Docker en esta máquina.** No existe `supabase db diff`: el SQL de cada migración se
   escribe a mano. Y `npm run db:push` **va directo contra producción, sin staging**.
6. **`movements.amount` tiene `CHECK (amount > 0)` y `type` solo admite `'credit'` / `'debit'`.** Una
   transferencia es, en el modelo, un `debit` en la cuenta origen más un `credit` en la destino.
7. **Las FK de `movement_types` no son simétricas:** `movements.movement_type_id` es
   `ON DELETE RESTRICT`, pero `budgets.movement_type_id` es `ON DELETE CASCADE`. Borrar un tipo en
   uso queda bloqueado por movimientos, pero se lleva puesto el presupuesto asociado.
8. **`movements.external_id` tiene un índice único `(account_id, external_id)` no parcial.** Las
   transferencias cargadas a mano quedan con `external_id` en `NULL` y no chocan (en Postgres los
   `NULL` son distintos entre sí dentro de un índice único).

## Decisiones tomadas

- **Dos filas apareadas por `movements.transfer_id`, no una tabla `transfers` aparte.** Reusa el
  trigger de saldo, la RLS que ya resuelve por `accounts`, la lista de movimientos y la paginación.
  Una tabla aparte obligaría a escribir su propio trigger de saldo y a unir dos orígenes en la lista.
  **Contrapartida:** una transferencia ocupa dos filas en la lista de movimientos cuando el filtro de
  cuenta está en "todas" (ver la decisión sobre visibilidad, más abajo).

- **La categoría de una transferencia es un tipo sembrado con UUID fijo, no `movement_type_id`
  nullable.** Nullable era lo conceptualmente correcto, pero por la restricción 1 obligaba a cambiar
  el `!inner` por left join y a agregar rama de `null` en `components/movements/table.tsx`,
  `TopExpensesCard`, `RecentMovementsCard` y el delete form. **Contrapartida:** aparece una fila más
  en `/protected/movement-types`, que hay que esconder de los selects y marcar como no editable
  (puntos 3.4, 4.9 y 5.6).

- **La escritura de `movement_types` se restringe por UUID literal en la política, sin agregar
  columna `user_id`.** Es una app personal: el dato "quién es el dueño" no necesita estar modelado en
  la tabla, alcanza con que la política lo compare. La alternativa —columna `user_id` + backfill, al
  estilo de `budgets`— resolvía lo mismo pero exigía asignarle dueño a cada fila existente, y por la
  restricción 1 **un backfill incompleto habría hecho desaparecer movimientos de la lista sin
  error**. **Contrapartida:** el UUID queda escrito en el esquema; si el proyecto de Supabase se
  recrea o se restaura y el usuario cambia de id, hay que editar la política a mano.

- **La lectura de `movement_types` queda abierta (`USING (true)`), como está hoy.** Solo se bloquean
  `INSERT` / `UPDATE` / `DELETE`. Cerrarla al UUID del dueño no aportaba nada —los nombres de las
  categorías no son dato sensible y ya son legibles hoy— y en cambio agregaba un modo de fallo: si
  el id del dueño cambiara, el `!inner` join de la restricción 1 le vaciaría la lista de movimientos
  al propio dueño. **Contrapartida:** un usuario nuevo que se registre puede leer los tipos de
  movimiento, aunque no pueda usarlos para nada útil ni crear los suyos.

- **Mismo monto en los dos lados, sin comisión.** En Paraguay las transferencias entre cuentas
  propias no tienen comisión, así que `create_transfer` recibe un solo `p_amount`. **Contrapartida:**
  si alguna vez aparece una comisión, se carga como movimiento normal aparte — y está bien que así
  sea, porque una comisión *es* un gasto real que debe contar en totales y presupuestos, y metida
  dentro de la transferencia quedaría excluida por el punto 2.7.

- **Las transferencias se pueden editar**, vía `update_transfer` (punto 2.5), no solo borrar y
  recrear. **Contrapartida:** una RPC y un form más.

- **Las transferencias se ven siempre en la lista de movimientos**, con badge propio y sin filtro
  para ocultarlas. Si se ocultaran, la lista de una cuenta dejaría de explicar su propio saldo.
  **Contrapartida:** con el filtro de cuenta en "todas", los dos lados de una transferencia se ven
  como dos filas. Se distinguen por el badge direccional del punto 4.6; no se resuelve con un join al
  lado opuesto.

## Dependencias externas

- **El UUID del usuario dueño de la app.** La política de la Fase 1 lo lleva escrito como literal y
  **no hay forma de resolverlo desde el SQL de la migración**: `auth.users` no es legible para el rol
  `authenticated`, así que una subconsulta dentro de la política fallaría en tiempo de evaluación.
  Se saca de Supabase Dashboard → Authentication → Users, o con
  `select id, email from auth.users;` en el SQL editor. **Bloqueante para la Fase 1** — sin ese valor
  no se puede escribir la migración.

## Arquitectura

```
                       create_transfer(from, to, amount, date, description)
                                          │
                       ┌──────────────────┴──────────────────┐
                       ▼                                     ▼
          movements (cuenta origen)              movements (cuenta destino)
          type   = 'debit'                       type   = 'credit'
          amount = p_amount                      amount = p_amount
          movement_type_id = <uuid fijo>         movement_type_id = <uuid fijo>
          transfer_id = <uuid compartido>  ◄───► transfer_id = <uuid compartido>
                       │                                     │
                       └──────────────┬──────────────────────┘
                                      ▼
                        trigger_update_account_balance
                        (una vez por fila, ya existe)
                                      │
                                      ▼
                    accounts.current_balance se mueve en espejo

  Las 5 RPC de agregación filtran  ──►  and m.transfer_id is null
```

Archivos nuevos:

```
supabase/migrations/<ts>_restrict_movement_types_writes.sql
supabase/migrations/<ts>_add_transfers.sql
lib/schemas/transfers.ts
lib/services/transfers.ts
lib/services/transfers.client.ts
components/transfers/transfer-form-fields.tsx
components/transfers/create-form.tsx
components/transfers/edit-form.tsx
components/transfers/delete-form.tsx
app/protected/transfers/create/page.tsx
app/protected/transfers/edit/[id]/page.tsx
app/protected/transfers/delete/[id]/page.tsx
```

La pieza que absorbe la variación es **`create_transfer` / `update_transfer` / `delete_transfer`**:
toda la lógica de apareo, validación de pertenencia y atomicidad vive ahí, y el cliente solo llama
`.rpc()`. Ningún componente inserta filas de `movements` para una transferencia.

## Fase 1 — Base de datos: escritura de `movement_types` y tipo sembrado

Va primero porque el punto 2.3 necesita el tipo `Transferencia` ya sembrado. Requiere el UUID de
*Dependencias externas*.

- [x] **1.1** `npx supabase migration new restrict_movement_types_writes`. SQL a mano
  (restricción 5).

- [x] **1.2** `drop policy "movement_types_write" on public.movement_types;` — es la política
  `FOR ALL USING (true) WITH CHECK (true)` de la restricción 4, el agujero que se está cerrando.

- [x] **1.3** Crear **tres** políticas nuevas, una por operación, al estilo de `accounts` y
  `budgets`, todas `to authenticated` y con `(select auth.uid())`, nunca `auth.uid()` pelado
  (`docs/database.md#3-authuid-se-evalúa-una-vez-por-fila`):
  - `FOR INSERT ... WITH CHECK ((select auth.uid()) = '<uuid del dueño>')`
  - `FOR UPDATE ... USING ((select auth.uid()) = '<uuid del dueño>')`
  - `FOR DELETE ... USING ((select auth.uid()) = '<uuid del dueño>')`

  > Pideme el UUID antes de ejecutar en el chat
  > Tres políticas separadas y no una sola `FOR ALL`: `FOR ALL` también cubre `SELECT`, y entonces la
  > lectura quedaría restringida al dueño — justo lo que la decisión de arriba descarta. Separarlas
  > deja la lectura intacta y hace explícito en el esquema qué operación permite qué.

- [x] **1.4** ⚠️ **No tocar `movement_types_read`.** Sigue siendo `FOR SELECT TO authenticated
  USING (true)` y así tiene que quedar (ver *Decisiones tomadas* y restricción 1). Está escrito como
  punto justamente para que nadie la "complete" por simetría con las otras tres.

- [x] **1.5** Sembrar el tipo con **UUID literal fijo**, que los puntos 2.3 y 3.3 referencian:
  `insert into public.movement_types (id, name, description, color) values
  ('<uuid fijo>', 'Transferencia', 'Traspaso entre cuentas propias', '#6B7280');`
  UUID fijo y no lookup por nombre: el nombre es dato y se puede renombrar, el id es contrato.
  ⚠️ El `insert` va **después** de las políticas del 1.3: la migración corre como `postgres`, que
  bypassea la RLS, pero si en algún momento se re-ejecuta el archivo desde la app el orden importa.

- [x] **1.6** `npx supabase db push --linked --dry-run` → revisar la salida → `npm run db:push`.
  ⚠️ Va directo a producción (restricción 5). `db:pull` y `db:types` se corren una sola vez al final
  de la Fase 2 (punto 2.8), no acá.

## Fase 2 — Base de datos: transferencias

- [x] **2.1** `npx supabase migration new add_transfers`. Archivo separado del de la Fase 1: si el
  primero falla, el segundo no se aplica.

- [x] **2.2** `alter table public.movements add column transfer_id uuid;` +
  `create index idx_movements_transfer on public.movements using btree (transfer_id);`
  Nullable: los movimientos normales lo tienen en `NULL`, y ese `is null` es lo que filtran las
  cinco agregaciones del punto 2.7. El índice lo usan `update_transfer` y `delete_transfer`.

- [x] **2.3** `create_transfer(p_from_account_id uuid, p_to_account_id uuid, p_amount numeric,
  p_date date, p_description text) returns uuid` — `volatile`, **`security invoker`**,
  `set search_path = ''`, como el resto de las funciones del proyecto. Genera un `transfer_id` con
  `gen_random_uuid()`, inserta las dos filas (`debit` en origen, `credit` en destino) con el
  `movement_type_id` del punto 1.5, y devuelve el `transfer_id`.
  ⚠️ **Las dos filas van en la misma función y por lo tanto en la misma transacción.** Dos `insert`
  sueltos desde el cliente pueden fallar a la mitad, y media transferencia es descuadre permanente de
  saldo (ver `docs/database.md#descuadre-de-saldos`).

- [x] **2.4** Dentro de `create_transfer`, antes de insertar, validar con `raise exception`:
  - `p_from_account_id <> p_to_account_id`
  - ambas cuentas existen **y tienen `user_id = (select auth.uid())`** — por la restricción 3 la RLS
    no lo garantiza sola: valida cada fila por separado, no el par
  - `p_amount > 0`

- [x] **2.5** `update_transfer(p_transfer_id uuid, p_from_account_id uuid, p_to_account_id uuid,
  p_amount numeric, p_date date, p_description text)` — actualiza **las dos filas** del par en una
  transacción, repitiendo las validaciones del 2.4. No reasigna `transfer_id`.
  ⚠️ Si cambian las cuentas, el trigger ya revierte sobre `OLD.account_id` y aplica sobre
  `NEW.account_id` (ver Contexto): **no hay que compensar saldos a mano**.

- [x] **2.6** `delete_transfer(p_transfer_id uuid)` — borra las dos filas juntas. Sin esta función,
  borrar un solo lado deja la mitad huérfana inflando el saldo de una cuenta para siempre.

- [x] **2.7** ⚠️ **Agregar `and m.transfer_id is null` a las cinco funciones** de la restricción 2:
  `get_movements_totals`, `get_expenses_by_movement_type`, `get_monthly_flow`, `get_budget_status`
  y `get_budget_history`. **Este es el punto que resuelve el problema original del plan**; los demás
  son el andamiaje. Las cinco se redefinen con `create or replace function` manteniendo firma,
  `security invoker` y `set search_path = ''`.

- [x] **2.8** `npx supabase db push --linked --dry-run` → `npm run db:push` → `npm run db:pull` →
  `npm run db:types` → commit. ⚠️ El `>` de `db:types` trunca el archivo antes de correr: si falla
  (token vencido, red caída), `lib/supabase/database.types.ts` queda vacío y el build se rompe.
  Re-correr el comando, no editarlo a mano.

## Fase 3 — Schemas y servicios

- [x] **3.1** `lib/schemas/transfers.ts` — `transferSchema` (`from_account_id`, `to_account_id`,
  `amount`, `date`, `description`) y el tipo `Transfer`. Incluir
  `.refine((v) => v.from_account_id !== v.to_account_id, { path: ["to_account_id"], message: "La
  cuenta de destino debe ser distinta a la de origen" })`, para que el error salga en el form y no
  como un `raise` crudo de Postgres.

- [x] **3.2** `lib/schemas/movements.ts` — agregar `transfer_id: string | null` al tipo `Movement` y
  **borrar el `TODO` de la línea 42** (`// TODO: transferencias entre cuentas ...`), que es
  exactamente lo que este plan implementa.

- [x] **3.3** `lib/constants.ts` — exportar `transferMovementTypeId` con el UUID fijo del punto 1.5.
  Es el único lugar donde vive ese valor del lado de la app; los puntos 3.4, 4.9 y 5.6 lo importan de
  acá.

- [x] **3.4** `lib/services/movement-types.ts` — `getMovementTypes()` acepta
  `{ includeTransferType = false }` y filtra `.neq("id", transferMovementTypeId)` por defecto, para
  que `Transferencia` **no aparezca** en el select del form de movimientos ni en el de presupuestos.
  La tabla de `/protected/movement-types` lo llama con `includeTransferType: true`.
  ⚠️ El default es "no incluir": si mañana se agrega otro consumidor, lo seguro es lo que pasa solo.

- [x] **3.5** `lib/services/transfers.client.ts` — `createTransfer`, `updateTransfer`,
  `deleteTransfer` vía `supabase.rpc()`, con `safeParse` previo como el resto de los `.client.ts`.

- [x] **3.6** `lib/services/transfers.ts` (server-only) — `getTransferById(transferId)`: trae las dos
  filas del par (`.eq("transfer_id", id)`) y las reduce a un objeto `Transfer` con origen y destino
  resueltos por el `type` de cada fila. Devuelve `null` si no hay filas, para el `notFound()` de las
  páginas.

- [x] **3.7** `lib/services/movements.ts` — agregar `transfer_id` a `MOVEMENT_COLUMNS`. Sin esto los
  puntos 4.6, 4.7 y 4.8 no tienen el dato para decidir.

## Fase 4 — Componentes

- [x] **4.1** `components/account-select.tsx` — prop opcional `excludeId?: string`, que saca esa
  cuenta de la lista. Se extiende el componente compartido, no se duplica: lo usan también los
  filtros de movimientos y del dashboard.

- [x] **4.2** `components/transfers/transfer-form-fields.tsx` — fecha (`Input type="date"`),
  descripción, `AmountInput`, y **dos `AccountSelect`**: origen, y destino con
  `excludeId={watch("from_account_id")}`. Mismo layout `grid gap-4 sm:grid-cols-2` que
  `components/movements/movement-form-fields.tsx`.

- [x] **4.3** `components/transfers/create-form.tsx` — patrón de
  `components/movements/create-form.tsx`: `FormProvider` + `zodResolver(transferSchema)` + `toast` en
  el catch + `revalidateMyDataAndRedirect("/protected/movements")`.

- [x] **4.4** `components/transfers/edit-form.tsx` — igual, con `initialValues: Transfer` y
  `updateTransfer`.

- [x] **4.5** `components/transfers/delete-form.tsx` — patrón de
  `components/movements/delete-form.tsx`, mostrando origen → destino y monto en el resumen, y
  llamando `deleteTransfer(transfer_id)`.

- [x] **4.6** `components/movements/table.tsx` — cuando `movement.transfer_id` no es `null`, la
  columna "Naturaleza" muestra un `<Badge variant="secondary">` con `ArrowUpRight` + "Transferencia"
  si `type === "debit"` (sale de esta cuenta) o `ArrowDownLeft` + "Transferencia" si
  `type === "credit"` (entra). ⚠️ **Aplicarlo en la tabla desktop y en el `RecordCard` de mobile** —
  son dos bloques distintos en el mismo archivo y es fácil tocar solo uno.

  > El badge direccional es lo que evita que los dos lados de una transferencia parezcan un
  > movimiento duplicado cuando el filtro de cuenta está en "todas". No se hace un join a la fila
  > opuesta para mostrar la cuenta contraparte: PostgREST no expresa bien un self-join por
  > `transfer_id`, y la columna "Cuenta" de cada fila ya dice de qué lado está.

- [x] **4.7** ⚠️ `components/movements/table.tsx`, `MovementActions` — recibe el `transfer_id` y, si
  no es `null`, apunta a `/protected/transfers/edit/<transfer_id>` y
  `/protected/transfers/delete/<transfer_id>`. Sin esto se edita **medio par** desde el form normal
  de movimientos y el saldo queda descuadrado.

- [x] **4.8** `components/dashboard/top-expenses-card.tsx` — filtrar `!movement.transfer_id` antes
  del `.slice(TOP_COUNT)`. Este card no usa RPC: llama `getMovements(filter, { type: "debit" })`, así
  que el punto 2.7 **no lo cubre** y el lado de salida de una transferencia aparecería como "mayor
  gasto". ⚠️ Efecto aceptado: como el filtro corre sobre la página de 25 filas que ya trajo el
  servicio, un período con muchas transferencias grandes puede mostrar menos de 5 gastos.

- [x] **4.9** `components/movement-types/table.tsx` — no renderizar `MovementTypeActions` en la fila
  cuyo `id` es `transferMovementTypeId`. La RLS ya rechaza la escritura para cualquier otro usuario
  (punto 1.3), pero el dueño **sí** puede borrarla: esto evita hacerlo sin querer antes de que exista
  la primera transferencia, que es cuando el `ON DELETE RESTRICT` de la restricción 7 todavía no
  protege nada.

## Fase 5 — Páginas y rutas

- [x] **5.1** `app/protected/transfers/create/page.tsx` — wrapper fino con `FormContainer`, que trae
  las cuentas con `getAccounts()`.

- [x] **5.2** `app/protected/transfers/edit/[id]/page.tsx` — `getTransferById(id)` server-side y
  `notFound()` si devuelve `null`, como las páginas de edición de las otras entidades. El `[id]` de
  la ruta es el **`transfer_id`**, no el `id` de ninguna de las dos filas de `movements`.

- [x] **5.3** `app/protected/transfers/delete/[id]/page.tsx` — ídem con `DeleteTransferForm`.

- [x] **5.4** `app/protected/movements/page.tsx` — botón "Transferir" (`variant="outline"`, ícono
  `ArrowLeftRight`) junto a "Nuevo" e "Importar".

- [x] **5.5** ⚠️ `app/protected/movements/edit/[id]/page.tsx` y `delete/[id]/page.tsx` — si el
  movimiento tiene `transfer_id`, `redirect()` a la ruta de transferencias equivalente. El punto 4.7
  solo arregla los links de la tabla; esto cubre URLs guardadas, pegadas a mano o de antes del
  cambio.

- [x] **5.6** `app/protected/movement-types/edit/[id]/page.tsx` y `delete/[id]/page.tsx` — si el
  `id` es `transferMovementTypeId`, `notFound()`. Contraparte por URL del punto 4.9.

- [x] **5.7** **No** agregar item al sidebar (`lib/nav-items.ts`): las transferencias no tienen
  listado propio, viven dentro de movimientos. Queda escrito para que no se agregue "para completar
  la feature".

## Fase 6 — Cierre

- [x] **6.1** `npm run lint` y `npm run build`. Donde suele romper esto: el tipo `Movement` gana un
  campo (3.2), así que cualquier objeto literal construido a mano contra ese tipo deja de compilar. Y
  `npm run db:types` (2.8) tiene que haber corrido bien, o las firmas de las RPC nuevas no existen
  para `.rpc()`.

- [ ] **6.2** Probar los bordes, logueado en la app:
  - crear una transferencia y verificar que **los dos saldos se mueven en espejo** por el monto exacto
  - que ingresos, egresos y balance neto del período **no se movieron** (`MovementsTotals`)
  - que el gráfico de gastos por tipo y el de flujo mensual **no la incluyen**
  - que ningún presupuesto consumió tope por la transferencia
  - editar la transferencia cambiando el monto, y después cambiando las cuentas: los cuatro saldos
    involucrados tienen que quedar correctos
  - borrarla y verificar que los dos saldos vuelven al valor previo
  - intentar origen = destino (error en el form, no un `raise` crudo)
  - entrar a mano a `/protected/movements/edit/<id de un lado>` y confirmar el redirect (5.5)
  - entrar a mano a `/protected/movement-types/edit/<uuid fijo>` y confirmar el 404 (5.6)
  - confirmar que "Transferencia" **no** aparece en el select del form de movimientos ni en el de
    presupuestos, y **sí** en `/protected/movement-types` sin botones de acción

- [ ] **6.3** ⚠️ Verificar la RLS de la Fase 1 **con un segundo usuario**, no desde el SQL editor:
  registrar una cuenta de prueba y confirmar que (a) **ve** los tipos de movimiento y (b) le falla
  crear, editar y borrar uno. El SQL editor corre como `postgres` y bypassea la RLS, así que ahí las
  políticas nuevas se verían iguales estén bien o mal
  (`docs/database.md#cómo-verificar`). *(opcional si no querés crear un usuario de prueba en
  producción; si se saltea, dejarlo anotado en las Notas de cierre como no verificado.)*

- [ ] **6.4** Verificar en mobile y dark mode: el badge nuevo en el `RecordCard` (4.6) y el form con
  dos selects de cuenta apilados (4.2).

- [x] **6.5** `docs/database.md`: `transfer_id` en *Índices y restricciones*; las tres RPC nuevas en
  la tabla de funciones; una sección corta explicando **por qué las cinco agregaciones excluyen
  `transfer_id is not null`**; y en *Row Level Security* el modelo nuevo de `movement_types`
  (lectura abierta, escritura por UUID literal) con **el porqué de que la lectura siga abierta**.

- [x] **6.6** `CLAUDE.md`: sección de transferencias en el patrón de módulos, y **las dos reglas que
  este plan impone: toda agregación nueva sobre `movements` tiene que excluir
  `transfer_id is not null`, y `movement_types` ya no es escribible por cualquier autenticado**.

- [x] **6.7** Notas de cierre al final de este documento.

## Fuera de alcance

- **Parámetro `includeTransfers` en `getMovements` y checkbox "Incluir transferencias" en los
  filtros** — estaban propuestos y **el usuario los podó**. Con la decisión de que las transferencias
  se ven siempre, el parámetro no tiene consumidor: la exclusión de `TopExpensesCard` se resuelve
  filtrando por `transfer_id` en el card (4.8). **No re-agregarlos.**

- **Columna `user_id` en `movement_types`** — se propuso (al estilo de `budgets`, con backfill) y se
  descartó a favor del UUID literal en la política. Ver *Decisiones tomadas*. **No agregarla para
  "hacerlo bien":** el backfill es justamente el paso riesgoso que se evitó.

- **Columna `is_system` en `movement_types`** — se propuso para marcar el tipo `Transferencia` y se
  descartó: el UUID fijo del punto 1.5 ya lo identifica, y una constante en `lib/constants.ts`
  (3.3) hace el mismo trabajo sin migración.

- **Comisión bancaria en la transferencia** — descartado: en Paraguay las transferencias entre
  cuentas propias no la tienen. Si alguna vez aparece, va como movimiento normal aparte, no como
  campo de la transferencia.

- **Detectar transferencias en la importación de extractos** — un extracto de una cuenta solo tiene
  un lado del par; aparearlo con el de otro banco es un problema distinto. Las transferencias se
  cargan a mano en este plan.

- **Transferencias entre monedas distintas** — `amount` es entero en guaraníes en todo el stack. No
  entra acá.

- **Transferencias recurrentes / programadas** — es la feature de movimientos recurrentes, que es
  otro plan.

- **`kind` (ingreso/egreso) en `movement_types`** — se conversó como problema aparte del mismo
  módulo. Este plan solo le cierra la escritura; **no** toca la distinción ingreso/egreso. Si se
  hace, es otro plan y otra migración.

## Riesgos conocidos

1. **`db:push` va directo a producción y no hay rollback automático** (restricción 5). El
   `--dry-run` de los puntos 1.6 y 2.8 es obligatorio, no una formalidad.

2. **Las cinco agregaciones del 2.7 afectan pantallas que hoy funcionan.** Si una se redefine mal
   (por ejemplo, perdiendo `security invoker` o el `set search_path = ''`), la función pasa a correr
   con permisos del dueño y **devuelve datos de todos los usuarios**. ⚠️ Probarlas desde el SQL editor
   de Supabase **no** detecta esto: ese editor corre como `postgres` y bypassea la RLS. La
   verificación real es logueado como usuario normal desde la app.

3. **El UUID del dueño queda escrito en el esquema** (punto 1.3). Si el proyecto de Supabase se
   recrea, se restaura desde un backup o el usuario se registra de nuevo, su id cambia y **pierde la
   escritura sobre `movement_types` en silencio**: la app va a tirar error al crear o editar un tipo,
   sin explicar por qué. Queda documentado en 6.5 para que el síntoma sea diagnosticable.

4. **Un par de transferencia puede quedar desapareado si alguien borra una fila de `movements` por
   fuera de `delete_transfer`** — por ejemplo desde el SQL editor, o por el `ON DELETE CASCADE` de
   `movements.account_id` al borrar una cuenta. ⚠️ **Borrar una cuenta que participó en
   transferencias deja huérfano el otro lado**, que queda contando como transferencia sin par. No lo
   cubre ningún punto de este plan; la query de diagnóstico sería
   `select transfer_id from public.movements where transfer_id is not null group by transfer_id
   having count(*) <> 2;`.

5. **El UUID fijo del punto 1.5 es un contrato entre la migración, `create_transfer` y
   `lib/constants.ts`.** Si esa fila se borra por SQL directo, `create_transfer` falla por FK. La
   `ON DELETE RESTRICT` de `movements.movement_type_id` la protege apenas exista la primera
   transferencia, pero no antes — de ahí el punto 4.9.

## Notas de cierre

**Desvíos del plan**
- El UUID fijo del tipo `Transferencia` (`e7f1b48a-be01-48a5-9982-5a4d4025493c`) lo generé al implementar; el del dueño lo dio el usuario.
- `create_transfer`/`update_transfer`/`delete_transfer` llevan además `grant execute ... to authenticated, service_role` (no estaba en el plan).
- `update_transfer` y `delete_transfer` lanzan `Transferencia no encontrada` si no afectan filas, para no fallar en silencio cuando la RLS oculta el par.
- `Transfer` (schema) incluye `transfer_id`, `from_account_name` y `to_account_name` además de los campos del form, para el resumen del delete form.
- El commit del punto 2.8 no se hizo: no fue pedido.

**Sin hacer**
- 6.2, 6.3 y 6.4 quedan en `[ ]`: requieren usar la app logueado (y, para 6.3, un segundo usuario).

**Verificado**
- Migraciones aplicadas en producción (`db:push`), `db:pull` y `db:types` corridos; `transfer_id` y las tres RPC aparecen en `lib/supabase/database.types.ts`.
- `npm run build` pasa. ESLint limpio sobre los archivos tocados.

**No se pudo verificar**
- Comportamiento real de las RPC y de los saldos en espejo (nunca se ejecutó una transferencia).
- Que las cinco agregaciones redefinidas sigan respetando la RLS (riesgo 2): solo se comprueba logueado desde la app.
- La RLS nueva de `movement_types` con un segundo usuario.
- `npm run lint` global: barre `.next/` y no termina de forma útil; se lintearon solo los archivos tocados.
- Mobile y dark mode.
