# Plan: implementación del módulo de movimientos

**Fecha:** 2026-08-15
**Estado:** aprobado, pendiente de ejecución

## Contexto

El módulo de movimientos está a medias. Lo que existe hoy:

- `lib/schemas/movements.ts` — solo tipos (`Movement`, `MovementFilter`, `Type`), **sin schema Zod**.
- `lib/services/movements.ts` — solo `getMovements(filter)`, con filtrado por cuenta, tipo y
  rango de fechas ya implementado.
- `components/movements/table.tsx` — tabla incompleta, con `<th>`/`<td>` crudos.
- `app/protected/movements/page.tsx` — con bugs (título "Cuentas", link a `accounts/create`).

Falta el CRUD completo, la UI de filtros y los componentes compartidos.

## Decisiones tomadas

- **La naturaleza (`credit`/`debit`) se queda como campo editable del movimiento**, con su
  select en el formulario. No se deriva del `movement_type`: es un proyecto personal y hay
  casos donde hace falta ajustarla a mano.
- **Los montos son enteros** (guaraníes, sin decimales) → `z.int().positive()`.
- **Los triggers de saldo y `updated_at` ya existen en Supabase** y están completos. No hay
  migración SQL que escribir. Ver [`docs/database.md`](../database.md).

## Fase 0 — Documentación de la base

- [x] **0.1** Crear `docs/database.md` con los 4 triggers, el cuerpo de `update_updated_at` y
  `update_account_balance`, las reglas para la app, los efectos secundarios y las queries de
  diagnóstico/reparación de descuadre.
- [ ] **0.2** Agregar una sección corta en `CLAUDE.md` apuntando a `docs/database.md`, para que
  cualquier sesión futura lo lea sin tener que descubrirlo.
- [ ] **0.3** Verificar las políticas de RLS de `movements` en Supabase. Si no existen, crearlas
  antes de seguir: la validación de pertenencia de la cuenta no puede vivir solo en TypeScript.

> La verificación del trigger de saldo que originalmente estaba en 0.3 ya se resolvió:
> `update_account_balance` cubre `INSERT`, `UPDATE` y `DELETE`, y maneja correctamente el
> cambio de cuenta en un `UPDATE`.

## Fase 1 — Schema

Todo en `lib/schemas/movements.ts`.

- [ ] **1.1** Pasar `const enum Type` a un `z.enum`, para poder iterar las opciones en el select
  (`const enum` con `isolatedModules` además es frágil en Next).
- [ ] **1.2** Agregar `movementSchema`: `date`, `description` (1–255), `amount` (**entero
  positivo**), `type`, `account_id` (uuid), `movement_type_id` (uuid). Mensajes en español.
- [ ] **1.3** Exportar `createMovement` vía `z.infer`.
- [ ] **1.4** Corregir el tipado de las relaciones: `accounts` y `movement_types` pasan de
  `Pick<...>[]` a objeto — es lo que realmente devuelve Supabase con `!inner` sobre una FK
  many-to-one.
- [ ] **1.5** Agregar `page` a `MovementFilter` para la paginación.

> El enum de 1.1 es la barrera que protege el saldo de las cuentas: un `type` fuera de
> `'credit'`/`'debit'` lo deja en `NULL` sin error. Ver `docs/database.md`, efectos secundarios.

## Fase 2 — Servicios

- [ ] **2.1** `getMovementById(id)` en `lib/services/movements.ts`, con el chequeo
  `error.details === notFoundDetailMessage` y scoping por `accounts.user_id`.
- [ ] **2.2** Paginación en `getMovements` con `.range()`, 25 por página, devolviendo también
  el `count` total.
- [ ] **2.3** `lib/services/movements.client.ts` con `createMovement`, `updateMovement` y
  `deleteMovement`, cada uno con `safeParse` antes de llamar a Supabase.
  **Sin tocar `current_balance` ni `updated_at`** — los triggers se encargan.

## Fase 3 — Componentes compartidos

