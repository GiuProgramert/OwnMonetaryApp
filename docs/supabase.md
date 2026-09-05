# Flujo de trabajo con Supabase

Este proyecto usa el CLI de Supabase (`supabase`, instalado como dev dependency — ver
`package.json`) para versionar el esquema en el repo, en vez de pegar SQL en el editor web. El
esquema declarativo vive en `supabase/schemas/**` (el *qué*); `docs/database.md` explica el *por
qué* — reglas de la app, efectos secundarios, queries de diagnóstico.

## Cómo cambiar el esquema

1. `npx supabase migration new <nombre_descriptivo>` → crea un archivo vacío en
   `supabase/migrations/`.
2. Escribir el SQL del cambio a mano en ese archivo.
3. `npm run db:push` (`supabase db push --linked`) — aplica la migración contra el proyecto remoto.
   ⚠️ **Esto va directo contra producción, no hay staging.** Correr `supabase db push --linked
   --dry-run` primero, siempre, para ver qué se va a ejecutar antes de confirmarlo.
4. `npm run db:pull` (`supabase db pull --declarative --schema public --strict-coverage`) —
   re-exporta `supabase/schemas/**` desde el estado real de la base, para que el árbol declarativo
   quede al día con lo que efectivamente se aplicó.
5. `npm run db:types` (`supabase gen types typescript --linked --schema public >
   lib/supabase/database.types.ts`) — regenera los tipos y commitear el archivo. ⚠️ El `>` trunca el
   archivo antes de correr el comando: si falla (token vencido, red caída), el archivo queda vacío y
   el build se rompe. Si eso pasa, volver a correr el comando — no "arreglar" el archivo a mano.

Este ciclo (`migration new` → editar → `db:push` → `db:pull` → `db:types` → commit) es el único
camino para cambiar el esquema. No hay `supabase db diff` en esta máquina (ver más abajo el porqué),
así que no hay forma de generar la migración automáticamente: se escribe a mano.

## Credenciales

Ninguna de las dos va a `.env.local` — no son variables de la app, y `.env.local` ya viaja mezclado
con `NEXT_PUBLIC_*`, que terminan en el bundle del browser.

- **`SUPABASE_ACCESS_TOKEN`** — Personal Access Token, Dashboard → Account → Access Tokens.
  Alternativa: `supabase login` (abre un browser).
- **`SUPABASE_DB_PASSWORD`** — password de la base, Dashboard → Project Settings → Database. El CLI
  lo lee de la env var o lo pide interactivo.

El project ref sale de `NEXT_PUBLIC_SUPABASE_URL` en `.env.local` (`https://<ref>.supabase.co`).

## Qué comandos no funcionan en esta máquina, y por qué

**No hay Docker en esta distro WSL2** (el binario existe en `/mnt/c/Program Files/Docker/...`, pero
la integración WSL de Docker Desktop está apagada). Consecuencia directa:

| Comando | Por qué falla |
| --- | --- |
| `supabase start` | Necesita levantar los contenedores del stack local. |
| `supabase db diff` | Necesita una shadow DB (un Postgres 17 vacío) para comparar contra las migraciones — sale de una imagen de contenedor. |
| `supabase db reset` | Reconstruye la base local desde las migraciones — mismo problema de shadow DB. |
| `supabase db pull` (modo migración, sin `--declarative`) | También arma shadow DB para generar el archivo de migración por diff. |
| `supabase gen types --db-url` / `--local` | Levantan un contenedor para leer el esquema. |

**Lo que sí funciona sin Docker**, porque conecta directo por el protocolo Postgres o por HTTPS
(API de management), no por contenedor:

- `supabase db pull --declarative` — usa `pg-delta` embebido en el binario del CLI: introspecciona
  la base por conexión directa y escribe los `.sql`, sin comparar contra nada ni levantar shadow DB.
  Es el único `pull` disponible acá, y por eso el árbol de `supabase/schemas/**` es declarativo y no
  hay migraciones autogeneradas.
- `supabase db push`, `migration list`, `migration repair`, `link` — conectan por el protocolo
  Postgres.
- `supabase gen types --linked` / `--project-id` — va por la API de management (HTTPS).

Otras dos restricciones de esta máquina, para no volver a redescubrirlas:

- **El `pg_dump` local es 14.24 y el server de Supabase es 17.** El fallback manual
  ("`pg_dump` y listo") aborta por versión — no hay atajo por afuera del CLI.
- **La conexión va por el pooler**, el default de `supabase link`. La conexión directa
  (`db.<ref>.supabase.co`) es IPv6-only y WSL2 habitualmente no la resuelve — no pasar
  `--skip-pooler`.

## Por qué la baseline se escribió a mano

El proyecto remoto no tenía historial de migraciones (nunca se usó el CLI contra él). Una migración
baseline con el esquema actual no se puede aplicar tal cual —los objetos ya existen—, así que se
registró como aplicada con `supabase migration repair --status applied <version> --linked`, sin
ejecutarla.

Esa baseline (`supabase/migrations/<timestamp>_baseline_schema.sql`) se escribió a mano en vez de
generarse con `db pull` en modo migración, porque ese modo necesita la shadow DB (Docker). El modo
declarativo sí corre, pero por diseño no crea migraciones ni toca el historial. De ahí el rodeo:
exportar declarativo (`db:pull`), transcribir el SQL a una migración en orden de dependencias reales
(extensiones → tablas → funciones → triggers → RLS → grants — el orden que necesita un `CREATE`
lineal, no el orden de carga de `db pull`, que agrupa distinto), y registrarla con `repair`.

⚠️ **Esa migración baseline no está verificada.** `supabase db reset` —el comando que la probaría,
reconstruyendo la base desde cero— necesita Docker. Si en algún momento se habilita la integración
Docker Desktop en WSL2, correr `supabase db reset` contra un proyecto de prueba y comparar el
resultado contra `supabase/schemas/**` es la forma de cerrar ese riesgo.

## Tipos generados vs. tipos a mano

`lib/supabase/database.types.ts` (generado, `npm run db:types`) describe las tablas crudas tal como
están en Postgres. Se usa para tipar los tres constructores de cliente
(`lib/supabase/client.ts`, `server.ts`, `middleware.ts`) y las llamadas a `.rpc(...)`.

`lib/schemas/*.ts` (a mano, con Zod) describe las formas que devuelven los servicios — que incluyen
joins que ningún tipo generado expresa (`Movement` embebe `accounts: Pick<Account, ...>` y
`movement_types: Pick<...>`) — y valida los formularios. No se migra a los tipos generados: son
fuentes distintas para cosas distintas, y mezclarlas sería mucho churn para no ganar nada.
