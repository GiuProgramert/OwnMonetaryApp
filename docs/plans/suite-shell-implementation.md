# Plan: shell de la suite OwnWorld (lanzador de apps y finanzas bajo /protected/finance)

**Fecha:** 2026-11-16
**Estado:** propuesto — nada implementado todavía

## Objetivo

La app pasa a llamarse **OwnWorld** y se comporta como una suite estilo Odoo. Al iniciar sesión se
ve un **lanzador de apps** en `/protected`. Finanzas, la única app por ahora, vive entera bajo
`/protected/finance/**` con su propio menú. Las URLs viejas (`/protected/movements`, etc.)
redirigen a las nuevas. **Finanzas funciona exactamente igual que hoy**: este plan solo mueve rutas
y cambia la navegación, para que el Calendario y los Recordatorios
([`docs/suite-spec.md`](../suite-spec.md), fases 1 y 2) entren después como apps nuevas sin volver a
tocar finanzas.

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

### Lo que ya existe y hay que reusar

- **`lib/nav-items.ts`** — `NavItem` (`label`, `shortLabel`, `href`, `icon`, `mobilePinned`),
  `navItems` y `isNavItemActive`. El registro de apps (2.1) **absorbe** este archivo: `NavItem` y la
  lógica de `isNavItemActive` se mueven, no se reescriben.
- **`components/sidebar.tsx`** y **`components/mobile-nav.tsx`** — los dos consumidores de
  `navItems`. Conservan su markup y su comportamiento (sidebar colapsable, barra flotante con 4
  ítems fijos + botón "Menú" con `DropdownMenu`); solo cambia **de dónde salen los ítems**.
- **`app/protected/layout.tsx`** — layout compartido (sidebar + contenido + `MobileNav` +
  `Toaster`). No cambia de lugar: sigue envolviendo al lanzador y a todas las apps.
- **`components/app-logo.tsx`** (`AppLogo`), **`components/ui/card.tsx`**,
  **`components/ui/dropdown-menu.tsx`** — primitivas para el lanzador y el `AppSwitcher`.
- **`lib/return-to.ts`** — `resolveReturnTo` acepta cualquier ruta que empiece con `/protected`, así
  que sigue sirviendo para `/protected/finance/...` sin cambios.

### Restricciones

1. **Las rutas de finanzas están escritas a mano en ~150 lugares de 69 archivos** (`href`,
   `router.push`, `revalidateMyDataAndRedirect`, `revalidatePathServer`, `withReturnTo`, `FormContainer
   href`, tests e2e). No hay una constante central. Mover las carpetas sin actualizar cada string deja
   links rotos que **el build no detecta**: son strings, no imports.
2. **`/protected` hoy es el dashboard de finanzas** (`app/protected/page.tsx`) y pasa a ser el
   lanzador. Las URLs del dashboard con filtros (`/protected?accountId=…&startDate=…`) no se pueden
   redirigir en bloque sin redirigir también el lanzador; hay que distinguirlas por query string (3.2).
3. **Los `redirects()` de `next.config.ts` corren antes que el `middleware.ts`.** Un usuario sin
   sesión que abre una URL vieja primero va a la nueva y después el middleware lo manda a
   `/auth/login`, sin loop. **No hay que tocar `lib/supabase/middleware.ts`** en este plan.
4. **`isNavItemActive` trata `/protected` como caso especial** (match exacto, para que el dashboard
   no quede activo en todas las pantallas). Ese caso especial pasa a ser el `basePath` de cada app.
5. **El nombre "OwnMonetaryApp" aparece en `app/layout.tsx` (metadata `title` y `openGraph.title`
   "OwnMonetary"), `app/manifest.ts` (`name`, `short_name`), `components/sidebar.tsx` y
   `components/app-logo.tsx` (`alt` y wordmark)**, y `e2e/auth.spec.ts` lo busca con
   `getByText("OwnMonetaryApp")`.
6. **El login, la actualización de contraseña, el sign-up y el `AuthButton` mandan a `/protected`**
   (`components/login-form.tsx`, `update-password-form.tsx`, `sign-up-form.tsx`, `auth-button.tsx`),
   igual que `start_url` del manifest y `app/protected/not-found.tsx`. Con el lanzador en
   `/protected`, **esos destinos quedan como están**: entrar a OwnWorld es entrar al lanzador.

## Decisiones tomadas