- [ ] **3.1** `npx shadcn@latest add select` (no está en `components/ui/` y hacen falta tres
  selects: cuenta, tipo de movimiento, naturaleza).
- [ ] **3.2** `components/account-select.tsx` y `components/movement-type-select.tsx` — reciben
  las opciones por props desde el Server Component padre y muestran swatch de color + nombre.
  Van al nivel raíz de `components/` porque los usan tanto el formulario como el filtro.
- [ ] **3.3** `components/movements/amount-input.tsx` — separador de miles `es-PY` mientras se
  tipea, entero limpio hacia el form.
- [ ] **3.4** `components/movements/movement-form-fields.tsx` — los 6 campos compartidos entre
  crear y editar.
- [ ] **3.5** TODO en `components/accounts/create-form.tsx` y `components/accounts/edit.form.tsx`
  apuntando a extraer un `account-form-fields.tsx` con el mismo patrón.
- [ ] **3.6** `<Toaster />` de `react-hot-toast` en `app/protected/layout.tsx` — la dependencia
  está instalada y hoy no se usa en ninguna parte del proyecto.

## Fase 4 — CRUD

- [ ] **4.1** `components/movements/create-form.tsx` + `app/protected/movements/create/page.tsx`.
  La page carga cuentas y tipos server-side y los pasa a los selects. Fecha por defecto = hoy.
- [ ] **4.2** `components/movements/edit-form.tsx` (con guion, **no** `edit.form.tsx`) +
  `app/protected/movements/edit/[id]/page.tsx` con `notFound()`.
- [ ] **4.3** `components/movements/delete-form.tsx` +
  `app/protected/movements/delete/[id]/page.tsx`, mostrando descripción, monto y cuenta en la
  confirmación.
- [ ] **4.4** Los tres forms usan `useForm({ defaultValues })`, **no** `defaultValue` en el JSX
  como hace accounts hoy: con selects ese patrón manda campos vacíos al submit.
- [ ] **4.5** Los tres capturan errores y muestran toast; en éxito,
  `revalidateMyDataAndRedirect("/protected/movements")`.

## Fase 5 — Lista, tabla y filtros

- [ ] **5.1** Arreglar `app/protected/movements/page.tsx`: título "Movimientos", botón "Nuevo"
  → `/protected/movements/create`, sacar el `console.log`.
- [ ] **5.2** Reescribir `components/movements/table.tsx` con `TableHead`/`TableCell`. Columnas:
  Fecha · Descripción · Monto (`Gs.` + `es-PY`) · Cuenta (swatch) · Tipo (swatch) · Naturaleza
  (`Badge` crédito/débito) · Acciones (editar/borrar, mismos estilos que la tabla de cuentas).
- [ ] **5.3** `components/movements/filters.tsx` — cuenta, tipo y rango de fechas escribiendo en
  los `searchParams`. El backend de filtrado ya existe y hoy no tiene UI.
- [ ] **5.4** Cards de totales sobre el período filtrado: ingresos, egresos, balance neto.
- [ ] **5.5** Estados vacíos diferenciados: "no hay movimientos aún" vs "no hay resultados para
  estos filtros".
- [ ] **5.6** Controles de paginación (prev/next vía `searchParams`).
- [ ] **5.7** *(opcional, al final)* Ordenamiento por fecha y monto vía `searchParams`.

## Fase 6 — TODOs para después

Comentarios `TODO` en el punto exacto donde iría cada cosa, **sin implementarlas**:

- [ ] `components/accounts/table.tsx` → link "ver movimientos" a
  `/protected/movements?accountId=…`
- [ ] `app/protected/page.tsx` → dashboard con últimos movimientos y balance total
  (hoy la página está vacía)
- [ ] `lib/schemas/movements.ts` → transferencias entre cuentas (implica cambio de modelo de datos)
- [ ] `components/movements/filters.tsx` → exportar la vista filtrada a CSV

## Pendientes menores

- Los forms de `movement-types` tienen la misma duplicación que los de `accounts` (ver 3.5).
  Queda a definir si también les ponemos el TODO.
