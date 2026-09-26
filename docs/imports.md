# Importación de movimientos desde extractos bancarios

Ver también el plan original: [`docs/plans/movements-import-implementation.md`](plans/movements-import-implementation.md)
(decisiones y fases). Este documento es la referencia operativa: cómo agregar un banco nuevo y
dónde se suelen romper los adaptadores.

## Cómo está armado

```
archivo -> [ reader ] -> [ adaptador del banco ] -> ExtractedRow[] -> dedup -> preview -> insert
```

- `lib/imports/types.ts` — el contrato (`ExtractedRow`, `BankAdapter`, `AdapterProbe`, `ExtractResult`,
  `FormatCheck`). `AdapterProbe` es una unión discriminada por `format` (`"xlsx" | "pdf"`) — cada
  adaptador declara su `format` y el wizard arma el probe correspondiente antes de llamar
  `assertFormat`.
- `lib/imports/readers/` — `File` → datos crudos. Uno por formato de archivo, no por banco:
  `xlsx.ts` (matriz de celdas, vía `xlsx`) y `pdf.ts` (items de texto con x/y por página, vía
  `pdfjs-dist`).
- `lib/imports/helpers/` — `date.ts`, `amount.ts`, `headers.ts` (mapeo de columnas por nombre para
  XLSX), `lines.ts` (agrupar items de PDF en líneas por Y, ordenar por X), `fingerprint.ts`. El
  trabajo aburrido que comparten todos los adaptadores.
- `lib/imports/adapters/<banco>-<producto>.ts` — un archivo por formato soportado, registrado en
  `adapters/index.ts`. **Esta es la única pieza que cambia por banco.**
- `components/movements/import/` — el asistente de 3 pasos (fuente → preview → confirmar).
  Todo el parseo corre en el browser; no hay Route Handler.

## Cómo agregar un banco nuevo

1. Conseguir un archivo real de extracto de ese banco (el parseo no se puede escribir a ciegas).
2. Crear `lib/imports/adapters/<banco>-<producto>.ts`:
   - `REQUIRED_HEADERS`: las columnas que el adaptador necesita, mapeadas **por nombre** con
     `locateHeaderRow` / `checkRequiredColumns` de `helpers/headers.ts`, nunca por posición.
   - `assertFormat`: corre `locateHeaderRow` + `checkRequiredColumns` sobre `probe.matrix` y
     devuelve el `FormatCheck`. Tiene que poder correr sin tirar excepción.
   - `extract`: lee el archivo con el reader que corresponda, vuelve a ubicar el header, arma
     `ExtractedRow[]` fila por fila. Una fila que no se puede leer entra a `issues`, **nunca** tira
     excepción y aborta todo el archivo.