- **Una sola app Next.js con módulos, estilo Odoo, no un monorepo.** Viene de
  [`docs/suite-spec.md`](../suite-spec.md): un login, un deploy (Netlify), una base. Lo que aporta
  Odoo (lanzador + menú por app) es navegación, no despliegue. Contrapartida: el build crece con cada
  app; Next divide el JS por ruta, así que el costo en el navegador es bajo.
- **Nombre: OwnWorld. Slugs en inglés** (`/protected/finance`), como las rutas actuales; los textos
  visibles siguen en español ("Finanzas"). Decidido por el usuario.
- **Finanzas se mueve entera bajo `/protected/finance/**`**, incluido el dashboard (`/protected/finance`).
  Alternativa descartada: dejar las rutas de finanzas donde están y agregar las apps nuevas con
  prefijo. Sin prefijo propio, el sidebar no puede saber a qué app pertenece `/protected/movements`,
  y finanzas quedaría como un caso especial para siempre. Contrapartida: el cambio de la restricción
  1, que se hace una sola vez.
- **Las rutas siguen escritas como strings literales** (`"/protected/finance/movements"`), no con
  una constante o un helper `financePath()`. Es el estilo actual del repo y se encuentra con `grep`.
  Contrapartida: si algún día se vuelve a mover, es otro reemplazo masivo (improbable).
- **Redirecciones `permanent: false` (307)**, no 308. Los navegadores cachean los 308 sin límite;
  un 307 se puede cambiar o sacar sin dejar clientes con la ruta vieja pegada. Contrapartida: ninguna
  relevante para una app personal sin SEO.
- **En el lanzador el sidebar lista las apps y la barra móvil no se muestra.** El lanzador ya es la
  navegación (la grilla de apps), y una barra inferior sin app actual no tendría qué fijar.
  Alternativa descartada: una barra móvil con las apps, que duplicaría la grilla que está en pantalla.
- **El registro solo declara finanzas en este plan.** Calendario y Recordatorios se agregan al
  registro en sus propios planes, cuando tengan rutas. Un tile "Próximamente" sería un link a una
  página que no existe.

## Arquitectura

```
lib/apps/registry.ts           ← NUEVO: AppDefinition, apps[], getCurrentApp, isNavItemActive,
                                  getSidebarItems  (reemplaza lib/nav-items.ts, que se borra)
components/apps/
  app-launcher.tsx             ← NUEVO: grilla de tiles (Server Component)
  app-switcher.tsx             ← NUEVO: dropdown "cambiar de app" del sidebar ("use client")
components/sidebar.tsx         ← usa getSidebarItems(pathname) + AppSwitcher
components/mobile-nav.tsx      ← usa getCurrentApp(pathname); null en el lanzador; fila "Apps" en el menú
app/protected/
  page.tsx                     ← AHORA: lanzador
  finance/
    page.tsx                   ← el dashboard (antes app/protected/page.tsx)
    accounts/ movements/ movement-types/ budgets/ debts/ transfers/   ← movidas tal cual
next.config.ts                 ← redirects() desde las rutas viejas
```

`getCurrentApp(pathname)` es lo que absorbe la variación: cada app nueva es una entrada más en
`apps[]` y una carpeta más en `app/protected/<id>/`.

## Fase 1 — Mover finanzas bajo `/protected/finance`

Mover primero y actualizar los strings en la misma fase: entre 1.1 y 1.3 la app tiene links rotos y
**no se hace commit en el medio**.

- [ ] **1.1** Con `git mv` (para conservar el historial), mover `app/protected/{accounts,movements,
  movement-types,budgets,debts,transfers}` a `app/protected/finance/` y `app/protected/page.tsx` a
  `app/protected/finance/page.tsx`. Renombrar el componente de la página del dashboard de
  `ProtectedPage` a `FinanceDashboardPage`. `app/protected/layout.tsx` y `app/protected/not-found.tsx`
  **no se mueven**.
- [ ] **1.2** Reemplazar en `app/`, `components/` y `lib/` todo string `/protected/<segmento>` con
  `<segmento>` ∈ {`accounts`, `movements`, `movement-types`, `budgets`, `debts`, `transfers`} por
  `/protected/finance/<segmento>`. Incluye `href`, `router.push`, `revalidateMyDataAndRedirect`,
  `revalidatePathServer`, `withReturnTo` (los dos argumentos) y los comentarios
  (`lib/imports/readers/xlsx.ts`). ⚠️ `movement-types` empieza igual que `movements`: hacer el
  reemplazo por segmento completo (`/protected/movements` seguido de `/`, `?`, `` ` ``, `"` o fin
  de string), no por prefijo, para no producir `/protected/finance/finance/...` ni dejar uno sin
  cambiar. **No tocar `e2e/`**: lo actualiza el tester (P.8).
