# Plan: importación de movimientos desde extractos bancarios

**Fecha:** 2026-08-15
**Estado:** propuesto — nada implementado todavía

## Objetivo

Subir un extracto bancario, previsualizar las filas detectadas, asignarles tipo de movimiento, y
crear los movimientos en la base **sin duplicar los que ya fueron cargados en una importación
anterior**.

El problema central no es leer un Excel: es que **cada banco tiene un formato distinto, y el mismo
banco puede cambiarlo sin avisar**. Todo el diseño de abajo está organizado alrededor de eso.

## Decisiones tomadas

- **Un adaptador en código por banco/producto.** Nada de mapeo de columnas desde la UI: el alcance
  real son 2–4 formatos, de un solo usuario. Un motor de mapeo configurable sería más código y más
  superficie que los cuatro adaptadores que reemplaza.
- **Excel primero, PDF después.** El motor se construye y se prueba contra XLSX/XLS, que es donde
  el parseo es confiable. PDF entra al final, ya con el resto probado.
- **Ante un cambio de formato, fallar ruidosamente.** Cada adaptador valida la firma del archivo
  *antes* de extraer nada. Si no coincide, la importación se detiene y explica qué cambió.
- **Deduplicación por el identificador que ya trae el extracto** (nro. de comprobante /
  referencia / documento), con fallback por huella compuesta cuando el banco no lo provea.
- **Preview editable** como único punto de confirmación: nada toca la base hasta apretar "Importar".
  Cancelar es cerrar la pantalla. Sin tabla de importaciones ni "deshacer".
- **Todo el parseo corre en el browser.** Coherente con el patrón del repo (mutaciones en
  `*.client.ts`), el extracto no se sube a ningún lado, y el preview es instantáneo. No hace falta
  ningún Route Handler nuevo.

## Dependencias externas (bloqueante)

1. **Hacen falta archivos de extracto reales**, uno por banco/formato. Un adaptador no se puede
   escribir a ciegas: la mitad del trabajo es descubrir dónde arranca la tabla, cómo se llaman las
   columnas, qué filas de ruido hay (saldo anterior, subtotales, pie) y en qué columna vive el
   identificador.
2. **Los PDF tienen que ser de texto, no escaneados.** Si son imagen hace falta OCR, y eso queda
   fuera de alcance. Se verifica abriendo el PDF e intentando seleccionar el texto con el mouse.

## Arquitectura

### Lo que realmente aísla un banco de otro

La diferencia de formatos se contiene en **una sola función por banco**. Todo lo que viene después
es idéntico para todos:

```
archivo -> [ reader ] -> [ adaptador del banco ] -> ExtractedRow[] -> dedup -> preview -> insert
             formato        ESTO ES LO ÚNICO       ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
             de archivo     QUE CAMBIA POR BANCO   agnóstico al banco, se escribe una sola vez
```

`ExtractedRow` es el contrato. Mientras un adaptador devuelva eso, el resto del sistema no sabe ni
le importa de qué banco vino. **Agregar un banco no puede requerir tocar dedup, preview ni insert**;
si en algún momento hace falta, es señal de que el contrato quedó corto.

```
lib/imports/
  types.ts                  # ExtractedRow, BankAdapter, ExtractResult, FormatCheck
  readers/
    xlsx.ts                 # File -> matriz de celdas          (import dinámico de `xlsx`)
    pdf.ts                  # File -> items de texto con x/y    (import dinámico de `pdfjs-dist`)
  helpers/
    date.ts                 # "12/03/2026" | Date | serial Excel -> "2026-03-12"
    amount.ts               # "1.234.567,00" | "(1.234)" -> { value: 1234567, negative: bool }
    headers.ts              # ubicar la fila de encabezado y mapear columnas POR NOMBRE
    fingerprint.ts          # fallback de identificador
  adapters/
    index.ts                # registro: ADAPTERS[]
    <banco>-<producto>.ts   # un archivo por formato soportado
```

Hay **dos readers y no crecen nunca** (saben de formato de archivo, no de bancos). Los helpers son
donde vive el trabajo aburrido que todos los adaptadores comparten: fechas en `dd/MM/yyyy`, montos
con separador de miles `es-PY`, paréntesis para negativos.

### El contrato

