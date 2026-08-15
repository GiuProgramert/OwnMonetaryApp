# Plan: implementación del módulo de movimientos

**Fecha:** 2026-08-15
**Estado:** ejecutado — ver notas de cierre al final del documento

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
- [x] **0.2** Agregar una sección corta en `CLAUDE.md` apuntando a `docs/database.md`, para que
  cualquier sesión futura lo lea sin tener que descubrirlo.
- [ ] **0.3** ⚠️ **Bloqueado, pendiente de verificación manual.** Verificar las políticas de RLS
  de `movements` en Supabase. Si no existen, crearlas antes de seguir: la validación de
  pertenencia de la cuenta no puede vivir solo en TypeScript. La sesión que ejecutó este plan no
  tenía service-role key ni CLI de Supabase configurados, así que no pudo inspeccionar ni crear
  políticas — solo el filtro `.eq("accounts.user_id", ...)` en el cliente cubre esto hoy. Revisar
  en el dashboard de Supabase (Authentication → Policies) antes de confiar en esto en producción.

> La verificación del trigger de saldo que originalmente estaba en 0.3 ya se resolvió:
> `update_account_balance` cubre `INSERT`, `UPDATE` y `DELETE`, y maneja correctamente el
> cambio de cuenta en un `UPDATE`.

## Fase 1 — Schema

Todo en `lib/schemas/movements.ts`.

- [x] **1.1** Pasar `const enum Type` a un `z.enum`, para poder iterar las opciones en el select
  (`const enum` con `isolatedModules` además es frágil en Next).
- [x] **1.2** Agregar `movementSchema`: `date`, `description` (1–255), `amount` (**entero
  positivo**), `type`, `account_id` (uuid), `movement_type_id` (uuid). Mensajes en español.
- [x] **1.3** Exportar `createMovement` vía `z.infer`.
- [x] **1.4** Corregir el tipado de las relaciones: `accounts` y `movement_types` pasan de
  `Pick<...>[]` a objeto — es lo que realmente devuelve Supabase con `!inner` sobre una FK
  many-to-one.
- [x] **1.5** Agregar `page` a `MovementFilter` para la paginación.

> El enum de 1.1 es la barrera que protege el saldo de las cuentas: un `type` fuera de
> `'credit'`/`'debit'` lo deja en `NULL` sin error. Ver `docs/database.md`, efectos secundarios.

## Fase 2 — Servicios

- [x] **2.1** `getMovementById(id)` en `lib/services/movements.ts`, con el chequeo
  `error.details === notFoundDetailMessage` y scoping por `accounts.user_id`.
- [x] **2.2** Paginación en `getMovements` con `.range()`, 25 por página, devolviendo también
  el `count` total.
- [x] **2.3** `lib/services/movements.client.ts` con `createMovement`, `updateMovement` y
  `deleteMovement`, cada uno con `safeParse` antes de llamar a Supabase.
  **Sin tocar `current_balance` ni `updated_at`** — los triggers se encargan.

> Además se agregó `getMovementsTotals(filter)` en `lib/services/movements.ts` (no estaba en el
> plan original), necesario para las cards de totales de 5.4: suma ingresos/egresos/balance neto
> sobre el filtro activo, sin paginar.

## Fase 3 — Componentes compartidos

- [x] **3.1** `npx shadcn@latest add select` (no está en `components/ui/` y hacen falta tres
  selects: cuenta, tipo de movimiento, naturaleza).
- [x] **3.2** `components/account-select.tsx` y `components/movement-type-select.tsx` — reciben
  las opciones por props desde el Server Component padre y muestran swatch de color + nombre.
  Van al nivel raíz de `components/` porque los usan tanto el formulario como el filtro.
  Ambos aceptan además un `allLabel` opcional que agrega un ítem "todas/todos" — lo usa
  `filters.tsx` (5.3) para el estado sin filtro; los forms de crear/editar no lo pasan.
- [x] **3.3** `components/movements/amount-input.tsx` — separador de miles `es-PY` mientras se
  tipea, entero limpio hacia el form.
- [x] **3.4** `components/movements/movement-form-fields.tsx` — los 6 campos compartidos entre
  crear y editar.
- [x] **3.5** TODO en `components/accounts/create-form.tsx` y `components/accounts/edit.form.tsx`
  apuntando a extraer un `account-form-fields.tsx` con el mismo patrón.
- [x] **3.6** `<Toaster />` de `react-hot-toast` en `app/protected/layout.tsx` — la dependencia
  está instalada y hoy no se usa en ninguna parte del proyecto.

## Fase 4 — CRUD