- [ ] **1.3** Las referencias al **dashboard** (no al lanzador) pasan de `/protected` a
  `/protected/finance`. Hoy es una sola: `components/dashboard/upcoming-debts-card.tsx`,
  `withReturnTo(..., "/protected")` → `"/protected/finance"` (después de pagar desde el dashboard se
  vuelve al dashboard, no al lanzador). Las de la restricción 6 **se quedan en `/protected`**.
- [ ] **1.4** Verificación: `grep -rnE "/protected/(accounts|movements|movement-types|budgets|debts|transfers)" app components lib`
  no devuelve nada, y `grep -rn "/protected/finance/finance" app components lib` tampoco. Anotar el
  resultado de ambos comandos al marcar el punto.

## Fase 2 — Registro de apps

- [ ] **2.1** Crear `lib/apps/registry.ts` con:
  - `NavItem` (movido sin cambios desde `lib/nav-items.ts`, con sus comentarios).
  - `AppDefinition { id: "finance"; name: string; description: string; icon: LucideIcon;
    color: string; basePath: string; navItems: NavItem[] }`. El `id` es una unión de literales que
    las apps futuras amplían.
  - `apps: AppDefinition[]` con una sola entrada: `id: "finance"`, `name: "Finanzas"`,
    `description: "Cuentas, movimientos, presupuestos y deudas"`, `icon: Wallet` (lucide),
    `color: "#0F3D2E"` (el `theme_color` del manifest), `basePath: "/protected/finance"`, y
    `navItems` = los 6 ítems actuales de `lib/nav-items.ts` **con los mismos `label`, `shortLabel`,
    `icon` y `mobilePinned`**, y los `href` con el prefijo nuevo (el de "Dashboard" pasa a ser
    `/protected/finance`).
  - `getCurrentApp(pathname: string | null): AppDefinition | undefined` — la app cuyo `basePath` es
    igual a `pathname` o es prefijo seguido de `/`. ⚠️ No usar `startsWith(basePath)` a secas: una
    app futura `/protected/finance-x` matchearía con finanzas.
  - `isNavItemActive(pathname, href, basePath)` — la lógica actual, pero el caso de match exacto
    pasa de `href === "/protected"` a `href === basePath`. En el lanzador (sin app) se llama con
    `basePath = "/protected"`.
  - `getSidebarItems(pathname): { items: NavItem[]; basePath: string }` — dentro de una app, sus
    `navItems` y su `basePath`; en el lanzador (o cualquier ruta sin app), las apps convertidas a
    `NavItem` (`label: name`, `shortLabel: name`, `href: basePath`, `icon`, `mobilePinned: false`) con
    `basePath: "/protected"`.

  El archivo no importa nada de servidor: lo usan `sidebar.tsx` y `mobile-nav.tsx` (`"use client"`) y
  el lanzador (servidor).
- [ ] **2.2** Borrar `lib/nav-items.ts` y actualizar sus dos imports (`components/sidebar.tsx`,
  `components/mobile-nav.tsx`). `grep -rn "nav-items" app components lib` no devuelve nada.

## Fase 3 — Lanzador y redirecciones

- [ ] **3.1** `components/apps/app-launcher.tsx` (Server Component, sin props) y nuevo
  `app/protected/page.tsx` que lo renderiza bajo un `<h1>` "Apps". La página hace el mismo chequeo
  de sesión que el dashboard (`supabase.auth.getClaims()` → `redirect("/auth/login")`). Cada app de
  `apps` es un `<Link href={basePath}>` que envuelve un `<Card>` con: un cuadrado redondeado con
  fondo `color` y el `icon` en blanco, el `name` y la `description` en `text-muted-foreground`.
  Grilla `grid-cols-2` en móvil, `sm:grid-cols-3`, `lg:grid-cols-4`. El link tiene accesible el
  nombre de la app (el tester lo busca con `getByRole("link", { name: /Finanzas/ })`).