```ts
export type ExtractedRow = {
  date: string;               // ya normalizado a "yyyy-MM-dd"
  description: string;
  amount: number;             // SIEMPRE positivo (ver "Interacción con los triggers")
  type: Type;                 // "credit" | "debit"
  externalId: string | null;  // el nro. de comprobante del extracto, si lo hay
  source: { page?: number; row: number; raw: string };
};

export type ExtractIssue = {
  source: { page?: number; row: number; raw: string };
  reason: string;
};

export type ExtractResult = {
  rows: ExtractedRow[];
  issues: ExtractIssue[];
};

export type BankAdapter = {
  id: string;                 // "itau-cc-xlsx"
  label: string;              // "Itaú — Cuenta corriente (Excel)"
  accept: string[];           // [".xlsx", ".xls"]
  assertFormat: (probe: AdapterProbe) => FormatCheck;  // corre ANTES de extraer
  extract: (file: File) => Promise<ExtractResult>;
};
```

Dos detalles que importan:

- **`issues` en vez de tirar excepción.** Una línea suelta que el adaptador no supo leer no puede
  matar la importación entera: aparece en el preview marcada como error y el usuario decide. Un
  extracto de 300 líneas siempre tiene alguna rareza.
- **`source.raw`** guarda el texto crudo de la fila. Es lo que hace debuggeable un adaptador nuevo:
  cuando una línea sale mal, el preview muestra exactamente qué se leyó.

### Deriva de formato: fallar ruidosamente

Este es el mecanismo que responde a "el banco cambió el extracto". Dos piezas:

**1. Mapear columnas por nombre, nunca por posición.** Esto reparte bien los dos casos:

| Cambio del banco | Qué pasa |
| --- | --- |
| Agregan una columna nueva | No pasa nada. Se ignora. |
| Reordenan las columnas | No pasa nada. |
| Renombran una columna que usamos | **Falla ruidosamente** (abajo). |
| Sacan una columna que usamos | **Falla ruidosamente.** |

Mapear por posición haría que el primer caso corrompa todo en silencio — importar 300 filas con el
monto leído de la columna de saldo. Por nombre, ese caso es inofensivo.

**2. `assertFormat` corre antes de extraer.** El adaptador declara las columnas que necesita, y si
alguna falta la importación se detiene con un mensaje concreto:

```ts
export type FormatCheck =
  | { ok: true }
  | { ok: false; missing: string[]; found: string[] };
```

En la UI eso se muestra como:

> **El archivo no coincide con el formato esperado para "Itaú — Cuenta corriente".**
> Falta la columna: `Nro. comprobante`.
> Columnas encontradas: `Fecha`, `Concepto`, `Documento`, `Débito`, `Crédito`, `Saldo`.
> Puede que el banco haya cambiado el formato. Hay que actualizar el adaptador.

Lo importante es que el mensaje muestre **las columnas que sí encontró**: con eso se arregla el
adaptador sin volver a abrir el archivo.

### Sobre no abstraer todavía

Un plan anterior de este documento proponía un `createSheetAdapter(config)` que generara los
adaptadores desde configuración declarativa. **Se descarta.** Con 2–4 adaptadores, esa abstracción
se diseñaría adivinando qué tienen en común formatos que todavía no vimos, y lo más probable es
terminar con una config que no alcanza para el tercer banco y un adaptador que la esquiva.

El orden correcto es al revés: escribir los primeros dos adaptadores como código plano, ver qué
repiten de verdad, y recién ahí extraer lo compartido. Los helpers (fechas, montos, encabezados) sí
se comparten desde el día uno, porque eso ya sabemos que es común.

## Deduplicación

### Esquema

```sql
alter table movements add column external_id text;

create unique index movements_account_external_id_key
  on movements (account_id, external_id);
```

El índice **no necesita ser parcial**: en Postgres los `NULL` son distintos entre sí dentro de un
índice único, así que todos los movimientos cargados a mano (con `external_id` en `NULL`) conviven
sin chocar. Esto además permite usar `onConflict` desde PostgREST, cosa que un índice parcial no
dejaría expresar.

### Formato del valor

Prefijado, para que un identificador real del banco nunca colisione con una huella calculada y para
saber de dónde salió cada uno mirando la base:

