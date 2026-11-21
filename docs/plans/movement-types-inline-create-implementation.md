# Plan: crear un tipo de movimiento desde el formulario del movimiento

**Fecha:** 2026-11-21
**Estado:** implementado y probado — 1.1–6.3 hechos + C-1; e2e verde (41/41)

## Objetivo

Al cargar o editar un movimiento, el campo "Tipo de movimiento" pasa a ser un buscador: el usuario
tipea y la lista se filtra. Si lo tipeado no coincide con ningún tipo existente, aparece la opción
**Crear «texto»**; con Enter o clic se abre un modal con el formulario del tipo de movimiento (con el
nombre ya cargado), y al guardarlo el tipo nuevo queda seleccionado en el formulario del movimiento,
sin perder nada de lo que ya estaba cargado.

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

- `components/movements/movement-form-fields.tsx` — los campos del movimiento, compartidos por
  `components/movements/create-form.tsx` y `components/movements/edit-form.tsx` (los dos envuelven
  los campos en `FormProvider` de `react-hook-form`). Recibe `movementTypes` como prop y hoy pinta
  el campo con `MovementTypeSelect`.
- `components/movement-type-select.tsx` — el `<Select>` de shadcn con muestra de color. Lo usan
  también `components/movements/filters.tsx`, `components/budgets/budget-form-fields.tsx`,
  `components/debts/debt-form-fields.tsx` y `components/movements/import/import-preview-{table,cards}.tsx`.
  **No se modifica**: sigue siendo el select de todas esas pantallas.
- `components/movement-types/create-form.tsx` (`CreateMovementTypeForm`) — formulario del tipo
  (nombre, descripción, color, "Excluir de los gráficos de gastos"), con `movementTypeSchema`.
  Hoy al guardar hace `router.back()` y no maneja errores.
- `lib/services/movement-types.client.ts` → `createMovementType(params)` — valida con
  `movementTypeSchema.safeParse`, inserta y devuelve la fila (`MovementType`) con `.select().single()`.
- `lib/services/revalidate.ts` → `revalidatePathServer(path)`.
- `react-hot-toast` para los errores (como en `components/movements/create-form.tsx`).
- `lib/schemas/movement-types.ts` → `movementTypeSchema`, `MovementType`, `createMovementType`.

Restricciones que condicionan el diseño:

1. **Solo el dueño de la app puede insertar en `movement_types`.** La política
   `movement_types_insert` (`supabase/schemas/public/tables/movement_types.sql`) compara
   `auth.uid()` con un UUID literal. Cualquier otro usuario autenticado — incluido el usuario de QA —
   recibe un error de Postgres `42501` (RLS). La lectura está abierta a todos. Consecuencia: el
   camino exitoso no se puede probar de verdad con el usuario de QA (ver *Criterios de prueba*).
2. **`movement_types.name` es `UNIQUE` y distingue mayúsculas** (`movement_types_name_key`). Insertar
   un nombre repetido da `23505`. "Comida" y "comida" son distintos para la base, pero para el
   usuario son el mismo tipo: la detección de "ya existe" en la UI tiene que ignorar mayúsculas y
   acentos.
3. **`getMovementTypes()` excluye el tipo `Transferencia`** (`transferMovementTypeId`). Si el usuario
   tipea "Transferencia", la UI no lo encuentra y ofrece crearlo, y el insert choca con `23505`.
   Se resuelve con el mensaje de error de 3.2, no ocultando el texto.
4. **No hay `popover`, `command` ni `dialog` en `components/ui/`**, y `cmdk` no está instalado. El
   paquete `radix-ui` sí está (trae dialog y popover).
5. **La lista de tipos llega del servidor como prop** (`app/protected/movements/create/page.tsx` y
   `edit/[id]/page.tsx` llaman a `getMovementTypes()`). Para que el tipo nuevo aparezca y quede
   seleccionado sin recargar la página, `movement-form-fields.tsx` tiene que llevar la lista en
   estado local. Ese estado sobrevive a "Crear y agregar otro" (que hace `methods.reset(...)` pero
   no desmonta los campos), así que el tipo creado sigue disponible para el siguiente movimiento.
6. ⚠️ **El modal queda dentro del `<form>` del movimiento en el árbol de React.** Aunque el Dialog de
   Radix se renderiza en un portal (fuera del `<form>` en el DOM), los eventos sintéticos de React
   burbujean por el árbol de componentes: el `submit` del formulario del modal llega al `onSubmit`
   del formulario del movimiento y lo envía. Hay que cortarlo con `e.stopPropagation()`.
7. **`e2e/amount-input-calculator.spec.ts:277`** abre el campo con `page.locator("#movement_type_id")`
   y elige con `getByRole("option", { name, exact: true }).first()`. El combobox nuevo tiene que
   conservar `id="movement_type_id"` en su botón disparador; los ítems de `cmdk` ya tienen
   `role="option"`. Ese test tiene que seguir pasando sin cambios.

