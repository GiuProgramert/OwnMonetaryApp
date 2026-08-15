# Base de datos (Supabase)

Este proyecto **no tiene migraciones versionadas en el repo**. El esquema, las funciones,
los triggers y las políticas de RLS viven únicamente en Supabase. Este documento existe
para que esa lógica no sea invisible desde el código.

Para verlos en Supabase: *Database → Triggers*, *Database → Functions* y
*Authentication → Policies*.

Dos temas, y conviene leer los dos antes de tocar `movements`: los [triggers](#triggers-existentes)
(que gobiernan el saldo) y la [RLS](#row-level-security-rls) (que es la única barrera de seguridad
de la base).

## Triggers existentes

| Trigger | Tabla | Función | Events |
| --- | --- | --- | --- |
| `trigger_accounts_updated_at` | `accounts` | `update_updated_at` | `BEFORE UPDATE` |
| `trigger_movement_types_updated_at` | `movement_types` | `update_updated_at` | `BEFORE UPDATE` |
| `trigger_movements_updated_at` | `movements` | `update_updated_at` | `BEFORE UPDATE` |
| `trigger_update_account_balance` | `movements` | `update_account_balance` | `AFTER UPDATE` `AFTER DELETE` `AFTER INSERT` |

## Reglas para la aplicación

Estas tres reglas se desprenden directamente de los triggers y son obligatorias:

1. **Nunca escribir `updated_at` desde la app.** Lo setea `update_updated_at` en cada `UPDATE`.
2. **Nunca escribir `current_balance` desde la app.** Es un valor derivado: se modifica
   insertando, editando o borrando filas en `movements`. Escribirlo a mano introduce
   descuadre permanente (ver [Descuadre de saldos](#descuadre-de-saldos)).
3. **`movements.type` debe ser siempre exactamente `'credit'` o `'debit'`.** Cualquier otro
   valor corrompe el saldo en silencio (ver [Efectos secundarios](#efectos-secundarios), punto 1).

## Funciones

### `update_updated_at`

```sql
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
```

### `update_account_balance`

Cubre `INSERT`, `UPDATE` y `DELETE`. En el caso `UPDATE` revierte el movimiento anterior
sobre `OLD.account_id` y aplica el nuevo sobre `NEW.account_id`, así que **mover un
movimiento de una cuenta a otra cuadra correctamente**.

```sql
BEGIN
  -- If INSERT or UPDATE, calculate new balance
  IF (TG_OP = 'INSERT') THEN
    UPDATE accounts
    SET current_balance = current_balance +
      CASE
        WHEN NEW.type = 'credit' THEN NEW.amount
        WHEN NEW.type = 'debit' THEN -NEW.amount
      END
    WHERE id = NEW.account_id;

  ELSIF (TG_OP = 'UPDATE') THEN
    -- Revert previous movement
    UPDATE accounts
    SET current_balance = current_balance -
      CASE
        WHEN OLD.type = 'credit' THEN OLD.amount
        WHEN OLD.type = 'debit' THEN -OLD.amount
      END
    WHERE id = OLD.account_id;

    -- Apply new movement
    UPDATE accounts
    SET current_balance = current_balance +
      CASE
        WHEN NEW.type = 'credit' THEN NEW.amount
        WHEN NEW.type = 'debit' THEN -NEW.amount
      END
    WHERE id = NEW.account_id;

  ELSIF (TG_OP = 'DELETE') THEN
    -- Revert deleted movement
    UPDATE accounts
    SET current_balance = current_balance -
      CASE
        WHEN OLD.type = 'credit' THEN OLD.amount
        WHEN OLD.type = 'debit' THEN -OLD.amount
      END
    WHERE id = OLD.account_id;

    RETURN OLD;
  END IF;

  RETURN NEW;
END;
```

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
| `movement_types` | Ninguna | Tabla compartida/global, sin dueño |

Que `movements` no tenga `user_id` es lo que obliga a que todas sus políticas lleven la subconsulta.
Una política de `movements` que solo referencie columnas de `movements` **no está scopeando por
dueño**.

### Políticas

```sql
-- accounts: dueño directo
create policy "accounts_select_own" on accounts
  for select using (user_id = (select auth.uid()));

create policy "accounts_insert_own" on accounts
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "accounts_update_own" on accounts
  for update using (user_id = (select auth.uid()));

create policy "accounts_delete_own" on accounts
  for delete using (user_id = (select auth.uid()));

-- movements: dueño indirecto, a través de la cuenta.
-- El mismo EXISTS va en las cuatro; en INSERT como with_check.
create policy "movements_insert_own" on movements
  for insert to authenticated
  with check (
    exists (
      select 1 from accounts a
      where a.id = movements.account_id
        and a.user_id = (select auth.uid())
    )
  );
-- (idem select / update / delete, con la misma expresión en `using`)

-- movement_types: tabla compartida, cerrada a anónimos
create policy "movement_types_read" on movement_types
  for select to authenticated using (true);

create policy "movement_types_write" on movement_types
  for all to authenticated
  using (true) with check (true);
```

> Este bloque documenta **la forma** de las políticas, no sus nombres exactos: varias se crearon
> antes con nombres descriptivos en inglés (`"Users can view own accounts"`, etc.). Para ver las
> definiciones vigentes, correr la query 2 de [cómo verificar](#cómo-verificar) — esa es la
> autoridad, no este bloque.

### Reglas para la aplicación

1. **Toda tabla nueva nace con RLS activada y al menos una política.** Una tabla sin RLS es pública,
   no "todavía sin configurar".
2. **En las políticas, siempre `(select auth.uid())`, nunca `auth.uid()` pelado.** Ver
   [efectos secundarios](#efectos-secundarios-de-la-rls), punto 3.
3. **Toda política de `INSERT` necesita `with_check`.** Es lo único que valida la fila entrante;
   `using` no aplica al `INSERT`.
4. **`movement_types` es editable por cualquier usuario autenticado.** Hoy es correcto porque la app
   es de un solo usuario. Si eso cambia, la tabla necesita `user_id` y scoping real — es cambio de
   modelo, no de RLS.

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