- `doc:000123456` — el identificador vino del extracto.
- `fp:a1b2c3d4e5f6:0` — huella calculada, porque el banco no traía identificador.

La huella es `sha256(date | type | amount | normalizeDescription(description))` truncado, más un
**índice de ocurrencia dentro del archivo**. Ese índice permite que dos líneas idénticas del mismo
día (dos cafés iguales) entren las dos, y que al reimportar el mismo archivo las dos se reconozcan.
`normalizeDescription` pasa a minúsculas, colapsa espacios y saca acentos. `crypto.subtle.digest`
alcanza y está disponible en el browser, sin dependencia nueva.

> **Limitación del fallback:** si se reimporta un período solapado y en la carga anterior había solo
> una de dos líneas idénticas, la numeración de ocurrencia se corre y puede entrar un duplicado.
> Caso de borde aceptable, y solo aplica a bancos sin identificador propio. Con `doc:` no existe.

### Dos capas, a propósito

- **Preview (UX):** antes de mostrar la tabla se consulta `getExistingExternalIds(accountId, ids)` y
  las filas ya cargadas aparecen marcadas "Ya importada", desmarcadas por defecto. Se ve qué va a
  pasar antes de que pase.
- **Insert (garantía):** `.upsert(rows, { onConflict: "account_id,external_id", ignoreDuplicates: true })`.
  Aunque el preview se haya calculado hace cinco minutos, la base no deja entrar un repetido.

La consecuencia importante: **la importación es idempotente**. Reimportar el mismo archivo inserta
cero filas. Por eso un fallo a mitad de camino se puede reintentar sin miedo, y por eso el insert se
puede cortar en lotes sin preocuparse por la atomicidad.

`ON CONFLICT DO NOTHING` no inserta la fila, así que **el trigger de saldo no se dispara para las
filas descartadas**. No hay riesgo de descuadre por reimportar.

## Interacción con los triggers

Releer [`docs/database.md`](../database.md) antes de tocar esto. Tres reglas no negociables:

1. **`amount` siempre positivo, el signo se expresa en `type`.** Un `amount` negativo con
   `type: "debit"` *suma* al saldo (`current_balance - (-x)`). El adaptador convierte signo → `type`
   y devuelve el monto positivo; `z.int().positive()` es la red.
2. **Nunca escribir `current_balance` ni `updated_at`.** El trigger se encarga, fila por fila,
   también en un insert masivo.
3. **`type` exactamente `credit` o `debit`.** Cualquier otra cosa deja el saldo de la cuenta en
   `NULL` en silencio. Toda fila pasa por `movementSchema` antes de salir del browser.

Un insert de 300 filas dispara 300 `UPDATE accounts` sobre la misma fila en la misma transacción.
Funciona, pero conviene **cortar en lotes de ~200** por límite de payload; como la operación es
idempotente, un lote que falle se reintenta sin consecuencias.

Efecto secundario esperado: importar mueve el `updated_at` de la cuenta. Ya documentado en
`docs/database.md` (efectos secundarios, punto 2); no es un bug nuevo, solo más visible.

## Fases

Orden pensado para que la UI no quede bloqueada esperando archivos reales: las fases 1–3 se
construyen contra un XLSX de ejemplo armado a mano.

### Fase 0 — Base de datos

- [ ] **0.1** `alter table movements add column external_id text` + el índice único.
- [ ] **0.2** Documentar columna e índice en `docs/database.md` (hoy solo cubre triggers; conviene
  una sección "Índices y restricciones").