## Decisiones tomadas

- **La opción "Crear «…»" la ve cualquier usuario, no solo el dueño.** Quien no es el dueño recibe
  un toast claro ("Solo el dueño de la app puede crear tipos de movimiento") y el modal queda
  abierto. Alternativa descartada: ocultarla con el UUID del dueño copiado en `lib/constants.ts` —
  duplica el UUID entre SQL y TS (si cambia en uno, la UI miente) y deja al usuario de QA sin
  poder ver la feature, así que P.3–P.8 no se podrían probar. Contrapartida aceptada: un usuario
  que no es el dueño ve una opción que no puede usar. Hoy el único usuario real es el dueño.
- **El combobox reemplaza al select en el alta y en la edición del movimiento.** Los dos usan
  `movement-form-fields.tsx`; limitarlo al alta pediría una prop extra sin beneficio. Contrapartida:
  la edición de un movimiento también puede crear tipos.
- **El modal muestra el formulario completo del tipo** (nombre ya cargado con lo tipeado,
  descripción obligatoria, color, "Excluir de los gráficos de gastos"), reutilizando
  `CreateMovementTypeForm`. Alternativa descartada: un modal reducido (nombre + color) que obligaría
  a hacer opcional la descripción en `movementTypeSchema` y afectaría a la pantalla
  `/protected/movement-types/create`. Contrapartida: crear un tipo desde el movimiento pide
  completar la descripción.
- **El combobox es un componente nuevo y compartido, `components/movement-type-combobox.tsx`**, no
  una variante de `MovementTypeSelect`: el `<Select>` de Radix no tiene buscador, y las otras
  pantallas no lo piden (ver *Fuera de alcance*).
- **El filtro y la coincidencia exacta ignoran mayúsculas y acentos** (restricción 2): "educacion"
  encuentra "Educación" y no ofrece crearlo.
- **El camino exitoso se prueba con la respuesta de Supabase simulada** (`page.route`), y la
  creación real se verifica a mano con el usuario dueño (restricción 1).

## Arquitectura

```
movement-form-fields.tsx                         (estado local: types, dialogOpen, pendingName)
  └─ <MovementTypeCombobox                       components/movement-type-combobox.tsx
        id="movement_type_id" movementTypes={types} value onChange
        onCreateRequest={(name) => abrir modal con name} />
        └─ Popover > Command (cmdk)
             ├─ ítems filtrados con filterMovementTypes()        lib/movement-types/search.ts
             └─ "Crear «texto»" si !hasExactMatch()
  └─ <CreateMovementTypeDialog                   components/movement-types/create-dialog.tsx
        open defaultName onOpenChange
        onCreated={(type) => agregar a types + setValue + cerrar} />
        └─ Dialog > <CreateMovementTypeForm defaultName onCreated />
                    (submit con stopPropagation → createMovementType())
```

Archivos nuevos: `components/ui/{popover,command,dialog}.tsx` (shadcn),
`lib/movement-types/search.ts`, `components/movement-type-combobox.tsx`,
`components/movement-types/create-dialog.tsx`.
Archivos modificados: `lib/services/movement-types.client.ts`,
`components/movement-types/create-form.tsx`, `components/movements/movement-form-fields.tsx`,
`CLAUDE.md`.

## Fase 1 — Primitivas

- [x] **1.1** `npx shadcn@latest add popover command dialog`. Tiene que instalar `cmdk` como
  dependencia y dejar `components/ui/popover.tsx`, `components/ui/command.tsx` y
  `components/ui/dialog.tsx` (estilo `new-york`, sin prefijo, según `components.json`). Si el CLI
  propone sobrescribir algún archivo existente de `components/ui/` (p. ej. `button.tsx`), **no
  sobrescribir** y reportarlo.

## Fase 2 — Base de datos

Sin cambios. ⚠️ No tocar la política `movement_types_insert` ni ninguna otra de `movement_types`:
la restricción de escritura al dueño es deliberada (ver `docs/database.md`, regla 4 de RLS). La
feature convive con ella mostrando el error (decisión 1).

## Fase 3 — Helpers y servicio

- [x] **3.1** Crear `lib/movement-types/search.ts`, puro (sin React ni Supabase), con:
  - `normalizeTypeName(value: string): string` — `trim()`, minúsculas y sin diacríticos
    (`normalize("NFD").replace(/\p{Diacritic}/gu, "")`).
  - `filterMovementTypes<T extends { name: string }>(types: T[], query: string): T[]` — con query
    vacía (después de normalizar) devuelve `types` tal cual; si no, los que contienen la query
    normalizada en el nombre normalizado, en el mismo orden.
  - `hasExactMatch(types: { name: string }[], query: string): boolean` — `true` si algún nombre
    normalizado es igual a la query normalizada.
