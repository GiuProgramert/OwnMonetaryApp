# Base de datos (Supabase)

Este proyecto **no tiene migraciones versionadas en el repo**. El esquema, las funciones
y los triggers viven únicamente en Supabase. Este documento existe para que esa lógica
no sea invisible desde el código.

Para verlos en Supabase: *Database → Triggers* y *Database → Functions*.

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
