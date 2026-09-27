# Base de datos (Supabase)

**El esquema (tablas, índices, triggers, funciones y RLS) vive en `supabase/schemas/**`, versionado
en el repo.** Este documento no lo duplica: explica el *por qué* — reglas para la aplicación, efectos
secundarios no obvios, queries de diagnóstico — que el SQL exportado no dice por sí solo. Para ver
el esquema tal como está en Supabase hoy, leé `supabase/schemas/public/**`; para el historial de
cambios, `supabase/migrations/`. Ver también [`docs/supabase.md`](supabase.md) para el flujo de
trabajo (cómo cambiar el esquema, generar tipos, qué comandos no corren en esta máquina).

Tres temas, y conviene leerlos antes de tocar `movements`: los [triggers](#reglas-para-la-aplicación)
(que gobiernan el saldo), los [índices y restricciones](#índices-y-restricciones) (que sostienen
la deduplicación de importaciones) y la [RLS](#row-level-security-rls) (que es la única barrera de
seguridad de la base).

## Reglas para la aplicación

Estas tres reglas se desprenden directamente de los triggers (`supabase/schemas/public/tables/*.sql`
para dónde están enganchados, `supabase/schemas/public/functions/*.sql` para sus cuerpos) y son
obligatorias:

1. **Nunca escribir `updated_at` desde la app.** Lo setea `update_updated_at` en cada `UPDATE`.
2. **Nunca escribir `current_balance` desde la app.** Es un valor derivado: se modifica
   insertando, editando o borrando filas en `movements`. Escribirlo a mano introduce
   descuadre permanente (ver [Descuadre de saldos](#descuadre-de-saldos)).
3. **`movements.type` debe ser siempre exactamente `'credit'` o `'debit'`.** Cualquier otro
   valor corrompe el saldo en silencio (ver [Efectos secundarios](#efectos-secundarios), punto 1).

`update_account_balance` cubre `INSERT`, `UPDATE` y `DELETE`. En el caso `UPDATE` revierte el
movimiento anterior sobre `OLD.account_id` y aplica el nuevo sobre `NEW.account_id`, así que
**mover un movimiento de una cuenta a otra cuadra correctamente**.

## Efectos secundarios

Comportamientos no obvios que hay que tener presentes al tocar el código:

### 1. El `CASE` no tiene `ELSE`

Si un movimiento entra con `type` distinto de `'credit'` o `'debit'`, el `CASE` devuelve
`NULL`, y `current_balance + NULL = NULL`: **el saldo de la cuenta se pierde en silencio,
sin lanzar error**.

Por eso la validación del enum en `lib/schemas/movements.ts` no es cosmética: es la barrera
que protege el saldo. Conviene además que la columna tenga un `CHECK` o un tipo enum en
Postgres, para que la garantía no dependa solo del cliente.

### 2. `accounts.updated_at` no significa "última edición de la cuenta"

`update_account_balance` hace `UPDATE accounts`, lo que a su vez dispara
`trigger_accounts_updated_at`. Es decir: **cada movimiento nuevo bumpea el `updated_at` de
su cuenta**, aunque nadie haya editado la cuenta.

La columna "Actualizado" de `components/accounts/table.tsx` va a cambiar sola al cargar
movimientos. No es un bug, pero es engañoso si no se sabe.

### 3. El saldo es incremental, no calculado

`current_balance` nunca se recomputa desde cero: cada operación lo ajusta por delta. Si
alguna vez se escribe a mano, o se insertan movimientos por fuera del trigger (SQL directo
con el trigger deshabilitado), la diferencia **queda para siempre**.

## Descuadre de saldos

### Diagnóstico

Compara el saldo almacenado contra el saldo recalculado desde los movimientos. Devuelve
solo las cuentas que no cuadran:

```sql
select
  a.id,
  a.name,
  a.current_balance,
  coalesce(sum(
    case
      when m.type = 'credit' then m.amount
      when m.type = 'debit'  then -m.amount
    end
  ), 0) as calculated_balance,
  a.current_balance - coalesce(sum(
    case
      when m.type = 'credit' then m.amount
      when m.type = 'debit'  then -m.amount
    end
  ), 0) as drift
from accounts a
left join movements m on m.account_id = a.id
group by a.id, a.name, a.current_balance
having a.current_balance is distinct from coalesce(sum(
  case
    when m.type = 'credit' then m.amount
    when m.type = 'debit'  then -m.amount
  end
), 0);
```

### Reparación

Reescribe `current_balance` con el valor recalculado, solo en las cuentas descuadradas.
El `left join` incluye las cuentas sin movimientos (quedan en `0`) y el
`is distinct from` cubre el caso de `current_balance` en `NULL`:

```sql
update accounts a
set current_balance = sub.total
from (
  select
    a2.id as account_id,
    coalesce(sum(
      case
        when m.type = 'credit' then m.amount
        when m.type = 'debit'  then -m.amount
      end
    ), 0) as total
  from accounts a2
  left join movements m on m.account_id = a2.id
  group by a2.id
) sub
where sub.account_id = a.id
  and a.current_balance is distinct from sub.total;
```

> Ojo: esta reparación dispara `trigger_accounts_updated_at`, así que va a modificar el
> `updated_at` de las cuentas corregidas.

## Funciones RPC del dashboard

Tres funciones agregan sobre `movements` (las cinco, contando presupuestos, excluyen transferencias: ver [Transferencias](#transferencias-entre-cuentas)) para el dashboard (`app/protected/page.tsx`), evitando el
límite de 1000 filas de PostgREST (`db.max_rows`): sumar en JS sobre filas crudas subcuenta en
silencio al pasar ese umbral. Las tres son `security invoker` (nunca `security definer`: correrían
con los permisos del dueño de la función y devolverían movimientos de todos los usuarios) y
`set search_path = ''`, así que la RLS del usuario que llama sigue aplicando dentro de la función.
Los cuerpos están en `supabase/schemas/public/functions/`.

| Función | Devuelve | Uso |
| --- | --- | --- |
| `get_expenses_by_movement_type(p_account_id, p_start_date, p_end_date)` | `(movement_type_id, name, color, total)` por tipo, solo `debit` | `lib/services/dashboard.ts` → `getExpensesByMovementType` |
| `get_movements_totals(p_account_id, p_movement_type_id, p_start_date, p_end_date)` | `(income, expense)` | `lib/services/movements.ts` → `getMovementsTotals` (consumida también por `components/movements/totals.tsx`) |
| `get_monthly_flow(p_account_id, p_start_date, p_end_date)` | `(month, income, expense)`, un mes por fila **solo si tiene movimientos** | `lib/services/dashboard.ts` → `getMonthlyFlow`, que rellena los meses vacíos del rango antes de pasarlo al gráfico |

Los tres parámetros de cada función son `nullable`: `null` significa "sin filtrar".

⚠️ **Probarlas desde el SQL editor de Supabase no valida la seguridad.** El SQL editor corre como
`postgres` y bypassea la RLS — una función que devolviera datos de otros usuarios se vería igual de
correcta ahí. La verificación real es logueado como usuario normal desde la app.

### Transferencias entre cuentas

Una transferencia son **dos filas de `movements`** apareadas por `transfer_id`: un `debit` en la
cuenta origen y un `credit` en la destino, ambas con el tipo fijo `Transferencia`
(`transferMovementTypeId` en `lib/constants.ts`). El trigger de saldo mueve los dos saldos solo. Se
escriben únicamente por RPC, que son `security invoker`, `set search_path = ''` y corren en una
transacción (media transferencia sería descuadre permanente):

| Función | Qué hace |
| --- | --- |
| `create_transfer(p_from_account_id, p_to_account_id, p_amount, p_date, p_description)` | Valida (cuentas distintas, ambas del usuario, monto > 0), inserta el par y devuelve el `transfer_id` |
| `update_transfer(p_transfer_id, p_from_account_id, p_to_account_id, p_amount, p_date, p_description)` | Actualiza las dos filas; el trigger revierte/aplica saldos por `OLD`/`NEW.account_id` |
| `delete_transfer(p_transfer_id)` | Borra las dos filas juntas |

**Por qué las cinco agregaciones excluyen `transfer_id is not null`:** `get_movements_totals`,
`get_expenses_by_movement_type`, `get_monthly_flow`, `get_budget_status` y `get_budget_history`
filtran `m.transfer_id is null`. Una transferencia mueve plata entre cuentas propias pero no es
ingreso ni gasto; sin el filtro inflaría ambos lados del período y consumiría tope de presupuesto.
**Toda agregación nueva sobre `movements` tiene que llevar ese filtro**; olvidarla deja una
inconsistencia silenciosa entre pantallas. `TopExpensesCard` no usa RPC y filtra en JS.

Diagnóstico de pares desapareados (p. ej. tras borrar una cuenta que participó en transferencias,
por el `ON DELETE CASCADE` de `movements.account_id`):

```sql
select transfer_id from public.movements
where transfer_id is not null group by transfer_id having count(*) <> 2;
```

## Presupuestos mensuales

Dos tablas y tres funciones RPC (`supabase/migrations/*_add_budgets.sql`, esquema en
`supabase/schemas/public/`). Plan de origen: `docs/plans/budgets-implementation.md`.

- **`budgets`** — la configuración: un tope por `(user_id, movement_type_id)` (único), `is_active`.
- **`budget_periods`** — el histórico **del tope**: una fila por `(budget_id, period_month)`, con el
  tope que regía ese mes. `period_month` es siempre el día 1 (`CHECK`): el único
  `(budget_id, period_month)` es lo que hace idempotentes el `on conflict do nothing` de
  `ensure_budget_periods` y el `upsert` de `updateBudgetClient`.

| Función | Devuelve | Uso |
| --- | --- | --- |
| `ensure_budget_periods(p_month)` | `integer` (filas creadas). **`volatile`**: es la única que escribe | `lib/services/budgets.ts` → `getBudgetStatus`, siempre **antes** de `get_budget_status` |
| `get_budget_status(p_month)` | `(budget_id, movement_type_id, name, color, amount_limit, spent, is_active)`, una fila por presupuesto (no filtra `is_active`) | `getBudgetStatus` |
| `get_budget_history(p_budget_id, p_months)` | `(period_month, amount_limit, spent)`, del mes más reciente al más viejo | `getBudgetHistory` |

Las tres son `security invoker` con `set search_path = ''`, como las del dashboard. `ensure_budget_periods`
rellena desde el mes de creación del presupuesto hasta el mes en curso (nunca meses futuros ni previos a
la creación) y solo para presupuestos activos. `get_budget_history` lee `bp.amount` sin `coalesce`
contra `budgets.amount`: el histórico muestra el tope de *ese* mes, no el actual. Un mes futuro sin fila
se proyecta con el tope configurado (`get_budget_status` sí hace `coalesce`).

### Por qué no hay trigger que descuente el presupuesto

**Lo gastado se calcula al leer (suma de `movements` de tipo `debit` por tipo y mes); no hay columna
`spent` ni trigger.** Es a propósito, y es el mismo problema que
[El saldo es incremental, no calculado](#3-el-saldo-es-incremental-no-calculado): un saldo guardado y
descontado por trigger obligaría a que el `UPDATE` de un movimiento revierta el efecto viejo y aplique
el nuevo, incluso moviendo plata entre dos presupuestos (cambia `movement_type_id`) o entre dos meses
(cambia `date`), y `bulkCreateMovements` (upsert de 200 filas) lo dispararía fila por fila. Cualquier
agujero queda como descuadre permanente. **No agregar ese trigger para "completar" la feature.**

## Deudas

Servicios (sin fin definido) y pagos en cuotas, con recordatorio en el dashboard. Plan de origen:
`docs/plans/debts-implementation.md`.

- **`debts`** — la configuración: `kind` (`service`/`installments`), `amount_mode`
  (`fixed`/`variable`), `amount`, `movement_type_id` (`ON DELETE RESTRICT`, como `movements`, no
  `CASCADE` como `budgets`: borrar un tipo no puede llevarse puestas deudas), `first_due_date`
  (el vencimiento de la primera cuota o período a pagar desde la app), `total_installments` /
  `initial_paid_installments` (`null`/`0` en servicios; coherencia forzada por un `CHECK`) e
  `is_finished` (manual).
- **`movements.debt_id`** — `uuid` nullable, `ON DELETE SET NULL`: borrar una deuda no borra sus
  movimientos (la plata salió de la cuenta de verdad; con `CASCADE` revertiría saldos). Un `CHECK`
  (`movements_debt_or_transfer_check`) impide que una fila sea a la vez pago de deuda y mitad de una
  transferencia.

| Función | Devuelve | Uso |
| --- | --- | --- |
| `get_debts_status(p_debt_id)` | Una fila por deuda (todas, o solo `p_debt_id`): columnas de `debts` más `payments_count`, `paid_amount`, `paid_installments`, `remaining_installments`, `remaining_amount`, `finished` y `next_due_date`, calculados al leer | `lib/services/debts.ts` → `getDebts`, `getDebtById`, `getUpcomingDebts` |
| `create_debt_payment(p_debt_id, p_account_id, p_amount, p_date, p_description)` | Inserta el movimiento `debit` (con el `movement_type_id` de la deuda) y devuelve su id | `lib/services/debts.client.ts` → `createDebtPayment` |

Ambas son `security invoker` con `set search_path = ''`, como el resto de las RPC de este archivo.
`get_debts_status` filtra `m.transfer_id is null` en el `left join lateral` que agrega
`movements` — igual que las cinco agregaciones de [Transferencias](#transferencias-entre-cuentas).

### Por qué el próximo vencimiento y "finalizada" se calculan y no se guardan

Mismo problema que [el saldo](#3-el-saldo-es-incremental-no-calculado) y que los
[presupuestos](#por-qué-no-hay-trigger-que-descuente-el-presupuesto): un valor guardado que un
trigger ajuste al insertar/editar/borrar un pago queda descuadrado para siempre en cuanto alguien
edita o borra ese movimiento por otro camino (`/protected/movements`). `get_debts_status` calcula
`next_due_date` como `first_due_date + (payments_count) meses` y `finished` como `is_finished OR
paid_installments >= total_installments`, siempre a partir de los movimientos reales.

⚠️ **`next_due_date` se calcula siempre desde `first_due_date`, nunca encadenando mes a mes.**
Postgres recorta el 31 de enero + 1 mes al 28 de febrero, pero 31 de enero + 2 meses da 31 de marzo.
Encadenar (sumar un mes al resultado anterior) dejaría el día en 28 para siempre a partir de la
primera vez que el mes recorta.

## `movements.date`: fecha y hora

La columna es `timestamp without time zone` (antes `date`). Plan: `docs/plans/movements-date-timestamp-implementation.md`.

- **Por qué `timestamp` y no `timestamptz`.** La app asume "día calendario local de Paraguay" y
  ninguna comparación en SQL hace matemática de zonas. Con `timestamptz`, un movimiento de las 22:00
  del 30/09 local se guarda como 01:00 del 01/10 UTC (la sesión de PostgREST corre en UTC) y caería
  en el mes siguiente en el dashboard y los presupuestos. Contrapartida: las horas se muestran como
  hora paraguaya, no la del visitante.
- **Todo fin de rango sobre `movements.date` es `< día + 1`, nunca `<=`.** `<= p_end_date` castea a
  las 00:00 y pierde todo lo posterior del último día. Está aplicado en las tres RPC del dashboard,
  y en `getMovements` con `nextDay()` (`lib/dashboard/date-range.ts`). El inicio (`>=`) no cambia.
  Los parámetros `p_start_date` / `p_end_date` siguen siendo `date`.
- **Las filas previas al cambio de tipo están a las 00:00**, igual que las importadas de extractos
  (no traen hora). La UI omite la hora cuando es 00:00.
- **Las RPC de presupuestos no se tocan**: ya usan `>= month_start` / `< month_start + interval '1 month'`.
- `create_transfer` / `update_transfer` reciben `p_date timestamp`.

## Índices y restricciones

### `movements.external_id`

Soporta la deduplicación de la importación de extractos bancarios (ver
[`docs/imports.md`](imports.md)). Guarda el identificador que trae el extracto (nro. de
comprobante), prefijado `doc:`, o una huella calculada, prefijada `fp:`, cuando el banco no trae
identificador propio. Los movimientos cargados a mano quedan con `external_id` en `NULL`. El índice
único `movements_account_external_id_key` está definido en
`supabase/schemas/public/tables/movements.sql`.

El índice único **no es parcial**: en Postgres los `NULL` son distintos entre sí dentro de un
índice único, así que todos los movimientos con `external_id` en `NULL` (los cargados a mano)
conviven sin chocar contra el índice. Esto es lo que permite además usar `onConflict` desde
PostgREST — un índice parcial no lo dejaría expresar.

**Efecto secundario:** un `upsert` con `onConflict: "account_id,external_id"` que choca contra
una fila existente no dispara `trigger_update_account_balance` para la fila descartada (con
`ignoreDuplicates: true`, Postgres ni siquiera intenta el `UPDATE`). Reimportar un extracto no
puede descuadrar el saldo.

### `movements.transfer_id`

`uuid` nullable, con índice `idx_movements_transfer`. `NULL` en los movimientos normales.

## Cuenta principal (`accounts.is_primary`)

`boolean not null default false`. Marca la cuenta que la app preselecciona en el filtro de
`/protected/movements`, en el dashboard y en el alta de un movimiento.

**Se permiten varias cuentas principales por usuario, a propósito.** No hay índice único parcial,
ni trigger que desmarque las demás, ni RPC que haga el swap atómico: el desempate lo hace la app
en `lib/accounts/primary.ts`, tomando la primera del listado, que `getAccounts()` devuelve
ordenado por `name` ascendente. La contrapartida es que dos pestañas pueden dejar dos cuentas
marcadas y nadie se entera; es aceptable porque el peor efecto es "se preselecciona la otra".

Tampoco hay índice sobre la columna: ninguna query filtra por `is_primary`, se lee del listado de
cuentas que la página ya trae.

A diferencia de `updated_at` y `current_balance`, **esta columna sí se escribe desde la app**
(`accountSchema` en `lib/schemas/accounts.ts` → `lib/services/accounts.client.ts`).

El sentinela `"all"` de la URL (`?accountId=all` = "todas las cuentas") es puramente de la capa
web: `resolveAccountFilter` lo traduce a `undefined` y **nunca llega a `lib/services/*`**. Si
llegara, Postgres lo rechazaría con `22P02` (uuid inválido).

## Row Level Security (RLS)

**Verificado el 2026-08-15.**

### Por qué esto importa más de lo que parece

`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` viaja en el bundle del browser: es pública por diseño,
cualquiera que abra el DevTools de la app la tiene. **La RLS no es una capa extra de seguridad, es
la única.**

Los `.eq("accounts.user_id", ...)` que hay en `lib/services/*` son comodidad de consulta, **no
protección**: corren del lado del cliente y se pueden omitir. Si una tabla no tiene RLS, está
abierta a internet.

### Modelo de pertenencia

Las tres tablas resuelven "de quién es esta fila" de forma distinta, y por eso sus políticas no se
parecen:

| Tabla | Pertenencia | Cómo se expresa |
| --- | --- | --- |
| `accounts` | Directa | `user_id = auth.uid()` |
| `movements` | **Indirecta** | No tiene `user_id`. Se resuelve por `EXISTS` contra `accounts` vía `account_id` |
| `movement_types` | Ninguna | Tabla compartida/global, sin dueño; escritura restringida por UUID literal (regla 4) |
| `budgets` | Directa | `user_id = (select auth.uid())`. `movement_types` no tiene dueño, así que el presupuesto no puede heredarlo del tipo |
| `budget_periods` | **Indirecta** | No tiene `user_id`. `EXISTS` contra `budgets` vía `budget_id`, el mismo modelo que `movements` contra `accounts` |
| `debts` | Directa | `user_id = (select auth.uid())` |

Que `movements` no tenga `user_id` es lo que obliga a que todas sus políticas lleven la subconsulta.
Una política de `movements` que solo referencie columnas de `movements` **no está scopeando por
dueño**. Las políticas vigentes, con su DDL completo, están en
`supabase/schemas/public/tables/*.sql`.

### Reglas para la aplicación

1. **Toda tabla nueva nace con RLS activada y al menos una política.** Una tabla sin RLS es pública,
   no "todavía sin configurar".
2. **En las políticas, siempre `(select auth.uid())`, nunca `auth.uid()` pelado.** Ver
   [efectos secundarios](#efectos-secundarios-de-la-rls), punto 3.
3. **Toda política de `INSERT` necesita `with_check`.** Es lo único que valida la fila entrante;
   `using` no aplica al `INSERT`.
4. **`movement_types`: lectura abierta, escritura solo del dueño de la app.** `movement_types_read`
   es `USING (true)`; `INSERT`/`UPDATE`/`DELETE` comparan `(select auth.uid())` contra el UUID del
   dueño, escrito como literal en la política (no hay columna `user_id`). **La lectura sigue abierta
   a propósito:** los nombres no son sensibles, y cerrarla al UUID del dueño haría que, si su id
   cambiara, el `movement_types!inner` de `MOVEMENT_COLUMNS` vaciara en silencio la lista de
   movimientos. ⚠️ Si el proyecto se recrea o se restaura y el usuario cambia de id, hay que editar
   las tres políticas a mano; el síntoma es un error al crear/editar/borrar un tipo, sin más
   explicación.

### Efectos secundarios de la RLS

#### 1. Una política de `UPDATE` sin `with_check` **no** es un agujero

Cuando una política de `UPDATE` define solo `USING`, Postgres usa **esa misma expresión** también
como check de la fila resultante. O sea que no se puede mover un movimiento a una cuenta ajena,
aunque `pg_policies` muestre `with_check: null`.

Esto vale solo para `UPDATE` y `ALL`. En `INSERT` no hay `USING` del cual caer, así que ahí el
`with_check` sí es obligatorio (regla 3).

#### 2. "Sin políticas" significa dos cosas opuestas

Y desde `pg_policies` se ven **idénticas**, porque en ambos casos la consulta no devuelve filas:

| `relrowsecurity` | Políticas | Resultado real |
| --- | --- | --- |
| `true` | 0 | **Deny all.** Nadie lee ni escribe nada. |
| `false` | 0 | **Tabla abierta.** Cualquiera con la publishable key hace lo que quiera. |

Son el caso más seguro y el más inseguro posibles. Para distinguirlos hay que mirar
`relrowsecurity`, no `pg_policies` — ver [cómo verificar](#cómo-verificar).

Regla práctica: si la tabla tiene 0 políticas y la app **funciona**, entonces la RLS está
desactivada y la tabla es pública.

#### 3. `auth.uid()` se evalúa una vez por fila

Sin envolver, Postgres lo llama por cada fila; envuelto en `(select auth.uid())` lo trata como
InitPlan y lo evalúa una sola vez por consulta.

Con inserts de a uno la diferencia es invisible. **Con un insert masivo importa**: cada fila dispara
además su propio `EXISTS` contra `accounts`. Es la razón por la que la regla 2 no es cosmética.

#### 4. `to public` no es lo mismo que "público"

Una política `to public` cuyo `using` exige `auth.uid()` es segura: un anónimo obtiene
`auth.uid() = NULL`, `NULL = user_id` da `NULL`, y no ve ninguna fila. Es menos prolijo que
`to authenticated` —la política se evalúa igual para anónimos en vez de saltearse— pero no es un
problema de seguridad.

### Cómo verificar

```sql
-- 1. ¿Está activada la RLS, y hay políticas? (leer junto con el efecto secundario 2)
select
  c.relname as tabla,
  c.relrowsecurity as rls_activada,
  count(p.policyname) as politicas
from pg_class c
left join pg_policies p
  on p.schemaname = 'public' and p.tablename = c.relname
where c.relnamespace = 'public'::regnamespace
  and c.relname in ('accounts', 'movements', 'movement_types')
group by c.relname, c.relrowsecurity
order by c.relname;

-- 2. ¿Qué dicen? `qual` (lectura) y `with_check` (escritura) tienen que mencionar auth.uid()
select tablename, policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'public'
order by tablename, cmd;
```

La prueba que realmente vale, porque las consultas de arriba dicen qué está *configurado* y esta
dice qué pasa de verdad. Sin sesión iniciada, solo con la key pública:

```bash
source .env.local
curl -s "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/movements?select=id&limit=1" \
  -H "apikey: $NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"
```

Si devuelve una fila, la tabla es pública. Si devuelve `[]` o un error, la RLS está funcionando.
Cambiando `movements` por otra tabla se verifica cualquiera.