- [x] **3.2** En `lib/services/movement-types.client.ts`, que `createMovementType` lance errores en
  español:
  - `safeParse` fallido → `"Los datos del tipo de movimiento no son válidos"` (hoy `"Invalid input"`).
  - `error.code === "42501"` → `"Solo el dueño de la app puede crear tipos de movimiento"`.
  - `error.code === "23505"` → `"Ya existe un tipo de movimiento con ese nombre"`.
  - Cualquier otro → `error.message` como hoy.
  No cambiar `updateMovementTypeClient` ni `deleteMovementType`.

## Fase 4 — Componentes

- [x] **4.1** Crear `components/movement-type-combobox.tsx` (`"use client"`), al lado de
  `movement-type-select.tsx` porque es compartido. Props:
  `id?: string`, `movementTypes: Pick<MovementType, "id" | "name" | "color">[]`,
  `value: string | undefined`, `onChange: (id: string) => void`,
  `onCreateRequest?: (name: string) => void`, `placeholder?: string` (por defecto
  `"Selecciona un tipo de movimiento"`, igual que el select).
  - Disparador: `<Button type="button" variant="outline" role="combobox" aria-expanded={open}
    id={id} className="w-full justify-between">` con la muestra de color + nombre del tipo
    seleccionado (mismo markup que los ítems de `MovementTypeSelect`), o el placeholder en
    `text-muted-foreground`, y un `ChevronsUpDown` de `lucide-react`. ⚠️ `type="button"`: sin eso el
    botón envía el formulario del movimiento. ⚠️ El `id` va en este botón (restricción 7), así el
    `<Label htmlFor="movement_type_id">` lo nombra y `getByLabel("Tipo de movimiento")` lo encuentra.
  - Contenido: `PopoverContent` con ancho del disparador
    (`className="w-[--radix-popover-trigger-width] p-0"`) y adentro `<Command shouldFilter={false}>`
    — el filtrado lo hace `filterMovementTypes` (3.1), no `cmdk`, para que la opción "Crear" no
    quede filtrada y para ignorar acentos.
  - `CommandInput` con placeholder `"Buscar tipo…"`, controlado (`value`/`onValueChange`). La query
    se limpia al cerrar el popover.
  - Un `CommandItem` por tipo filtrado (muestra de color + nombre; `value={type.id}` para que dos
    nombres que solo difieren en mayúsculas no colisionen en `cmdk`); al elegirlo:
    `onChange(type.id)` y cerrar.
  - Si `onCreateRequest` existe, la query no está vacía y `!hasExactMatch(movementTypes, query)`:
    al final, un `CommandItem` con un ícono `Plus` y el texto `Crear «{query.trim()}»`. Al elegirlo
    (Enter o clic, ambos los maneja el `onSelect` de `cmdk`): cerrar el popover y **después**
    llamar a `onCreateRequest(query.trim())`. ⚠️ Cerrar primero: si el Dialog se abre con el Popover
    abierto, los dos pelean por el foco.
  - `CommandEmpty` con `"No se encontraron tipos"` (solo se ve cuando no hay ítems, o sea sin
    `onCreateRequest`).
  - ⚠️ Enter dentro del buscador no envía el formulario del movimiento: el input está en el portal
    del Popover, fuera del `<form>` en el DOM, así que no hay envío implícito. No agregar manejo de
    `keydown` propio.
- [x] **4.2** Refactorizar `components/movement-types/create-form.tsx` (`CreateMovementTypeForm`)
  para que acepte props opcionales `defaultName?: string` y
  `onCreated?: (type: MovementType) => void`:
  - `defaultValues: { name: defaultName ?? "", description: "", color: "#6B7280",
    exclude_from_expense_charts: false }`. `#6B7280` es el mismo valor por defecto de la columna
    en la base.
  - `onSubmit`: `try { const created = await createMovementType(data); ... } catch (error) {
    toast.error(error instanceof Error ? error.message : "No se pudo crear el tipo de movimiento");
    return; }`. Si hay `onCreated`, llamarlo con `created`; si no, `router.back()` como hoy.
  - ⚠️ El `<form>` usa `onSubmit={(e) => { e.stopPropagation(); void handleSubmit(onSubmit)(e); }}`
    (restricción 6). Sin esto, guardar el tipo desde el modal envía también el movimiento.
  - El botón pasa a `<Button type="submit" disabled={isSubmitting}>` con texto
    `isSubmitting ? "Creando..." : "Crear"`.
  - La pantalla `/protected/movement-types/create` (`app/protected/movement-types/create/page.tsx`)
    no cambia: sigue usando el formulario sin props.