- [ ] **3.2** `next.config.ts` — `async redirects()` con `permanent: false`:
  - Para cada segmento de 1.2: `{ source: "/protected/<segmento>/:path*", destination:
    "/protected/finance/<segmento>/:path*" }`. `:path*` también matchea cero segmentos, así que cubre
    el listado.
  - Dashboard con filtros: una regla por cada parámetro del dashboard (`accountId`, `startDate`,
    `endDate`, `dailyRange`, `dailyStart`, `dailyEnd`, `dailyTypes`) con
    `{ source: "/protected", has: [{ type: "query", key: "<param>" }], destination: "/protected/finance" }`.
    ⚠️ Varias condiciones en un mismo `has` son AND; por eso es una regla por parámetro. Next
    conserva el query string en la redirección. `/protected` **sin** esos parámetros no redirige: es
    el lanzador.

  > Los redirects existen por los marcadores, el historial del navegador y la PWA instalada en el
  > celular, que pueden tener guardada una URL vieja. No son la forma de navegar de la app: ningún
  > link interno puede depender de ellos (eso lo garantiza 1.4).

## Fase 4 — Navegación por app

Las fases 4.1 y 4.2 dependen de 2.1; entre sí son independientes.

- [ ] **4.1** `components/apps/app-switcher.tsx` (`"use client"`, prop `collapsed: boolean`):
  `DropdownMenu` cuyo trigger muestra el `icon` y el `name` de la app actual (solo el icono si
  `collapsed`) con `aria-label="Cambiar de app"`. El contenido tiene un ítem "Todas las apps" →
  `/protected` y un ítem por cada app de `apps` (icono + nombre, `asChild` + `Link` como en
  `mobile-nav.tsx`, para que el menú se cierre al navegar). Si no hay app actual, no renderiza nada.
- [ ] **4.2** `components/sidebar.tsx`:
  - El texto "OwnMonetaryApp" pasa a "OwnWorld", y el bloque logo + nombre pasa a ser un
    `<Link href="/protected">` (volver al lanzador, como el logo de Odoo).
  - Debajo del header, `<AppSwitcher collapsed={!open} />`.
  - La lista sale de `getSidebarItems(pathname)` y el activo de
    `isNavItemActive(pathname, item.href, basePath)`. Markup y estilos de los ítems sin cambios.
- [ ] **4.3** `components/mobile-nav.tsx`:
  - `const app = getCurrentApp(pathname)`; si es `undefined` (lanzador), `return null`.
  - `pinnedItems` / `menuItems` salen de `app.navItems` y el activo usa `app.basePath`.
  - En el `DropdownMenuContent`, debajo de la grilla "Más secciones", una segunda sección con el
    título "Apps": un link "Todas las apps" → `/protected` (icono `LayoutGrid`) y un link por cada
    **otra** app de `apps` (hoy ninguna), con el mismo estilo de tile que la grilla de arriba.

## Fase 5 — Nombre OwnWorld

Independiente de las fases 2–4; se puede hacer en cualquier momento después de la 1.

- [ ] **5.1** `app/layout.tsx`: `metadata.title` → `"OwnWorld"`, `openGraph.title` → `"OwnWorld"`.
- [ ] **5.2** `app/manifest.ts`: `name` y `short_name` → `"OwnWorld"`, `description` →
  `"Tus apps personales: finanzas, y lo que venga."`. `start_url` y `scope` **no cambian** (ver el
  comentario del archivo sobre `scope`).
- [ ] **5.3** `components/app-logo.tsx`: `alt` y wordmark → `"OwnWorld"`. El isotipo
  (`public/icon*.{svg,png}`) no cambia (ver *Fuera de alcance*).

## Fase 6 — Cierre

- [ ] **6.1** `npm run lint` y `npm run build`. El build no detecta links rotos (restricción 1):
  repetir los `grep` de 1.4 y 2.2 al final, por si algún punto posterior agregó una ruta vieja.
- [ ] **6.2** `CLAUDE.md`:
  - "Descripción del proyecto": OwnWorld, suite de apps estilo Odoo, finanzas como primera app;
    link a `docs/suite-spec.md`.
  - "Patrón de módulo por entidad": las rutas pasan a `app/protected/<app>/<entity>/...` (hoy
    `app/protected/finance/<entity>/...`).
  - Secciones Dashboard, Presupuestos, Transferencias, Deudas, importación y "Filtro de cuenta":
    actualizar cada ruta `app/protected/...` y `/protected/...` al prefijo `finance`.
  - Nueva subsección **"Apps y navegación (`lib/apps/registry.ts`)"**: el lanzador en `/protected`,
    `getCurrentApp` / `getSidebarItems`, que una app nueva se agrega como una entrada en `apps` más
    una carpeta `app/protected/<id>/`, que los slugs van en inglés, que los redirects de
    `next.config.ts` son solo para URLs viejas y ningún link interno puede depender de ellos, y que
    `mobilePinned` es por app.
  - El párrafo de `components/mobile-nav.tsx` (`NavItem.mobilePinned`) apunta al registro en vez de
    a `lib/nav-items.ts`.
