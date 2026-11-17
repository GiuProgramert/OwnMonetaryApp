# Spec: suite de apps personales (estilo Odoo) sobre esta app

**Fecha:** 2026-11-16
**Estado:** aprobada — nada implementado. Cada fase se planifica aparte con
`escribir-plan`.

## Objetivo

Convertir esta app de finanzas en una **suite de apps personales al estilo Odoo**: una sola app
web, un solo login y una sola base de Supabase, donde la pantalla de inicio es un **lanzador de
apps** y cada app (Finanzas, Calendario, Recordatorios, y las que vengan) tiene su propio menú.

Las dos primeras apps nuevas:

- **Calendario**, al estilo de Google Calendar: varios calendarios con color, eventos con hora o de
  día completo, eventos recurrentes, vistas mes / semana / día / agenda.
- **Recordatorios**, al estilo de Google Tasks con alarmas: tareas con fecha y hora, recurrentes,
  que **llegan al celular por Telegram** aunque la app esté cerrada.

Y que se integren con lo que ya existe: los vencimientos de `debts` aparecen en el calendario y
generan avisos, sin cargarlos dos veces.

## Decisiones tomadas

| Pregunta | Decisión | Consecuencia |
| --- | --- | --- |
| ¿Una app o varias? | **Una sola app Next.js con módulos, estilo Odoo.** | Sin monorepo, sin sesión compartida entre dominios, sin duplicar UI ni clientes de Supabase. Este repo sigue siendo el único. |
| ¿Dónde corre? | **Netlify** (dominio propio). | Un solo deploy para toda la suite. |
| ¿Canal de avisos de Recordatorios? | **Bot de Telegram.** | El detalle se define en el plan de Recordatorios. |

### Por qué una sola app y no un monorepo

Con un monorepo cada app se despliega por separado, y hay que compartir la sesión (cookies con
dominio `.midominio.com`), el esquema, los tipos y los componentes entre paquetes. En una sola app
todo eso ya está resuelto: un `middleware.ts`, un `supabase/`, un `components/ui/`. Lo que Odoo
aporta —cada app con su menú y un lanzador para cambiar— es un problema de **navegación**, no de
despliegue, y se resuelve con un registro de apps (sección 1).

El costo es que el bundle y el build crecen juntos. Next ya divide el JS por ruta, así que una
librería pesada de una app solo se descarga en las páginas de esa app.

---

## 1. Navegación estilo Odoo

### Rutas

```
/protected                        → lanzador de apps (grilla de íconos)
/protected/finance                → dashboard de finanzas (lo que hoy es /protected)
/protected/finance/accounts       → (hoy /protected/accounts)
/protected/finance/movements/...  → (hoy /protected/movements/...)
/protected/finance/...            → movement-types, budgets, debts, transfers
/protected/calendar/...           → app Calendario
/protected/reminders/...          → app Recordatorios
/protected/settings/...           → ajustes de la suite (canales de notificación, etc.)
```

Mover finanzas bajo `/protected/finance` es lo que hace que cada app tenga un prefijo propio. Sin
eso, el sidebar no puede saber a qué app pertenece una ruta. Hoy hay unas 150 referencias a
`/protected/...` en 69 archivos (incluidos los tests e2e). El cambio es mecánico, pero hay que
hacerlo de una sola vez y con los e2e en verde. Para no romper marcadores ni la PWA instalada,
`next.config.ts` agrega `redirects()` desde las rutas viejas.

Slugs en inglés, igual que las rutas actuales (`accounts`, `movements`); los textos visibles en
español.

### Registro de apps

`lib/apps/registry.ts` reemplaza a `lib/nav-items.ts` y es la única fuente de qué apps existen:

```ts
export interface AppDefinition {
  id: "finance" | "calendar" | "reminders";
  name: string;            // "Finanzas"
  description: string;     // texto del tile en el lanzador
  icon: LucideIcon;
  color: string;           // hex, fondo del tile
  basePath: string;        // "/protected/finance"
  navItems: NavItem[];     // el menú de esa app (NavItem actual, con mobilePinned)
}
export function getCurrentApp(pathname: string): AppDefinition | undefined;
```

- **Lanzador** (`app/protected/page.tsx`, componente `components/apps/app-launcher.tsx`): grilla de
  tiles con ícono, color y nombre. *(Opcional)* cada tile muestra un contador (recordatorios para
  hoy, deudas vencidas), leído en el servidor, y cada contador va dentro de su propio `<Suspense>`
  para que uno lento no frene a los demás.