- [x] **4.3** *(depende de 4.2)* Crear `components/movement-types/create-dialog.tsx`
  (`CreateMovementTypeDialog`, `"use client"`). Props: `open: boolean`,
  `onOpenChange: (open: boolean) => void`, `defaultName: string`,
  `onCreated: (type: MovementType) => void`. Renderiza `Dialog` > `DialogContent`
  (`className="max-h-[90dvh] overflow-y-auto sm:max-w-lg"`, para que entre en mobile) >
  `DialogHeader` con `DialogTitle` `"Nuevo tipo de movimiento"` y `DialogDescription`
  `"Al crearlo queda seleccionado en el movimiento."`, y `<CreateMovementTypeForm
  key={defaultName} defaultName={defaultName} onCreated={onCreated} />`. ⚠️ El `key` hace que el
  formulario se remonte con el nombre nuevo cada vez que se abre con otro texto; sin él,
  `defaultValues` de `react-hook-form` solo se leen en el primer montaje.
- [x] **4.4** *(depende de 3.1, 4.1 y 4.3)* En `components/movements/movement-form-fields.tsx`:
  - Estado local: `const [types, setTypes] = useState(movementTypes)`,
    `const [createName, setCreateName] = useState<string | null>(null)` (el modal está abierto
    cuando no es `null`).
  - Reemplazar `MovementTypeSelect` por `<MovementTypeCombobox id="movement_type_id"
    movementTypes={types} value={field.value} onChange={field.onChange}
    onCreateRequest={setCreateName} />` dentro del mismo `Controller`. Quitar el import de
    `MovementTypeSelect` de este archivo (el componente sigue existiendo para las otras pantallas).
  - Renderizar `<CreateMovementTypeDialog open={createName !== null} defaultName={createName ?? ""}
    onOpenChange={(open) => { if (!open) { setCreateName(null); } }} onCreated={handleCreated} />`.
  - `handleCreated(type)`: `setTypes((prev) => [...prev, type].sort((a, b) =>
    a.name.localeCompare(b.name, "es")))`, `setValue("movement_type_id", type.id,
    { shouldValidate: true, shouldDirty: true })` (`setValue` sale de `useFormContext`),
    `setCreateName(null)`, `toast.success("Tipo de movimiento creado")` y
    `void revalidatePathServer("/protected/movement-types")`.
  - ⚠️ `shouldValidate: true` borra el error "requerido" del campo si el usuario ya había intentado
    enviar el movimiento sin tipo.
- [x] **4.5** *(idea del planificador, aceptada)* En `components/movement-types/create-form.tsx`,
  arreglar el campo Color: hoy hay **dos** inputs con `id="color"` (el de color y el de texto
  deshabilitado), lo que hace ambiguo `getByLabel("Color")`, y el texto del hex usa
  `getValues("color")`, que no se actualiza al elegir otro color. Quitar el `id` del input de texto
  (dejarle `aria-label="Código del color"`) y mostrar `watch("color")`.

## Fase 5 — Páginas

Sin cambios: `app/protected/movements/create/page.tsx` y `app/protected/movements/edit/[id]/page.tsx`
ya pasan `movementTypes` a los formularios.

## Fase 6 — Cierre

- [x] **6.1** `npm run lint` y `npm run build`. Donde suele romper: tipos de `cmdk`/`radix-ui` en
  los archivos generados por shadcn, y el `Pick<MovementType, …>` del estado local de 4.4 contra el
  `MovementType` completo que devuelve `onCreated`.
- [x] **6.2** En `CLAUDE.md`, sección "Otras convenciones", agregar:
  - El campo tipo de movimiento del formulario de movimientos usa `MovementTypeCombobox`
    (buscador + "Crear «…»" que abre `CreateMovementTypeDialog`); el resto de las pantallas siguen
    con `MovementTypeSelect`.
  - Todo formulario que viva dentro de un `Dialog` abierto desde otro formulario corta el submit
    con `e.stopPropagation()`: los eventos de React burbujean por el árbol aunque el Dialog esté
    en un portal.
- [x] **6.3** Notas de cierre al final de este documento — *las escribe el orquestador al terminar
  las pruebas, no el implementador.*

## Criterios de prueba

Van en `e2e/movement-types-inline-create.spec.ts`, cada test nombrado con su id (`test("P.1 — …")`).

**Convenciones para todos los criterios:**

- Ruta: `/protected/movements/create`, salvo P.9. "El campo" es
  `page.getByLabel("Tipo de movimiento")` (el botón disparador del combobox); "el buscador" es
  `page.getByPlaceholder("Buscar tipo…")`.
- ⚠️ El usuario de QA **no puede crear tipos** (restricción 1). Ningún test crea ni edita filas de
  `movement_types`; los que necesitan un tipo existente lo buscan con `qaSupabase()`, excluyendo
  `Transferencia` (`e7f1b48a-be01-48a5-9982-5a4d4025493c`).
- Los textos que se tipean en el buscador para "no coincide" se arman con `uniqueName(...)` de
  `e2e/helpers/supabase.ts`, para que nunca coincidan con un tipo real.

