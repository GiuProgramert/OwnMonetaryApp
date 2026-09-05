# Plan: ambiente Supabase versionado en el repo

**Fecha:** 2026-08-31
**Estado:** completo, salvo 6.2 (probar la app logueado — requiere sesión humana, ver Notas de cierre).

## Objetivo

Que el esquema de la base (tablas, índices, triggers, funciones RPC y políticas de RLS) viva en el
repo como SQL real y versionado, en vez de estar transcripto a mano en `docs/database.md`. Al
terminar, cualquiera puede leer `supabase/schemas/**` para saber qué hay en la base, aplicar un
cambio de esquema con `supabase db push` en vez de pegar SQL en el editor web, y regenerar los tipos
TypeScript desde la base con un `npm run db:types`.

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

Y una regla propia de este plan, porque acá se toca la base de producción y no hay otra:

> **Ningún punto de este plan modifica el esquema remoto.** Si te encontrás por escribir un
> `create`, `alter` o `drop` que corra contra Supabase, estás fuera del plan: pará y preguntá. La
> única migración que se crea (3.4) se registra sin ejecutarse (3.5).

## Contexto

### Lo que ya existe y hay que reusar

- **El SQL del estado actual ya está escrito, no se inventa.** Los cuerpos de `update_updated_at` y
  `update_account_balance`, el índice único `movements (account_id, external_id)` y la forma de las
  políticas de RLS están en [`docs/database.md`](../database.md). Las tres funciones RPC del
  dashboard están completas, con sus `grant execute`, en
  [`docs/plans/dashboard-implementation.md`](dashboard-implementation.md), puntos 2.1, 2.2 y 2.3.
  La baseline de la Fase 3 se arma con eso más lo que devuelva el export declarativo.
- **`lib/supabase/client.ts`, `lib/supabase/server.ts` y `lib/supabase/middleware.ts`** — los tres
  constructores de cliente. Son los únicos tres lugares donde entra el tipo `Database` en la Fase 4.
- **Los tres call sites de `rpc()`**, que hoy castean el resultado a mano y son lo que la Fase 4
  limpia: `lib/services/dashboard.ts:39` (`get_expenses_by_movement_type`),
  `lib/services/dashboard.ts:90` (`get_monthly_flow`) y `lib/services/movements.ts:85`
  (`get_movements_totals`).
- **`docs/database.md` no se tira**: la parte que explica *por qué* las cosas son como son sobrevive
  (decisión 1). Lo que sale es el SQL duplicado.

### Restricciones

Verificadas en esta máquina el 2026-08-31, corriendo los comandos contra un Postgres local de
prueba. No son teoría: cada una salió de un comando que falló o funcionó.

1. **No hay Docker en esta distro WSL2.** El binario existe en `/mnt/c/Program Files/Docker/...`
   pero la integración WSL de Docker Desktop está apagada: `The command 'docker' could not be found
   in this WSL 2 distro`. Consecuencia directa: `supabase start`, `supabase db diff`,
   `supabase db pull` en modo migración (con `migra` **y** con `pg-delta`) y
   `supabase gen types --db-url/--local` **no corren**. Los tres primeros mueren en
   `Creating shadow database...` → `LegacyImagePrepullError`: necesitan un Postgres 17 vacío para
   replayar las migraciones y comparar, y ese Postgres sale de una imagen de contenedor.
2. **`supabase db pull --declarative` es el único `pull` que funciona sin Docker.** Usa pg-delta
   embebido en el binario del CLI: introspecciona la base por la conexión y escribe los `.sql`
   directamente, sin comparar contra nada, así que no levanta shadow DB. En la prueba capturó
   tablas, columnas, FKs, índice único, trigger, función con `search_path`,
   `ENABLE ROW LEVEL SECURITY` y la policy completa — es decir, todo lo que hoy está a mano en
   `docs/database.md`.
3. **`db push`, `migration list`, `migration repair` y `link` tampoco necesitan Docker**: conectan
   por el protocolo Postgres. `gen types --linked` / `--project-id` va por la API de management
   (HTTPS) y falla con `Access token not provided`, no por Docker. Todo el plan se apoya en estos.
4. **El `pg_dump` de la máquina es 14.24 y el server de Supabase es 17.** El fallback manual
   ("me traigo el dump con pg_dump y listo") aborta por versión. No hay atajo por afuera del CLI.
