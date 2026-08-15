# Importación de movimientos desde extractos bancarios

Ver también el plan original: [`docs/plans/movements-import-implementation.md`](plans/movements-import-implementation.md)
(decisiones y fases). Este documento es la referencia operativa: cómo agregar un banco nuevo y
dónde se suelen romper los adaptadores.

## Cómo está armado

```
archivo -> [ reader ] -> [ adaptador del banco ] -> ExtractedRow[] -> dedup -> preview -> insert
```

- `lib/imports/types.ts` — el contrato (`ExtractedRow`, `BankAdapter`, `ExtractResult`, `FormatCheck`).
- `lib/imports/readers/` — `File` → matriz de celdas. Uno por formato de archivo (hoy solo `xlsx.ts`),
  no por banco.
- `lib/imports/helpers/` — `date.ts`, `amount.ts`, `headers.ts`, `fingerprint.ts`. El trabajo
  aburrido que comparten todos los adaptadores.
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