**Datos (`beforeAll` / `afterAll`):** para P.1, crear con `qaSupabase()` una cuenta
`uniqueName("movement-types-inline")` y buscar un tipo existente cuyo nombre tenga al menos 4
caracteres. En `afterAll`, borrar la cuenta (los movimientos se borran en cascada).

- **P.1** (3.1, 4.1, 4.4) — Tipear en el buscador las primeras 4 letras del tipo existente en
  minúsculas y sin acentos ⇒ el tipo aparece como `option`. Elegirlo ⇒ el campo muestra su nombre.
  Completar descripción, monto `1000`, la cuenta de prueba y "Crear" ⇒ redirige a
  `/protected/movements?accountId=<cuenta>` y el movimiento aparece con ese tipo.
- **P.2** (3.1, 4.1) — Tipear el nombre completo del tipo existente en MAYÚSCULAS ⇒ no existe
  ninguna `option` cuyo nombre empiece con "Crear «".
- **P.3** (4.1, 4.3, 4.4) — Tipear un texto único `X` ⇒ aparece la `option` `Crear «X»`. Enter ⇒ se
  abre un `dialog` con el título "Nuevo tipo de movimiento" y el campo "Nombre" del modal vale `X`.
  Cerrar con Escape, volver a abrir el campo, tipear `X` y hacer **clic** en `Crear «X»` ⇒ el
  modal se abre igual.
- **P.4** (3.2, 4.2, 4.4) — Con el formulario del movimiento a medio cargar (descripción
  `"inline-test"`, monto `5000`), tipear `X`, abrir el modal, completar descripción y "Crear" ⇒
  aparece el toast "Solo el dueño de la app puede crear tipos de movimiento", el `dialog` sigue
  visible, la URL sigue siendo `/protected/movements/create`, y al cerrar el modal la descripción
  del movimiento sigue en `"inline-test"` y el monto en `5.000` (el submit no se propagó al
  formulario del movimiento — restricción 6). No se crea ningún movimiento.
- **P.5** (4.2, 4.4) — Camino exitoso con respuesta simulada: antes de abrir el modal,
  `page.route("**/rest/v1/movement_types*", …)` que, **solo para `POST`**, responde `201` con
  `contentType: "application/json"` y el **objeto** (no array — `.single()` pide un objeto)
  `{ id: crypto.randomUUID(), name: X, description: "d", color: "#6B7280",
  exclude_from_expense_charts: false, created_at: <ahora ISO>, updated_at: <ahora ISO> }`; el resto
  de los métodos siguen con `route.continue()`. Tipear `X`, abrir el modal, completar descripción,
  "Crear" ⇒ el `dialog` desaparece, aparece "Tipo de movimiento creado", el campo muestra `X`, y al
  reabrir el campo `X` está como `option`. ⚠️ **No enviar el movimiento**: el id simulado no existe
  en la base y el insert fallaría por la clave foránea.
- **P.6** (4.2) — En el modal, borrar la descripción y "Crear" ⇒ se ve "La descripción es
  requerida" dentro del `dialog`, y en el formulario del movimiento **no** aparece ningún error
  (p. ej. "La descripción es requerida" aparece una sola vez en la página).
- **P.7** (4.3, 4.4) — Con un tipo existente ya elegido en el campo, abrir el modal con `X` y
  cerrarlo con Escape ⇒ el `dialog` desaparece y el campo sigue mostrando el tipo elegido antes.
- **P.8** (4.3) — En viewport `390×844`, abrir el modal ⇒ el título, los cuatro campos y el botón
  "Crear" son visibles (con scroll dentro del modal si hace falta) y la página no tiene scroll
  horizontal.
- **P.9** (4.4) — En `/protected/movements/edit/<id>` de un movimiento creado en P.1 (o uno creado en
  este test y borrado al final), el campo muestra el tipo actual y, tipeando `X`, ofrece
  `Crear «X»` y abre el modal.
- **P.10** (restricción 7) — `e2e/amount-input-calculator.spec.ts` sigue pasando sin cambios
  (correr `PLAYWRIGHT_HTML_OPEN=never npx playwright test e2e/amount-input-calculator.spec.ts`).

**No cubierto por e2e:**

- **Creación real con el usuario dueño** — el usuario de QA no tiene permiso. Verificación manual
  del dueño: en `/protected/movements/create`, tipear un nombre nuevo, crear el tipo desde el
  modal, ver que queda seleccionado, guardar el movimiento y ver el tipo en
  `/protected/movement-types`. Después, borrar el tipo de prueba si no se quiere conservar.
- **Nombre duplicado (`23505`)** — para el usuario de QA la RLS rechaza antes (`42501`). Manual,
  con el dueño: tipear "Transferencia" (restricción 3) y crear ⇒ toast "Ya existe un tipo de
  movimiento con ese nombre", el modal queda abierto.
- **"Crear y agregar otro" conserva el tipo creado en la lista** — depende de una creación real.
  Manual, con el dueño, en la misma verificación del primer punto.