5. **El proyecto remoto no tiene historial de migraciones**: nunca se usó el CLI contra él. Una
   migración baseline con el esquema actual **no se puede aplicar** (los objetos ya existen), hay
   que registrarla como aplicada con `migration repair`.
6. **Las credenciales del CLI no están en `.env.local`**, que solo tiene `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` y `NEXT_PUBLIC_BASE_URL`. Hacen falta un Personal Access
   Token y el password de la base (ver *Dependencias externas*).
7. **La conexión va por el pooler**, que es el default de `link`. La conexión directa
   (`db.<ref>.supabase.co`) es IPv6-only y WSL2 habitualmente no la resuelve. No pasar
   `--skip-pooler`.
8. **La base remota es producción y es la única que hay.** Al quedar el stack local fuera de alcance
   (decisión 4), no existe ambiente donde ensayar. Es la restricción que hace que este plan sea de
   solo lectura contra Supabase.
9. **La RLS es la única barrera de seguridad de la app** (`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   viaja en el bundle del browser). Ningún punto de este plan la toca, y 6.3 verifica que siga en pie.

## Decisiones tomadas

- **`docs/database.md` se poda al "por qué", no se borra.** Se queda con lo que el SQL exportado no
  dice: que el `CASE` sin `ELSE` de `update_account_balance` deja el saldo en `NULL` sin lanzar
  error, que `accounts.updated_at` se bumpea con cada movimiento y no significa "última edición de
  la cuenta", que el saldo es incremental y no recalculado, las queries de diagnóstico y reparación
  de descuadre, y por qué la RLS es la única barrera. Sale todo el SQL duplicado (cuerpos de
  funciones, DDL de políticas, `create index`), que pasa a vivir en `supabase/schemas/**`.
  *Contrapartida:* quedan dos lugares que hablan de la base y hay que saber cuál manda —
  `supabase/schemas/**` es el qué, `docs/database.md` es el por qué. El punto 5.1 lo dice en la
  primera línea del doc, justamente para que no se relitigue.
- **Esquema declarativo + migraciones escritas a mano.** El árbol `supabase/schemas/**` documenta el
  estado; `supabase/migrations/` lleva el historial, arrancando por una baseline registrada con
  `repair`. La alternativa era quedarse solo con el árbol declarativo: más barato, pero sin historial
  ni forma de reproducir la base. *Contrapartida:* sin Docker no hay `db diff`, así que el SQL de
  cada cambio futuro se escribe a mano (`supabase migration new` + editar el archivo). Es más
  trabajo por cambio, y es el precio de no tener el stack local.
- **Tipos generados, acotados a los clientes y a los `rpc()`.** Entra la Fase 4, pero sin tocar
  `lib/schemas/*.ts`. La alternativa era migrar también `Account`, `Movement` y `MovementType` a los
  tipos generados: mucho churn en código que funciona, y los tipos generados describen tablas
  crudas, no los `select` con joins que usan los servicios (`Movement` embebe
  `accounts: Pick<Account, ...>` y `movement_types: Pick<...>`, que ningún tipo generado expresa).
  *Contrapartida:* conviven dos fuentes de tipos, y hay que saber cuál usar — la regla queda escrita
  en 4.4.
- **El stack local con Docker queda fuera de alcance**, por pedido explícito del usuario en la
  conversación del 2026-08-31. *Contrapartida:* nadie va a poder correr `supabase db reset` para
  probar que la baseline reconstruye el esquema desde cero. Es el riesgo principal de este plan y
  está anotado como tal.

## Dependencias externas

Las tres son **bloqueantes** y ninguna está en el repo. Sin ellas la Fase 2 no arranca, y las
Fases 3, 4 y 5 dependen de la 2.

1. **Un Personal Access Token de Supabase** (Dashboard → Account → Access Tokens), exportado como
   `SUPABASE_ACCESS_TOKEN`. ⚠️ La alternativa, `supabase login`, abre un browser: **un agente no
   puede completarla**. Si estás implementando esto como agente, pedile al usuario que corra
   `! supabase login` en la terminal, o que te pase el token por el entorno.
2. **El password de la base** del proyecto (Dashboard → Project Settings → Database). El CLI lo lee
   de `SUPABASE_DB_PASSWORD` o lo pide interactivo.
3. **El project ref**, que sale del `NEXT_PUBLIC_SUPABASE_URL` de `.env.local`:
   `https://<ref>.supabase.co`.

⚠️ **Ni el token ni el password van a `.env.local`.** No son variables de la app: van en el entorno
de la shell. Y `.env.local` ya viaja mezclado con `NEXT_PUBLIC_*`, que terminan en el bundle del
browser.

## Fase 1 — CLI y estructura del proyecto

- [x] **1.1** `npm i -D supabase` (hoy `2.116.0`). Como dependencia de desarrollo, no global: así la
  versión queda fija en `package-lock.json` y no depende de qué tenga instalado cada máquina.
- [x] **1.2** `npx supabase init` → crea `supabase/config.toml`. Responder que no a los archivos de
  VS Code / Deno si los ofrece: este repo no usa Edge Functions.
- [x] **1.3** `.gitignore`: agregar `supabase/.temp/` y `supabase/.branches/`. `config.toml`,
  `migrations/` y `schemas/` **sí se commitean** — son el objetivo del plan.
- [x] **1.4** Scripts en `package.json`, para que los flags que sí funcionan sin Docker queden
  escritos y nadie tenga que redescubrirlos:
  ```json
  "db:pull":  "supabase db pull --declarative --schema public --strict-coverage",
  "db:push":  "supabase db push --linked",
  "db:list":  "supabase migration list --linked",
  "db:types": "supabase gen types typescript --linked --schema public > lib/supabase/database.types.ts"
  ```
  ⚠️ `db:types` con `>` **trunca el archivo antes de que corra el comando**: si el comando falla
  (token vencido, red caída), te quedás con un `database.types.ts` vacío y el build roto. Si pasa,
  volvé a correrlo; no lo "arregles" a mano.
- [x] **1.5** ⚠️ `major_version` en `config.toml` viene en `17` por default y **tiene que coincidir
  con el server remoto**. Se corrige en 2.4, cuando ya haya conexión para preguntárselo a la base.
  No adivinarlo acá.

## Fase 2 — Vinculación con el proyecto remoto

Depende de las tres *Dependencias externas*. Nada de esta fase funciona sin ellas.

- [x] **2.1** Exportar `SUPABASE_ACCESS_TOKEN` (o `supabase login`, con la salvedad de la dependencia 1).
- [x] **2.2** `supabase link --project-ref <ref>`. ⚠️ **No pasar `--skip-pooler`** (restricción 7).
- [x] **2.3** `supabase migration list --linked`. Tiene que mostrar el historial remoto **vacío**.
  Si mostrara migraciones, este plan parte de una premisa falsa (restricción 5): **pará y preguntá**.
  Confirmado vacío (`{"migrations":[],...}`).
- [x] **2.4** Correr `show server_version;` contra la base (SQL editor del dashboard o
  `supabase db push --dry-run` no sirve para esto) y ajustar `major_version` en
  `supabase/config.toml` al major real. Cierra 1.5. `show server_version;` vía `psql` (pooler) dio
  `17.6`; `major_version` ya estaba en `17`, no hizo falta editar `config.toml`.

## Fase 3 — El esquema entra al repo

Es el corazón del plan: al terminar esta fase, `docs/database.md` deja de ser la fuente de verdad.

- [x] **3.1** `npm run db:pull` (es decir
  `supabase db pull --declarative --schema public --strict-coverage`) → escribe
  `supabase/schemas/public/{tables,functions}/*.sql` y un `.pgdelta-export.json` con el orden de
  carga. ⚠️ Tres cosas sobre esos flags, y ninguna es opcional:
  - **`--declarative`** es lo que lo hace correr sin Docker (restricción 2). Sin ese flag el comando
    intenta levantar una shadow DB y falla.
  - **`--schema public`** evita arrastrar los schemas administrados por Supabase (`auth`, `storage`,
    `realtime`), que no son nuestros y no queremos versionar.
  - **`--strict-coverage`** hace que el comando **falle** si pg-delta encuentra objetos que no sabe
    manejar, en vez de dejarlos afuera en silencio. Sin esto, un objeto no soportado desaparece del
    export sin avisar y creés que tenés el esquema completo.
- [x] **3.2** Verificar el inventario del export contra `docs/database.md` **antes** de seguir. Tienen
  que estar: las 3 tablas (`accounts`, `movements`, `movement_types`); el índice único
  `movements (account_id, external_id)`; los 4 triggers (`trigger_accounts_updated_at`,
  `trigger_movement_types_updated_at`, `trigger_movements_updated_at`,
  `trigger_update_account_balance`); las funciones `update_updated_at` y `update_account_balance`;
  las 3 RPC (`get_expenses_by_movement_type`, `get_movements_totals`, `get_monthly_flow`) con su
  `security invoker` y su `set search_path = ''`; `ENABLE ROW LEVEL SECURITY` en `accounts`,
  `movements` y `movement_types`; y las políticas de las tres tablas. **Si falta algo, pará y
  preguntá** — un export incompleto que se commitea es peor que el doc a mano, porque parece
  autoritativo.
- [x] **3.3** Revisar el SQL exportado antes de commitear: `OWNER TO`, `GRANT`/`REVOKE` y cualquier
  referencia a roles que solo existan en ese proyecto. No hay que "limpiarlo" por prolijidad — hay
  que entender qué quedó, porque es lo que la baseline de 3.4 va a declarar como estado inicial.
  Solo boilerplate estándar de Supabase (grants a `anon`/`authenticated`/`service_role`/`postgres`,
  extensiones `pgcrypto` y `uuid-ossp`), nada específico del proyecto que limpiar.
- [x] **3.4** `supabase migration new baseline_schema` y llenar el archivo con el esquema actual
  completo, armado desde `supabase/schemas/**` (3.1) más el SQL que ya está escrito en
  `docs/database.md` y en `docs/plans/dashboard-implementation.md` 2.1–2.3. ⚠️ **Esta migración no
  se pushea nunca**: el remoto ya tiene todos esos objetos y `db push` fallaría a mitad de camino,
  dejando el historial en un estado ambiguo.
- [x] **3.5** `supabase migration repair --status applied <version> --linked`, con el timestamp del
  archivo de 3.4. Registra la baseline como aplicada sin ejecutarla. ⚠️ El comando **exige que el
  archivo exista** en `supabase/migrations/`: si lo renombrás después, el historial deja de cerrar.
- [x] **3.6** `npm run db:list` (`migration list --linked`): local y remoto tienen que mostrar la
  misma única versión. Esa igualdad es la señal de que la Fase 3 terminó bien. Confirmado:
  `20260903191748` en ambos lados.
- [x] **3.7** Commit de `supabase/` completo. A partir de acá, **todo cambio de esquema es
  `supabase migration new` + `npm run db:push`**, nunca SQL pegado en el editor web.

> **Por qué la baseline se escribe a mano y no sale de `db pull`.** El `db pull` en modo migración
> —el que genera el archivo de migración solo— necesita la shadow DB, y la shadow DB necesita Docker
> (restricción 1). El modo declarativo sí corre, pero por diseño *no* crea migraciones ni toca el
> historial (lo dice su propia ayuda). De ahí el rodeo: exportar declarativo, transcribir a una
> migración, y registrarla con `repair`.

## Fase 4 — Tipos generados

Depende de la Fase 2 (necesita el link y el token). No depende de la Fase 3: podría hacerse antes,
pero se hace después porque el orden natural es tener el esquema versionado primero.

- [x] **4.1** `npm run db:types` → `lib/supabase/database.types.ts`. ⚠️ Tiene que ser `--linked`
  (API de management): `--db-url` y `--local` levantan un contenedor y fallan (restricción 1).
  El archivo **se commitea**: es lo que hace que el build funcione sin credenciales de Supabase.
- [x] **4.2** Tipar los tres constructores con `<Database>`: `createBrowserClient<Database>` en
  `lib/supabase/client.ts`, `createServerClient<Database>` en `lib/supabase/server.ts` y en
  `lib/supabase/middleware.ts`. ⚠️ En `middleware.ts`, **no reordenar nada alrededor de
  `supabase.auth.getClaims()` ni tocar el forwarding de cookies** — está marcado en el propio
  archivo como causa de pérdida aleatoria de sesión. Acá solo se agrega un parámetro de tipo.
- [x] **4.3** Sacar los casts de los tres `rpc()`, que con los tipos generados quedan redundantes:
  `lib/services/dashboard.ts:49` (`as { movement_type_id: string; ... }[]`),
  `lib/services/dashboard.ts:100` (`as { month: string; income: number; expense: number }[]`) y
  `lib/services/movements.ts:96` (`as { income: number; expense: number }[]`).
  ⚠️ **No cambiar el comportamiento de los `?? []` / `?? { income: 0, expense: 0 }` ni el relleno de
  meses vacíos de `getMonthlyFlow`**: `get_monthly_flow` sigue devolviendo solo los meses con
  movimientos, y eso no lo arregla ningún tipo.
  Efecto colateral no listado explícitamente pero dentro del alcance de 4.2: tipar
  `lib/supabase/client.ts` volvió estricto el tipo de `data` en `lib/services/movements.client.ts`
  (antes `any`), rompiendo el cast `data as Movement` en `createMovement`/`updateMovement` (la fila
  cruda no tiene los joins `accounts`/`movement_types` que sí tiene `Movement`). Cambiado a
  `data as unknown as Movement`, sin tocar `lib/schemas/movements.ts` (4.4). También los `?? null`
  en los 3 call sites de `rpc()` pasaron a `?? undefined`: los `Args` generados usan parámetros
  opcionales (`undefined`), no `| null`.
- [x] **4.4** **No tocar `lib/schemas/*.ts`.** La regla, que va escrita en `CLAUDE.md` en 5.3:
  `database.types.ts` describe las tablas crudas y se usa para tipar los clientes y los `rpc()`;
  `lib/schemas/*.ts` describe las formas que devuelven los servicios (con joins) y valida los
  formularios con Zod. Son fuentes distintas para cosas distintas. No se tocó.
- [ ] **4.5** Dejar escrito el ciclo: después de cada `npm run db:push`, correr `npm run db:types` y
  commitear el archivo regenerado. Va en `docs/supabase.md` (5.2). Pendiente — se hace junto con 5.2.

## Fase 5 — Documentación

- [x] **5.1** Podar `docs/database.md` según la decisión 1. **Primera línea del doc**: que el esquema
  vive en `supabase/schemas/**` y que este archivo explica lo que ese SQL no dice. Se queda: reglas
  para la aplicación (nunca escribir `updated_at` ni `current_balance`, `type` solo `credit`/`debit`),
  efectos secundarios (el `CASE` sin `ELSE`, el `updated_at` engañoso, el saldo incremental), las
  queries de descuadre, el efecto secundario del `upsert` con `onConflict`, y la sección de RLS con
  el `curl` anónimo. Se van: cuerpos de funciones, DDL de políticas, `create index`, tabla de
  triggers.
  ⚠️ **Conservar los anchors** `#descuadre-de-saldos`, `#row-level-security-rls`,
  `#índices-y-restricciones` y `#funciones-rpc-del-dashboard`: los linkean `docs/imports.md:42`,
  `CLAUDE.md` (líneas 41, 45 y 64) y los tres planes de `docs/plans/`. Si una sección desaparece,
  el link queda roto — ver 6.4. Los 4 anchors se conservaron (verificado contra los backlinks).
- [x] **5.2** Escribir `docs/supabase.md`: cómo se cambia el esquema de acá en adelante
  (`migration new` → editar el SQL → `db push` → `db pull` declarativo → `db:types`), qué
  credenciales hacen falta y de dónde salen, y —lo más importante— **qué comandos no funcionan en
  esta máquina y por qué** (`start`, `db diff`, `db reset`, `gen types --local`), para que la próxima
  sesión no pierda media hora redescubriéndolo. Incluye también el ciclo de 4.5 y por qué la
  baseline no está verificada.
- [x] **5.3** Actualizar `CLAUDE.md`: la línea 41 ("The schema has no versioned migrations in this
  repo — triggers, functions and RLS policies live only in Supabase") deja de ser cierta. Reapuntar
  las referencias de las líneas 41, 45 y 64 a `supabase/schemas/**` para el SQL y a
  `docs/database.md` para el porqué, y agregar la regla de tipos de 4.4.
- [x] **5.4** *(opcional)* Nota de una línea en `docs/plans/dashboard-implementation.md` diciendo que
  el SQL de sus puntos 2.1–2.3 ahora vive versionado en `supabase/schemas/public/functions/`. El plan
  viejo no se reescribe — es un registro histórico.

## Fase 6 — Cierre

- [x] **6.1** `npm run lint` y `npm run build`. La Fase 4 es la única que puede romper el build:
  los tipos generados son más estrictos que los `as` que reemplazan, y es esperable que aparezcan
  errores en los tres call sites de 4.3. `tsc --noEmit` y `npm run build` limpios (ver Fase 4).
  `npm run lint` sobre todo el repo falla con ~47k errores, pero por un problema preexistente no
  relacionado a este plan: `eslint.config.mjs` no excluye `public/pdf.worker.min.mjs` (archivo
  minificado generado por el script `postinstall`). Lint acotado a los archivos tocados por este
  plan da limpio.
- [ ] **6.2** Probar los bordes en la app corriendo, logueado — **pendiente, requiere sesión humana**
  (login no se puede automatizar sin credenciales). Dev server levantado en `http://localhost:3000`
  para que lo pruebe el usuario:
  - login y navegación por `app/protected/` (valida que 4.2 no rompió el middleware);
  - el dashboard con las 3 RPC, filtrando por cuenta y por rango de fechas;
  - la tabla de movimientos con sus totales (`getMovementsTotals`, la cuarta llamada a RPC);
  - una reimportación de un extracto ya importado: no tiene que duplicar movimientos ni mover el
    saldo (dedupe por `external_id`).
- [x] **6.3** Re-verificar la RLS con el `curl` anónimo de `docs/database.md`. Este plan no la toca,
  y justamente por eso el resultado tiene que ser idéntico al de antes. Confirmado: `[]`.
- [x] **6.4** Verificar que ningún link a `docs/database.md` quedó roto después de 5.1: `imports.md`,
  `CLAUDE.md` y los tres planes de `docs/plans/`. Los 4 anchors (`#descuadre-de-saldos`,
  `#row-level-security-rls`, `#índices-y-restricciones`, `#funciones-rpc-del-dashboard`) están
  presentes como headings en el doc podado.
- [x] **6.5** Notas de cierre al final de este documento. Decir explícitamente **que la baseline no
  se pudo verificar** (ver Riesgos) — es lo más importante que va a leer el próximo.

## Fuera de alcance

- **El stack local con Docker** — `supabase start`, `supabase db reset`, `supabase db diff`. Sacado
  por pedido explícito del usuario el 2026-08-31, después de confirmar que la integración WSL de
  Docker Desktop está apagada (restricción 1). Para que entre haría falta habilitarla en Docker
  Desktop; ahí se desbloquearían las migraciones generadas automáticamente y la verificación de la
  baseline. **No lo re-agregues por iniciativa propia.**
- **Reemplazar los tipos a mano de `lib/schemas/*.ts`** por los generados. Descartado en la decisión
  3: mucho churn en código que funciona, y los tipos generados no expresan los `select` con joins.
- **Cualquier cambio al esquema remoto.** Este plan no crea, modifica ni borra tablas, funciones,
  triggers, índices ni políticas: solo lee la base y escribe archivos en el repo. La única migración
  que aparece (3.4) se registra sin ejecutarse.
- **CI que corra `db push`.** No hay CI en el repo (no existe `.github/`), y montarlo es otro plan.
- **Branching de Supabase / ambiente de staging.** Requiere plan pago y decisiones de infraestructura
  que exceden esto.
- **Seeds (`supabase/seed.sql`).** Sin `db reset` no hay dónde usarlos (consecuencia de la decisión 4).

## Riesgos conocidos

1. **La baseline no se puede probar.** `supabase db reset` —el comando que reconstruye la base desde
   las migraciones y demuestra que la baseline es correcta— necesita Docker. Si el SQL de 3.4 no
   refleja exactamente el remoto, la divergencia queda registrada como "aplicada" (3.5) y **no la
   detecta nadie** hasta que alguien intente reconstruir la base en otro proyecto. Mitigación:
   derivar 3.4 del export declarativo de 3.1, nunca de memoria, y hacer el inventario de 3.2 en
   serio.
2. **`migration repair` marca aplicada una migración que nunca corrió.** Es la operación de más
   riesgo del plan y es irreversible en la práctica (se puede volver a reparar como `reverted`, pero
   el historial queda sucio). Ejecutar 3.5 solo después de que 3.2 y 3.4 estén revisados.
3. **`db push` va directo contra producción.** No hay staging (restricción 8). Ningún punto de este
   plan pushea, pero el flujo que queda instalado sí, y quien lo use después tiene que saberlo:
   `--dry-run` primero, siempre. Va escrito en `docs/supabase.md` (5.2).
4. **La Fase 4 toca `lib/supabase/middleware.ts`**, que es código sensible a la sesión. El síntoma de
   romperlo no es un error: es que los usuarios pierden la sesión al azar. Por eso 4.2 se limita a
   agregar un parámetro de tipo y 6.2 empieza probando el login.
5. **El export declarativo podría no capturar algún objeto.** `--strict-coverage` (3.1) convierte eso
   en un fallo visible en vez de una omisión silenciosa, pero si el comando falla por esa razón,
   **es información, no un obstáculo a saltear**: significa que hay algo en la base que el árbol
   declarativo no va a poder representar. Pará y preguntá.
6. **`docs/database.md` podado puede perder algo que solo estaba ahí.** El SQL se va porque queda en
   `supabase/schemas/**`, pero cualquier párrafo explicativo pegado a ese SQL se va con él si no se
   mira. 5.1 lista qué se queda; conviene releer el diff completo antes de commitear.

## Notas de cierre

Implementado 2026-09-03. Las seis fases se ejecutaron en orden, sin desviarse del plan en alcance.
Dos cosas no anticipadas explícitamente por el plan, ambas dentro de su alcance real:

- **4.3 tuvo un cuarto call site no listado.** Tipar `lib/supabase/client.ts` con `<Database>`
  (4.2) volvió estricto el tipo de `data` en `lib/services/movements.client.ts` (antes `any`),
  rompiendo el cast `data as Movement` en `createMovement`/`updateMovement` — la fila cruda de un
  `insert`/`update` no tiene los joins (`accounts`, `movement_types`) que sí tiene `Movement`. Se
  resolvió con `data as unknown as Movement`, sin tocar `lib/schemas/movements.ts` (respeta 4.4).
  También los `?? null` de los tres `rpc()` pasaron a `?? undefined`: los `Args` generados usan
  parámetros opcionales, no `| null`.
- **`npm run lint` sobre todo el repo falla con ~47k errores, sin relación con este plan.**
  `eslint.config.mjs` no excluye `public/pdf.worker.min.mjs` (un archivo minificado generado por
  el script `postinstall`, ya en `.gitignore` pero no en las reglas de eslint). Es un problema
  preexistente del repo — no se tocó, está fuera de alcance. Lint acotado a los archivos que este
  plan modificó da limpio.

**Qué se verificó:**
- El inventario completo del export declarativo (3.2) contra `docs/database.md`: las 3 tablas, el
  índice único, los 4 triggers, las 5 funciones (2 de trigger + 3 RPC) con `security invoker`
  (default, sin `security definer`) y `set search_path = ''`, RLS activada y las políticas de las
  3 tablas — todo presente.
- `migration list --linked` muestra la misma versión en local y remoto (`20260903191748`).
- `tsc --noEmit`, `npm run build`, y `eslint` acotado a los archivos tocados: limpios.
- Los 4 anchors de `docs/database.md` referenciados desde otros documentos siguen resolviendo.
- La RLS responde igual que antes (`curl` anónimo → `[]`).

**Qué NO se pudo verificar — es lo más importante de esta nota:**
- **La migración baseline (3.4) no está probada.** `supabase db reset`, el único comando que la
  reconstruye desde cero y demuestra que coincide con el remoto, necesita Docker (fuera de
  alcance, restricción 1 y riesgo 1 del plan). Se derivó del export declarativo de 3.1 y se
  revisó a mano (3.2, 3.3), pero **si hay una divergencia, nadie la va a detectar hasta que
  alguien intente reconstruir la base en otro proyecto.** Sigue siendo el riesgo principal del
  plan, sin mitigar.
- **6.2 (probar la app logueado) no se ejecutó.** Requiere una sesión humana en el browser —no se
  puede automatizar sin credenciales—, así que se dejó el dev server corriendo en
  `http://localhost:3000` para que el usuario lo pruebe: login, dashboard con las 3 RPC filtrando
  por cuenta y fecha, tabla de movimientos con totales, y una reimportación de un extracto ya
  importado (dedupe por `external_id`). Hasta que esto se pruebe, 4.2 (tipar `middleware.ts`) no
  está confirmado en el único escenario que realmente importa: que nadie pierda la sesión.
- Todos los cambios de las Fases 1–5 quedaron **staged, sin commitear** — la config global del
  usuario tiene un `deny` en `git commit *`/`git push *`. El commit queda pendiente de que el
  usuario lo haga (o lo autorice explícitamente).