- **Sidebar**: arriba, un `AppSwitcher` (el ícono de grilla de Odoo/Google) que abre la lista de apps
  y lleva al lanzador; abajo, los `navItems` de la app actual (`getCurrentApp(pathname)`). En el
  lanzador mismo no hay sidebar de app.
- **Barra móvil** (`components/mobile-nav.tsx`): los ítems con `mobilePinned` de la app actual, y el
  botón "Menú" suma una fila "Apps" con las demás. La regla de 4 ítems fijos se mantiene por app.
- `isNavItemActive` pasa a tratar el `basePath` de cada app como hoy trata a `/protected` (para que
  el dashboard de una app no quede activo en todas sus pantallas).
- El nombre del sidebar deja de ser "OwnMonetaryApp" y pasa a ser **OwnWorld**.

### Código por app

El patrón de módulo por entidad de `CLAUDE.md` no cambia: las entidades de las apps nuevas siguen en `lib/schemas/<entity>.ts`, `lib/services/<entity>{,.client}.ts`
y `components/<entity>/`, igual que `accounts` o `debts`. Lo único que se agrupa por app son las
**rutas** (`app/protected/<app>/…`) y el registro. Agregar una carpeta `lib/finance/`, `lib/agenda/`
sería mover cientos de imports para no ganar nada.

---

## 2. Base de datos

Todas las apps comparten el proyecto de Supabase y el schema `public`, con el flujo de siempre de
`docs/supabase.md` (`migration new` → `db:push` → `db:pull` → `db:types`). Un schema por app tendría
sentido con varios despliegues; en una sola app solo agrega fricción (exponerlo en la Data API,
`--schema` en los scripts, `.schema("…")` en cada consulta).

Reglas para toda tabla nueva de cualquier app:

1. **Toda tabla con dueño tiene `user_id uuid not null default auth.uid() references auth.users`** y
   sus cuatro políticas con `(select auth.uid())`, aunque la pertenencia se pueda deducir por una
   tabla padre. `movements` no lo tiene y por eso su RLS necesita un join a `accounts`; no repetirlo.
2. **Entre apps no se copian datos.** Si una app necesita datos de otra, los lee por una RPC que
   expone la app dueña; copiarlos se desincroniza apenas se editan en el origen. Por la misma razón,
   no hay FKs entre tablas de apps distintas.
3. **Lo que se puede calcular al leer no se guarda** (misma regla que `current_balance`, `spent` y
   el estado de las deudas).
4. **Toda agregación va por RPC**, nunca sumando filas en JS (límite de 1000 filas de PostgREST).

El modelo de datos de cada app se define en su propio plan.

---

## 3. Hoja de ruta

Cada fase es un plan propio en `docs/plans/` y el orden importa, porque cada una se apoya en la
anterior.

| Fase | Contenido | Criterio de cierre |
| --- | --- | --- |
| **0. Shell de suite** | `lib/apps/registry.ts`; lanzador en `/protected`; mover finanzas a `/protected/finance/**` con `redirects()` desde las rutas viejas; sidebar y barra móvil por app con `AppSwitcher`; actualizar e2e y `CLAUDE.md`. **Sin cambios funcionales en finanzas.** Plan: `docs/plans/suite-shell-implementation.md`. | `build`, `lint` y `test:e2e` en verde; las URLs viejas redirigen. |
| **1. Calendario** | App `/protected/calendar`. | Se define en su plan. |
| **2. Recordatorios** | App `/protected/reminders` con avisos por Telegram, y `/protected/settings`. | Se define en su plan. |
| **3. Integración con Finanzas** | Vencimientos de deudas en el calendario y avisos de vencimientos. | Se define en su plan. |
| 4. *(opcional)* Contadores del lanzador | Cada tile muestra un contador (deudas vencidas, recordatorios de hoy, eventos de hoy). | El lanzador muestra los contadores. |

---

## Decisiones de nombre

- **Nombre de la suite: OwnWorld.** Reemplaza a "OwnMonetaryApp" en el sidebar, `app/manifest.ts`
  y los `<title>`. La app de finanzas se llama "Finanzas" dentro de la suite.
- **Slugs de rutas en inglés** (`/protected/finance`, `/protected/calendar`,
  `/protected/reminders`, `/protected/settings`), como los actuales. Los textos visibles siguen en
  español.