## Fuera de alcance

El usuario revisó los puntos propuestos y no eliminó ninguno. Esto queda afuera:

- **El combobox en las otras pantallas** (filtros de movimientos, presupuestos, deudas,
  importación de extractos). No se pidió, y en la importación hay un select por fila: abrir modales
  ahí es otro diseño. Siguen con `MovementTypeSelect`.
- **Ocultar "Crear «…»" a quien no es el dueño** — descartado en *Decisiones tomadas*.
- **Hacer opcional la descripción del tipo** — descartado en *Decisiones tomadas* (modal completo).
- **Editar o borrar tipos desde el modal o el combobox.** Solo se crea.
- **Tipos de movimiento por usuario** (columna `user_id` en `movement_types`). Cambia la RLS y todas
  las RPC que los leen; es otro plan.
- **Crear cuentas desde el formulario del movimiento** con el mismo patrón.
- **Arreglar el campo Color de `components/movement-types/edit-form.tsx`**, que tiene el mismo
  `id` duplicado que 4.5 corrige en el alta. No lo usa esta feature.

## Riesgos conocidos

- **Formulario de alta y de edición de movimientos.** Es la pantalla más usada; el reemplazo del
  select puede romper el envío (botón del combobox sin `type="button"`) o la validación de
  `movement_type_id`. P.1, P.9 y P.10 lo cubren.
- **Pantalla `/protected/movement-types/create`.** 4.2 y 4.5 tocan su formulario. No hay e2e que
  la cubra (el usuario de QA no puede crear tipos): el dueño debería crear un tipo desde esa
  pantalla una vez para confirmar que sigue volviendo atrás después de guardar.
- **`shadcn add` puede tocar archivos existentes** (ver 1.1) o agregar variables de CSS a
  `app/globals.css`. Revisar el diff antes de seguir.
- **Nombres que solo difieren en mayúsculas ya existentes en la base.** Si ya hubiera "Comida" y
  "comida", los dos aparecen en el buscador (son filas distintas); no es un error de esta feature.

## Registro de ejecución

**Inicio:** 2026-11-21 — ejecución orquestada (`ejecutar-plan`). Árbol limpio al arrancar (solo el
plan sin commitear).

### Ronda 1 — implementador

- Hechos: 1.1, 3.1, 3.2, 4.1, 4.2, 4.3, 4.4, 4.5, 6.1, 6.2 (verificados los `[x]`). 6.3 queda para
  el orquestador. Sin bloqueos. `lint` y `build` OK.
- Desvío declarado: el CLI de shadcn generó `import { cn } from "cn"` en `popover.tsx`,
  `command.tsx` y `dialog.tsx` y agregó el paquete npm `cn` a `package.json`. Se cambiaron los
  imports a `@/lib/utils` (como `button.tsx`) y se desinstaló `cn`; el único cambio neto en
  `package.json` es `cmdk ^1.1.1`. No se sobrescribió ningún archivo existente de `components/ui/`.

### Ronda 1 — tester

- P.1–P.9 pasan (`e2e/movement-types-inline-create.spec.ts`, 9 tests). P.10 no pasa.
- Suite completa: 35 pasan, 2 fallan (`amount-input-calculator` P.9 y P.10 → I-1).
- **I-1 [bug]** (P.10 / restricción 7): en `e2e/amount-input-calculator.spec.ts`, después de elegir el
  tipo con el combobox y tipear `=20000+10000` en Monto, el clic en "Crear" no envía el formulario
  (sin POST, sin error). Con HEAD limpio P.10 pasa 3/3; con el árbol actual falla 3/3. Pista del
  tester: con foco en Monto la fila de botones de la calculadora baja "Crear" 72 px; en el
  mousedown el blur resuelve la expresión, el layout salta y el clic cae fuera del botón. No se
  identificó por qué con el `Select` no pasaba. → implementador.
- **I-2 [plan]** (observación del tester): el formulario del modal usa `id="description"` (y
  probablemente los demás ids) igual que el formulario del movimiento; `getByLabel("Descripción")`
  dentro del modal apunta al input de afuera y los ids quedan duplicados en la página. No está en
  ningún punto del plan. → usuario.
- Observación sin incidencia: un Escape en los primeros ~200 ms después de abrir el modal no lo
  cierra (el Popover todavía se está desmontando).
- **Respuesta del usuario a I-2:** "Corregir ahora" — prop opcional en `CreateMovementTypeForm` para
  prefijar los ids, usada solo por el modal; `/protected/movement-types/create` no cambia.

### Ronda 2 — implementador

- **I-2:** hecho. `CreateMovementTypeForm` recibe `idPrefix?` (por defecto `""`) aplicado a ids y
  `htmlFor` de los cuatro campos; `CreateMovementTypeDialog` pasa `idPrefix="new-type-"`. `name` sin
  cambios. lint/build OK.