- [ ] **6.3** `docs/database.md` e `docs/imports.md`: actualizar las rutas de pantallas
  (`app/protected/page.tsx` → `app/protected/finance/page.tsx`, `/protected/movements` →
  `/protected/finance/movements`, etc.). **No** tocar `docs/plans/*-implementation.md`: son registros
  históricos de lo que se hizo en su fecha.
- [ ] **6.4** `docs/suite-spec.md`, tabla de la hoja de ruta: fase 0 → "implementada (ver
  `docs/plans/suite-shell-implementation.md`)".
- [ ] **6.5** Notas de cierre al final de este documento — *las escribe el orquestador al terminar
  las pruebas, no el implementador.*

## Criterios de prueba

Tests en `e2e/suite-shell.spec.ts`, salvo P.8, que es la actualización de los specs existentes.
Ningún criterio necesita crear datos, salvo P.4 y P.5, que crean una cuenta propia y la borran en el
`afterAll` (`uniqueName` de `e2e/helpers/supabase.ts`).

- **P.1** (3.1, 5.1–5.3) — Con la sesión del QA, `/protected` muestra el `<h1>` "Apps", un link
  "Finanzas" con el texto "Cuentas, movimientos, presupuestos y deudas", y el título de la pestaña es
  "OwnWorld". El dashboard **no** está en esta página (no aparece el card "Gastos por tipo").
- **P.2** (3.1, 4.2) — Desde `/protected`, clic en el tile "Finanzas" ⇒ URL `/protected/finance` y se
  ve el `<h1>` "Dashboard". En el sidebar (desktop) están los 6 ítems de finanzas ("Dashboard",
  "Cuentas", "Movimientos", "Tipos de movimientos", "Presupuestos", "Deudas") y "Dashboard" tiene
  `aria-current="page"`.
- **P.3** (4.2) — En `/protected` (desktop), el sidebar muestra "OwnWorld" y un ítem "Finanzas"
  (no los 6 ítems de finanzas). En `/protected/finance/accounts`, clic en "OwnWorld" del sidebar ⇒
  vuelve a `/protected`.
- **P.4** (1.1, 1.2, 4.2) — Navegación completa de finanzas sin URLs viejas: creando una cuenta de
  prueba desde `/protected/finance/accounts/create`, el formulario redirige a
  `/protected/finance/accounts` y la cuenta aparece en la tabla. Desde la tabla, "editar" lleva a
  `/protected/finance/accounts/edit/<id>` y la flecha "<" de `FormContainer` vuelve a
  `/protected/finance/accounts`. Durante todo el test, ninguna navegación pasa por una URL sin
  `/finance` (registrar `page.on("framenavigated")` y fallar si alguna URL matchea
  `/\/protected\/(accounts|movements|movement-types|budgets|debts|transfers)/`).
- **P.5** (1.2, 1.3) — Con la cuenta de P.4, crear un movimiento desde
  `/protected/finance/movements/create` ⇒ redirige a
  `/protected/finance/movements?accountId=<id de la cuenta>` (comportamiento actual de "Crear",
  conservado). Con una deuda de prueba cuyo `first_due_date` es hoy (tipo de movimiento existente:
  el QA no puede crear tipos), el link "Pagar" del card "Vencimientos" (`getUpcomingDebts(7)`) en
  `/protected/finance` lleva a `/protected/finance/debts/<id>/pay?returnTo=%2Fprotected%2Ffinance`.
  El test borra el movimiento, la deuda y la cuenta.
- **P.6** (3.2) — Redirecciones: `/protected/movements` ⇒ `/protected/finance/movements`;
  `/protected/movement-types/create` ⇒ `/protected/finance/movement-types/create`;
  `/protected/movements?accountId=all` ⇒ `/protected/finance/movements?accountId=all` (conserva el
  query); `/protected?accountId=all&dailyRange=30d` ⇒ `/protected/finance?accountId=all&dailyRange=30d`;
  `/protected` sin query **no** redirige (se queda en el lanzador).