3. Registrar el adaptador en `lib/imports/adapters/index.ts` (`ADAPTERS`).
4. Prueba de ida y vuelta: importar; reimportar el mismo archivo (tiene que insertar 0); importar
   un período solapado (solo entra lo nuevo); correr la query de descuadre de
   [`docs/database.md`](database.md#descuadre-de-saldos) para confirmar que el saldo cerró.

**No tocar** `dedup`, el `preview` ni el `insert` para agregar un banco — si hace falta, el
contrato `ExtractedRow` quedó corto y el problema es ahí, no en el adaptador.

## Dónde se rompen los adaptadores

Los cuatro lugares donde un extracto nuevo (o un cambio de formato del mismo banco) suele fallar:

1. **La fila de encabezado no está donde se esperaba.** Algunos extractos tienen metadata (cliente,
   período, saldo anterior) antes de la tabla. `locateHeaderRow` ya busca la fila de header en toda
   la matriz, así que esto no debería romper nada — pero si el banco además reordena o renombra la
   metadata de forma que "parezca" un header válido, puede dar un falso positivo. Mirar
   `headerRowIndex` en el resultado si el preview sale raro.

2. **Montos con paréntesis en vez de signo menos.** `helpers/amount.ts` soporta los dos
   (`"-1.234,00"` y `"(1.234,00)"`), pero si un banco usa un tercer formato (p. ej. sufijo `"CR"`/`"DB"`),
   hay que extenderlo ahí, no en el adaptador.

3. **Fechas de dos dígitos de año, o con mes y día invertidos.** `helpers/date.ts` asume
   `dd/MM/yyyy` con año de 4 dígitos para el caso string. Un extracto con `dd/MM/yy` o `MM/dd/yyyy`
   necesita su propio parseo — no asumir que todos los bancos paraguayos usan el mismo orden.

4. **Filas de subtotal o resumen al final de la tabla, que no son un renglón de más.** El corte de
   fila de datos usa `isBlankRow` (`helpers/headers.ts`): la primera fila completamente vacía
   después del header cierra la tabla, todo lo que sigue (resumen, plazo fijo, etc.) se ignora. Si
   un banco no deja una fila vacía entre los datos y el resumen, ese adaptador necesita su propia
   condición de corte (p. ej. una palabra clave conocida en la primera columna).

## Adaptadores PDF

Mismo contrato, pero dos diferencias de fondo respecto a XLSX:

- **`assertFormat` valida texto fijo, no columnas.** Un PDF no tiene celdas con nombre; el
  adaptador de Solar Banco (`solar-ahorros-pdf.ts`) busca un conjunto de frases de encabezado
  (`"Fecha Conf."`, `"Importe Débito"`, etc.) en el texto extraído. Si falta alguna, mismo
  `FormatCheck` de siempre — la UI no distingue entre "columna" y "frase de encabezado".
- **Estrategia de fila: regex sobre la línea completa, no bandas de X.** `readers/pdf.ts` da
  items con x/y; `helpers/lines.ts` los agrupa en líneas por Y y los concatena en orden de X. Como
  pdfjs ya emite los espacios entre campos como items propios (con ancho real), el resultado es una
  línea de texto limpia y de un solo espacio entre columnas — alcanza con un regex ancorado
  (`TRANSACTION_LINE_REGEX` en el adaptador). El plan preveía bandas de X como alternativa para
  cuando las descripciones largas rompen el regex (columna `.+?` no-greedy); no hizo falta acá
  porque las descripciones de Solar Banco no traen dígitos sueltos, pero es la salida si un futuro
  banco sí los trae.

### El worker de pdfjs-dist se sirve como asset estático, no se resuelve por bundler

La fricción conocida entre `pdfjs-dist` y Turbopack (anticipada en el plan, Fase 6.1) es que
Turbopack no soporta bien el patrón `new URL("pdf.worker.mjs", import.meta.url)` que sí funciona
con webpack. La solución: `scripts/copy-pdf-worker.mjs`, enganchado a `postinstall`, copia
`pdf.worker.min.mjs` desde `node_modules/pdfjs-dist` a `public/`. `readers/pdf.ts` apunta
`GlobalWorkerOptions.workerSrc` a `"/pdf.worker.min.mjs"` — una ruta pública común y corriente, sin
que el bundler tenga que resolver ni empaquetar nada. El archivo no se commitea (está en
`.gitignore`), se regenera en cada `npm install`.

**Efecto colateral que hay que conocer:** `middleware.ts` matcheaba todas las rutas salvo imágenes
conocidas, así que `/pdf.worker.min.mjs` caía dentro de `updateSession` y un pedido sin sesión
devolvía un 307 a `/auth/login` en vez del archivo. Se agregaron `mjs`/`js` a la lista de
extensiones excluidas del matcher (ninguna URL de página autenticada termina en esas extensiones,
mismo razonamiento que ya se usaba para las imágenes).

**Versión fijada en `4.10.38`, no la última (`6.x`).** `pdfjs-dist@6` exige Node `>=22.13`; este
entorno corre Node 20. La versión 4.x soporta Node `>=20` sin warnings de `engines`. Si se
actualiza Node, vale la pena revisar si conviene subir `pdfjs-dist` también.

### El año de la fecha no viene en cada fila

Las filas de Solar Banco traen `dd/MM` sin año. El adaptador toma el año del primer patrón
`dd/MM/yyyy` que aparece en el documento (la fecha de "Estado de Cta. al" del encabezado) y lo
combina con el `dd/MM` de "Fecha Tran." de cada fila. **Límite conocido:** si el período de un
extracto cruza un fin de año (estado emitido en enero con movimientos de diciembre), esas filas
quedarían mal fechadas con el año del estado — no hay evidencia de ese caso en el archivo de
referencia (frecuencia semanal) y no se resolvió a ciegas. Ver el comentario en
`findStatementYear` (`solar-ahorros-pdf.ts`).

También hay dos columnas de fecha por fila (`Fecha Conf.`, confirmación del banco, y
`Fecha Tran.`, cuándo pasó la transacción). El adaptador usa `Fecha Tran.` como `date` del
movimiento — es la que describe cuándo ocurrió el gasto, no cuándo el banco lo procesó.

## El identificador del banco no siempre es único dentro del archivo

Descubierto al validar el adaptador de Itaú (Fase 4.1) contra un extracto real: el número de
comprobante (columna `Movimiento`) puede repetirse dentro del **mismo** archivo para líneas
relacionadas pero distintas — típicamente un cargo y su línea de IVA, con montos distintos. Deduplicar
por `doc:<id>` a secas hubiera colisionado esas dos filas en el mismo `external_id` y el índice único
habría descartado una transacción real.

Por eso `computeExternalIds` (`lib/imports/helpers/fingerprint.ts`) también numera ocurrencias para
`doc:`, igual que ya hacía para el fallback `fp:` — pero **solo cuando el identificador se repite**
dentro del archivo. El caso común sigue siendo el `doc:<id>` limpio; el sufijo de ocurrencia
(`doc:<id>:<n>`) solo aparece cuando hace falta para no perder una fila.

Esto hereda la misma limitación de borde que ya tenía el fallback por huella: si se reimporta un
período solapado y en la carga anterior solo una de las dos líneas con el mismo `doc:<id>` estaba
presente, la numeración de ocurrencia se puede correr. Caso de borde aceptable — la alternativa
(no numerar nunca) pierde una transacción real con certeza, en vez de arriesgar un duplicado en un
caso raro.

El mecanismo es genérico (vive en `computeExternalIds`, no en el adaptador de Itaú), así que
cualquier banco nuevo queda cubierto automáticamente. Chequeado también contra el extracto de
referencia de Solar Banco: sus números de comprobante no se repiten dentro del archivo, así que ahí
el caso nunca se activa — pero si algún día lo hace, no hace falta tocar nada.

## La huella de deduplicación sigue en `yyyy-MM-dd`

`movements.date` lleva hora, pero `ExtractedRow.date` sigue siendo `"yyyy-MM-dd"` y ningún adaptador
cambió. `buildFingerprint` hashea ese string (`date|type|amount|desc`): si el formato cambia, los
`fp:` nuevos no coinciden con los `external_id` ya guardados y **se duplica todo lo importado
antes**. Los extractos no traen hora; las filas entran a las 00:00. Si un extracto trae hora algún
día, va en un campo aparte y fuera de la huella.