- **I-1:** bloqueado, causa encontrada. El combobox no agrega un salto de layout: el salto ya
  existía en `AmountInput`. Con una expresión sin resolver, el blur de Monto en el `mousedown` sobre
  "Crear" resuelve la expresión, aparece el error/preview y "Crear" baja; el `mouseup` cae fuera del
  botón y no hay `click`. Con el `Select`, Radix devolvía el foco a su disparador después de que el
  test tipeaba en Monto, así que el blur ocurría antes del clic y escondía el bug. Es un bug real
  para el usuario (clic en "Crear" con expresión sin resolver se pierde). La corrección
  recomendada toca `components/amount-input.tsx`, fuera de los archivos del plan → usuario.
- **Respuesta del usuario a I-1:** "Arreglar AmountInput" — que el error/resultado no desplace el
  layout (reservar la altura de esa línea o equivalente); el spec de la calculadora queda sin
  cambios. Se autoriza tocar `components/amount-input.tsx` (fuera de los archivos del plan).

### Ronda 3 — implementador

- **I-1:** corregida en `components/amount-input.tsx`: (1) mientras se calcula siempre se
  renderiza la línea de error/preview con `min-h-5` (cambio visible: una línea en blanco de 20 px
  reservada); (2) al perder el foco por un clic en otro control se retiene la altura del bloque de
  extras (fila de botones + mensaje) con `minHeight` hasta el siguiente `pointerup`/`pointercancel`/
  `keydown` o 1000 ms; (3) los extras van en un wrapper `div.grid.gap-2` que solo se renderiza si
  hace falta. Reglas de `AmountInput` intactas. Prettier agregó comas finales (ruido en el diff).
  Según el implementador, `amount-input-calculator.spec.ts` pasa 13/13 sin cambios (incluidos P.9 y
  P.10). lint/build OK.

### Ronda 2 — tester

- **I-1:** resuelta. `amount-input-calculator.spec.ts` con `--repeat-each=3`: 37/37 (P.9 y P.10 en
  las 3 repeticiones, spec sin cambios). Test nuevo `I-1 — clic directo en Crear con una expresión
  sin resolver guarda 30.000` pasa (un único movimiento de 30000 en la base).
- **I-2:** resuelta. Test nuevo `I-2 — el modal no duplica ids y su label apunta a su input` pasa.
- P.1–P.9 siguen pasando. Pantallas con monto (transferencias, pago de deuda) no se miraron a mano;
  sus e2e pasan.
- Suite completa: 38 pasan, 1 falla.
- **I-3 [sin clasificar]:** `e2e/dashboard.spec.ts:113` "el tooltip del donut se dibuja por encima
  del total del centro" — timeout en `donut.getByText("Total").evaluate(...)`. Reproducible (suite y
  spec solo); pasaba en la primera suite del día. El dashboard no usa ningún archivo tocado. →
  tester: comparar con HEAD limpio y con el server de dev reiniciado para saber si es regresión.

### Ronda 3 — tester

- **I-3:** clasificada como **datos**, no regresión. Un script de diagnóstico del tester (ronda 1,
  probe del salto de layout de I-1) dejó la cuenta `e2e-zzprobe-1795267145800` con saldo -30000;
  con un saldo negativo el card "Distribución del saldo actual" muestra barras en vez del donut y
  no existe el texto "Total". Se borró esa cuenta (una sola fila, verificado antes) → cerrada.
- Suite completa: **39 pasan, 0 fallan.** I-1, I-2 e I-3 cerradas.

## Notas de cierre

**Hecho:** todos los puntos (1.1, 3.1, 3.2, 4.1–4.5, 6.1, 6.2, 6.3). Nada quedó sin hacer.

**Desvíos respecto del plan:**

- **1.1** — el CLI de shadcn generó `import { cn } from "cn"` en `popover.tsx`, `command.tsx` y
  `dialog.tsx` y agregó el paquete npm `cn`. Se corrigieron los imports a `@/lib/utils` y se
  desinstaló `cn`; la única dependencia nueva es `cmdk`. Ojo en futuros `shadcn add`.
- **`components/amount-input.tsx` (fuera del plan, autorizado por el usuario en I-1).** El combobox
  destapó un bug previo: con una expresión sin resolver, el blur en el `mousedown` sobre "Crear"
  cambiaba la altura del campo (aparece error/preview, desaparece la fila de botones), el botón se
  movía y el clic se perdía. Con el `Select` no se veía porque Radix devolvía el foco a su
  disparador y el blur ocurría antes. Corrección: línea de mensaje reservada (`min-h-5`) mientras
  se calcula — **cambio visible: una línea en blanco de 20 px bajo Monto mientras hay una
  expresión** — y altura del bloque de extras retenida al perder el foco hasta el siguiente
  `pointerup`/`pointercancel`/`keydown` o 1000 ms. Prettier agregó comas finales en ese archivo.