- **P.7** (4.1, 4.3) — Mobile (viewport de `devices["Pixel 7"]`): en `/protected` no hay barra
  inferior (`getByRole("navigation", { name: "Navegación principal" })` no existe). En
  `/protected/finance` la barra muestra "Inicio", "Cuentas", "Movs.", "Topes" y "Menú"; al abrir
  "Menú" se ven "Tipos de movimientos", "Deudas" y, en la sección "Apps", "Todas las apps", que lleva
  a `/protected`. En desktop, el botón "Cambiar de app" del sidebar abre un menú con "Todas las apps"
  y "Finanzas".
- **P.8** (1.1–1.3, 5.3) — **Specs existentes**: actualizar en `e2e/*.spec.ts` toda URL de finanzas
  al prefijo `/protected/finance` (las de `goto` y las de `toHaveURL`, incluidas las del dashboard
  `/protected?accountId=…` → `/protected/finance?accountId=…`), y en `e2e/auth.spec.ts` el texto
  `"OwnMonetaryApp"` → `"OwnWorld"`. Los specs no deben depender de las redirecciones de 3.2 (eso lo
  prueba P.6). `npm run test:e2e` completo en verde.

**No cubierto por e2e:**

- **El nombre de la PWA instalada** (`app/manifest.ts`) — verificar a mano: abrir `/manifest.webmanifest`
  y ver `"name": "OwnWorld"`. Una PWA ya instalada en el celular puede tardar en tomar el nombre
  nuevo; no se fuerza.
- **`openGraph.title`** — se ve solo al compartir el link; verificar leyendo el `<meta property="og:title">`
  del HTML de `/`.

## Fuera de alcance

- **Calendario y Recordatorios** — tienen sus propios planes (fases 1 y 2 de
  `docs/suite-spec.md`). Este plan no crea sus rutas ni las agrega al registro.
- **Tiles "Próximamente"** en el lanzador para las apps que todavía no existen — serían links a
  páginas inexistentes. Cada app entra al registro cuando tiene rutas.
- **Contadores en los tiles del lanzador** (deudas vencidas, recordatorios de hoy) — fase 4
  opcional de `docs/suite-spec.md`.
- **Isotipo nuevo para OwnWorld** (`public/icon*.svg/png`, `app/apple-icon.png`, `opengraph-image.png`)
  — requiere diseño; se mantiene el actual. El cambio de nombre es solo de texto.
- **Constante o helper central para las rutas** (`financePath(...)`) — descartado en *Decisiones
  tomadas*: el repo escribe rutas literales.
- **Mover `lib/` o `components/` a carpetas por app** (`lib/finance/...`) — el patrón de módulo por
  entidad no cambia; solo se agrupan las rutas. Mover cientos de imports no gana nada.
- **Actualizar rutas en `docs/plans/*-implementation.md`** — son históricos.
- **Página de ajustes `/protected/settings`** — llega con los recordatorios (vinculación de Telegram).
- **Renombrar el repo o el proyecto de Netlify/Supabase** — no afecta a la app.

## Riesgos conocidos

- **Toca todas las pantallas de finanzas.** Un string sin actualizar es un link a una ruta que solo
  funciona por la redirección (si el segmento está en 3.2) o un 404. El `grep` de 1.4/6.1 cubre las
  rutas escritas literalmente; **no cubre rutas armadas por concatenación** (`"/protected/" + x`). Hoy
  no hay ninguna, pero vale revisarlo al ejecutar 1.2 (`grep -rn '"/protected/"' app components lib`).
- **`revalidatePath` con la ruta vieja falla en silencio**: no da error, solo deja la caché del
  listado sin revalidar y la tabla muestra datos viejos después de guardar. P.4 lo cubre para
  cuentas; para el resto depende de que 1.2 haya cambiado los dos argumentos de
  `revalidateMyDataAndRedirect` (ruta a revalidar y destino).
- **Los specs e2e existentes se rompen apenas se mueven las rutas** hasta que el tester los
  actualiza (P.8). Mientras tanto `npm run test:e2e` falla y eso es esperado; no hay que "arreglarlo"
  desde el código de la app.
- **Marcadores con el dashboard y un parámetro que no está en la lista de 3.2** (si se agrega uno
  nuevo al dashboard más adelante) caen en el lanzador en vez del dashboard. Es aceptable; al
  agregar un parámetro nuevo al dashboard no hace falta sumarle redirección.