- [x] **4.1** `components/movements/create-form.tsx` + `app/protected/movements/create/page.tsx`.
  La page carga cuentas y tipos server-side y los pasa a los selects. Fecha por defecto = hoy.
- [x] **4.2** `components/movements/edit-form.tsx` (con guion, **no** `edit.form.tsx`) +
  `app/protected/movements/edit/[id]/page.tsx` con `notFound()`.
- [x] **4.3** `components/movements/delete-form.tsx` +
  `app/protected/movements/delete/[id]/page.tsx`, mostrando descripción, monto y cuenta en la
  confirmación.
- [x] **4.4** Los tres forms usan `useForm({ defaultValues })`, **no** `defaultValue` en el JSX
  como hace accounts hoy: con selects ese patrón manda campos vacíos al submit.
- [x] **4.5** Los tres capturan errores y muestran toast; en éxito,
  `revalidateMyDataAndRedirect("/protected/movements")`.

> Nota de implementación: `revalidateMyDataAndRedirect` llama a `redirect()` de Next, que
> funciona lanzando una excepción interna (`NEXT_REDIRECT`). Por eso el `try/catch` de cada form
> envuelve solo la llamada a `createMovement`/`updateMovement`/`deleteMovement` — la llamada a
> `revalidateMyDataAndRedirect` queda fuera del bloque, para no capturar por error ese throw.

## Fase 5 — Lista, tabla y filtros

- [x] **5.1** Arreglar `app/protected/movements/page.tsx`: título "Movimientos", botón "Nuevo"
  → `/protected/movements/create`, sacar el `console.log`.
- [x] **5.2** Reescribir `components/movements/table.tsx` con `TableHead`/`TableCell`. Columnas:
  Fecha · Descripción · Monto (`Gs.` + `es-PY`) · Cuenta (swatch) · Tipo (swatch) · Naturaleza
  (`Badge` crédito/débito) · Acciones (editar/borrar, mismos estilos que la tabla de cuentas).
- [x] **5.3** `components/movements/filters.tsx` — cuenta, tipo y rango de fechas escribiendo en
  los `searchParams`. El backend de filtrado ya existe y hoy no tiene UI.
- [x] **5.4** Cards de totales sobre el período filtrado: ingresos, egresos, balance neto.
  (`components/movements/totals.tsx`, usando `getMovementsTotals`.)
- [x] **5.5** Estados vacíos diferenciados: "no hay movimientos aún" vs "no hay resultados para
  estos filtros".
- [x] **5.6** Controles de paginación (prev/next vía `searchParams`), dentro de `table.tsx`.
- [ ] **5.7** *(opcional, al final)* Ordenamiento por fecha y monto vía `searchParams`. **No
  implementado** — quedó fuera por ser explícitamente opcional en el plan.

## Fase 6 — TODOs para después

Comentarios `TODO` en el punto exacto donde iría cada cosa, **sin implementarlas**:

- [x] `components/accounts/table.tsx` → link "ver movimientos" a
  `/protected/movements?accountId=…`
- [x] `app/protected/page.tsx` → dashboard con últimos movimientos y balance total
  (hoy la página está vacía)
- [x] `lib/schemas/movements.ts` → transferencias entre cuentas (implica cambio de modelo de datos)
- [x] `components/movements/filters.tsx` → exportar la vista filtrada a CSV

## Pendientes menores

- Los forms de `movement-types` tienen la misma duplicación que los de `accounts` (ver 3.5).
  Queda a definir si también les ponemos el TODO.

## Notas de cierre (ejecución del 2026-08-15)

Todas las fases se implementaron siguiendo el plan al pie de la letra, con dos excepciones:

- **0.3 queda pendiente**, bloqueada por falta de acceso a Supabase (sin service-role key ni CLI
  configurados en el entorno de ejecución). Requiere verificación manual antes de confiar en la
  seguridad de `movements` en producción.
- **5.7 se dejó sin implementar**, tal como indicaba el plan ("opcional, al final").

Verificación hecha antes de dar por cerrado el trabajo: `tsc --noEmit` limpio, `eslint` limpio en
todos los archivos tocados, y `npm run build` exitoso. No se pudo probar el flujo end-to-end en un
navegador real (sin herramienta de browser ni credenciales de login disponibles en la sesión) — se
confirmó en cambio que el servidor de desarrollo compila las rutas nuevas sin error y que el
middleware de auth redirige correctamente las peticiones no autenticadas a `/protected/movements`.
Recomendado: probar manualmente crear/editar/borrar movimientos, filtros y paginación en el
navegador antes de considerar el módulo listo para uso.