- **`CreateMovementTypeForm` recibe `idPrefix?` (I-2, aprobado por el usuario).** El modal pasa
  `new-type-` para no duplicar `id="description"` y demás con el formulario del movimiento;
  `/protected/movement-types/create` conserva los ids de siempre.

**Incidencias:** I-1 [bug] calculadora/clic perdido → corregida en `AmountInput`. I-2 [plan] ids
duplicados en el modal → corregida con `idPrefix`. I-3 dashboard donut → dato huérfano del propio
tester, borrado; no era regresión.

**Tests:** `e2e/movement-types-inline-create.spec.ts` — P.1–P.9, `I-1 — clic directo en Crear con
una expresión sin resolver guarda 30.000` e `I-2 — el modal no duplica ids y su label apunta a su
input` (11 tests). P.10 es `e2e/amount-input-calculator.spec.ts` sin cambios (37/37 con
`--repeat-each=3`). Suite completa `npm run test:e2e`: 39/39.

**No se pudo verificar (pendiente del dueño, a mano):**

- Creación real de un tipo desde el modal, que quede seleccionado, guardar el movimiento y verlo en
  `/protected/movement-types` (el usuario de QA recibe `42501`; P.5 lo cubre solo con respuesta
  simulada).
- Nombre duplicado (`23505`): tipear "Transferencia" y crear ⇒ toast "Ya existe un tipo de
  movimiento con ese nombre", modal abierto.
- "Crear y agregar otro" conserva el tipo creado en la lista.
- `/protected/movement-types/create` sigue volviendo atrás después de guardar (4.2 y 4.5 tocaron su
  formulario; ningún e2e la cubre).
- Pantallas con monto fuera de movimientos (transferencias, pago de deuda) con el `AmountInput`
  cambiado: no se miraron a mano; sus e2e pasan.

**Observaciones sin incidencia:**

- Un Escape en los primeros ~200 ms después de abrir el modal no lo cierra (el Popover todavía se
  desmonta); hace falta un segundo Escape.
- `e2e/dashboard.spec.ts:113` (tooltip del donut) depende de que el usuario de QA no tenga ninguna
  cuenta con saldo negativo y no aísla ese dato: cualquier cuenta huérfana negativa lo rompe.

## Correcciones posteriores

- **C-1** (usuario, 2026-11-21): "Al hacer click en la selección en input de busqueda no queda bien
  con el efecto focus, se podría mejorar visualmente esa parte?" — la captura muestra el contorno
  de foco por defecto del navegador (borde negro redondeado) sobre el buscador "Buscar tipo…", que
  se sale de la fila. Causa encontrada por el orquestador: el proyecto usa Tailwind **3.4.1** y
  shadcn generó clases de Tailwind v4 en `components/ui/{command,popover,dialog}.tsx`
  (`outline-hidden`, `origin-(--…)`, `rounded-xs`…), que en v3 no existen, así que el
  `outline` del input no se quita. → implementador.
  - Implementador: clases v4 → v3 en `command.tsx` (`outline-hidden` → `outline-none` en
    `CommandInput`/`CommandItem`; `**:data-[slot=command-input-wrapper]:h-12` →
    `[&_[data-slot=command-input-wrapper]]:h-12` en `CommandDialog`), `popover.tsx`
    (`origin-(--…)` → `origin-[--…]`, `outline-hidden` → `outline-none`) y `dialog.tsx`
    (`rounded-xs` → `rounded-sm`, `focus:outline-hidden` → `focus:outline-none` en el botón de
    cerrar). Verificado en el navegador: sin contorno en el buscador, ítem activo resaltado, ring
    visible en el botón de cerrar con foco. lint/build OK. → tester.
  - Tester: verificada. Buscador enfocado con `outline: 2px solid transparent` y sin `box-shadow`;
    ítem activo resaltado con ArrowDown; botón de cerrar del modal con foco visible por teclado.
    Tests nuevos en `e2e/movement-types-inline-create.spec.ts`: `C-1 — el buscador del combobox no
    muestra el contorno de foco del navegador` y `C-1 — el botón de cerrar del modal tiene foco
    visible con teclado`. Suite completa: 41/41. **C-1 cerrada.**

### Notas de cierre — correcciones posteriores

- **C-1** (contorno de foco en el buscador): no era un estilo propio sino clases de Tailwind v4
  generadas por `shadcn add` en un proyecto con Tailwind 3.4.1 (`outline-hidden`, `origin-(--…)`,
  `rounded-xs`, `**:`), que no producían CSS. Se pasaron a v3 en
  `components/ui/{command,popover,dialog}.tsx`. ⚠️ Todo `npx shadcn@latest add` futuro en este
  repo puede traer sintaxis de v4 (y el import `from "cn"` de 1.1): revisar el archivo generado.
  2 tests nuevos; suite 41/41. Sin pendientes.