- [x] **0.3** ✅ **RLS de `movements` verificada (2026-08-15) — está correcta.** Las cuatro
  operaciones scopean por `accounts.user_id` vía `EXISTS`, y el `INSERT` tiene el `with_check`
  puesto, que es exactamente lo que la importación masiva necesita. **Esta feature está despejada
  del lado de seguridad.**

  > La política de `UPDATE` tiene `with_check` en `NULL`, y no es un agujero: cuando una política de
  > `UPDATE` define solo `USING`, Postgres usa esa misma expresión como check de la fila resultante.
  > No se puede mover un movimiento a una cuenta ajena.

  Hallazgos colaterales, **todos corregidos el 2026-08-15**:

  - [x] **0.3a** `accounts`, política de `INSERT`, tenía `with_check: "true"`: cualquier autenticado
    podía insertar una cuenta con el `user_id` de otro. No había fuga (el `SELECT` sí scopea), pero
    se podían plantar cuentas en la lista ajena. Reemplazada por
    `with check (user_id = (select auth.uid()))`.

  - [x] **0.3b** `movement_types` no tenía ninguna política: la tabla estaba abierta a cualquiera
    con la publishable key. Cerrada con RLS activada + políticas de lectura y escritura para
    `authenticated`. Sigue siendo compartida entre usuarios, que es el diseño actual — ver la nota
    sobre el caso multiusuario en [`docs/database.md`](../database.md#row-level-security-rls).

  - [x] **0.3c** ⚡ `auth.uid()` envuelto en `(select auth.uid())`. Pelado, Postgres lo evalúa **una
    vez por fila**; con el insert de 300 filas del importador —cada una disparando además su
    `EXISTS` contra `accounts`— eso se notaba. Era prerrequisito de la Fase 2 y ya está.

  `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` viaja en el bundle del browser: es pública por diseño.
  **La RLS no es una capa extra, es la única.** El `.eq("accounts.user_id", ...)` de los servicios
  es comodidad de consulta, no protección — corre del lado del cliente y se puede omitir.

  El modelo de RLS, las políticas, los efectos secundarios y las queries de verificación quedaron
  documentados en [`docs/database.md`](../database.md#row-level-security-rls). **Esa es la fuente
  única**; acá solo se anota lo que toca a esta feature.

### Fase 1 — Núcleo, sin UI

- [ ] **1.1** `lib/imports/types.ts` con el contrato completo.
- [ ] **1.2** `helpers/date.ts`, `helpers/amount.ts`, `helpers/headers.ts`. La parte más aburrida y
  la que más rinde: todos los adaptadores dependen de esto. `headers.ts` es el que implementa el
  mapeo por nombre y produce el `FormatCheck`.
- [ ] **1.3** `helpers/fingerprint.ts` con `buildExternalId(row, occurrenceIndex)`.
- [ ] **1.4** `readers/xlsx.ts` con import dinámico de `xlsx`. Normalizar acá los tres tipos que
  devuelve SheetJS para una fecha (`Date`, string, serial numérico).
- [ ] **1.5** `adapters/index.ts` con el registro, y un adaptador de ejemplo contra un XLSX armado a
  mano para poder avanzar con la UI.

### Fase 2 — Servicios

- [ ] **2.1** `getExistingExternalIds(accountId, ids)` en `lib/services/movements.ts` (server),
  scopeado por `accounts.user_id` como el resto de las lecturas.
- [ ] **2.2** `bulkCreateMovements(rows)` en `lib/services/movements.client.ts`: valida cada fila,
  corta en lotes, hace el `upsert` con `ignoreDuplicates`, y devuelve `{ inserted, skipped }`
  contando lo que realmente entró (el `.select()` del upsert solo devuelve las filas insertadas).
- [ ] **2.3** `importedMovementSchema = movementSchema.extend({ external_id: z.string().min(1) })`
  en `lib/schemas/movements.ts`.

### Fase 3 — UI

Asistente en `app/protected/movements/import/page.tsx` (Server Component que carga cuentas y tipos,
igual que `create/page.tsx`), con los componentes en `components/movements/import/`.

- [ ] **3.1** Paso 1 — cuenta destino (`AccountSelect`), banco/formato (select alimentado por
  `ADAPTERS`) y file input.
- [ ] **3.2** Pantalla de error de formato, cuando `assertFormat` devuelve `ok: false`: qué columna
  falta y qué columnas se encontraron. Es la mitad visible de "fallar ruidosamente" y no es un
  detalle: es la pantalla que se va a ver cada vez que un banco cambie algo.
- [ ] **3.3** Paso 2 — tabla de preview reusando `Table` de `components/ui/`. Columnas: estado ·
  fecha · descripción · monto · naturaleza (`Badge`) · tipo de movimiento (`MovementTypeSelect` por
  fila) · incluir (`Checkbox`).
- [ ] **3.4** Estados por fila: `nueva` · `ya importada` · `duplicada en el archivo` ·
  `error de lectura`. Solo `nueva` viene tildada por defecto.
- [ ] **3.5** Acción masiva "asignar tipo a las filas seleccionadas" — con 300 filas, elegir de a
  una es inusable.
- [ ] **3.6** Resumen antes de confirmar: cantidad, total crédito, total débito, rango de fechas.
  Última defensa contra un adaptador mal elegido.
- [ ] **3.7** Paso 3 — confirmar, toast con `{ inserted, skipped }`, y
  `revalidateMyDataAndRedirect("/protected/movements")`. Ojo con el patrón del repo: el `try/catch`
  envuelve solo la llamada al servicio, nunca el `revalidate...` (tira `NEXT_REDIRECT` a propósito).
- [ ] **3.8** Botón "Importar" en `app/protected/movements/page.tsx`, al lado de "Nuevo".

### Fase 4 — Primer adaptador real (Excel)

- [ ] **4.1** Con el archivo real en mano: escribir el adaptador, ajustar nombres de columnas y el
  filtro de filas de ruido, y **verificar que el identificador del extracto es estable entre dos
  descargas del mismo período** (ver riesgos).
- [ ] **4.2** Prueba de ida y vuelta: importar; reimportar el mismo archivo (tiene que insertar 0);
  importar un período solapado (solo lo nuevo); correr la query de descuadre de `docs/database.md`
  para confirmar que el saldo cerró.

### Fase 5 — Segundo adaptador Excel

- [ ] **5.1** El segundo banco. **Recién acá** se evalúa qué se repite de verdad entre los dos
  adaptadores y se extrae lo compartido, si es que hay algo más allá de los helpers.

### Fase 6 — PDF

- [ ] **6.1** **Spike de integración primero:** `pdfjs-dist` necesita configurar el worker
  (`GlobalWorkerOptions`) y eso tiene fricción conocida con Next/Turbopack. Resolverlo aislado antes
  de escribir nada de parseo.
- [ ] **6.2** `readers/pdf.ts` + `helpers/lines.ts` (agrupar items por coordenada Y en líneas,
  ordenar por X).
- [ ] **6.3** El adaptador. Dos estrategias según cómo salga el texto: **regex sobre la línea
  completa** (más simple, suele alcanzar) o **corte por bandas de X** (para cuando las descripciones
  largas rompen el regex). Para PDF, `assertFormat` valida contra un texto fijo del encabezado en
  vez de contra nombres de columna.
- [ ] **6.4** Misma prueba de ida y vuelta que 4.2.

### Fase 7 — Documentación

- [ ] **7.1** `docs/imports.md`: cómo agregar un banco nuevo, y los cuatro lugares donde se suelen
  romper los adaptadores (fila de encabezado corrida, montos con paréntesis, fechas de dos dígitos,
  filas de subtotal).
- [ ] **7.2** Sección en `CLAUDE.md` apuntando a `docs/imports.md`, igual que la que apunta a
  `docs/database.md`.

## Riesgos y cosas a decidir sobre la marcha

- ~~**Estabilidad del identificador del banco.**~~ **Confirmado (2026-08-15):** el nro. de
  comprobante se mantiene entre descargas sucesivas del mismo extracto. La dedup por `doc:` es
  viable y es el camino principal. El fallback por huella queda igual en el diseño, pero solo para
  un banco futuro que no traiga identificador — no es el caso hoy.
- **Peso del bundle.** `xlsx` y `pdfjs-dist` son pesados. Los `import()` dinámicos dentro de los
  readers son obligatorios, no una optimización: sin eso `/protected/movements` carga medio mega de
  más para nadie.
- **Movimientos ya cargados a mano.** Tienen `external_id` en `NULL`, así que el importador **no los
  reconoce** y los va a insertar de nuevo. Es esperable, pero conviene avisarlo en la UI la primera
  vez. Emparejar por fecha+monto+descripción para "adoptar" movimientos manuales es posible, pero es
  otro feature.
- **El formato de un adaptador se rompe en silencio si se mapea por posición.** Es la razón por la
  que `headers.ts` mapea por nombre. Si en algún momento aparece un extracto sin encabezados y hay
  que ir por posición, ese adaptador necesita una validación propia mucho más estricta (cantidad de
  columnas, tipo de dato de cada una), porque pierde la red de seguridad.
