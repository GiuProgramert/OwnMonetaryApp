# Plan: calculadora en el campo de monto

**Fecha:** 2026-10-05
**Estado:** implementado y verificado (2026-10-05) — P.1 a P.13 pasan; queda sin verificar el comportamiento en teléfonos reales y en Safari (ver Notas de cierre)

## Objetivo

En cualquier formulario con campo de monto (movimientos, transferencias, presupuestos, deudas y
pago de deuda) el usuario puede escribir una cuenta en vez de un número, igual que en Excel:
`=20000+10000`, Enter, y el campo queda en `30.000`. Mientras escribe la cuenta, cada número se ve
con su separador de miles (`=20.000+10.000`). En el celular, donde el teclado numérico no tiene `=`
ni operadores, se entra con un botón de calculadora y una fila de botones de operadores.

Escribir un monto común (`40000` ⇒ `40.000`) sigue funcionando como hoy.

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

- `components/movements/amount-input.tsx` — el `AmountInput` actual (40 líneas). Props: `id?`,
  `value: number | undefined`, `onChange: (value: number) => void`, `disabled?`. Guarda un estado
  `display`, en cada cambio deja solo los dígitos y muestra `toLocaleString("es-PY")`. **Las props
  no cambian en este plan.**
- Los cinco lugares que lo usan, todos con `Controller` de `react-hook-form` y
  `<AmountInput id="amount" value={field.value} onChange={field.onChange} />`:
  - `components/movements/movement-form-fields.tsx` (label "Monto")
  - `components/transfers/transfer-form-fields.tsx` (label "Monto")
  - `components/budgets/budget-form-fields.tsx` (label "Tope mensual (Gs.)")
  - `components/debts/debt-form-fields.tsx` (label "Monto" o "Monto base (aproximado)")
  - `components/debts/payment-form.tsx` (label "Monto"; pasa
    `disabled={debt.amount_mode === "fixed"}`)
- `components/ui/input.tsx` (`Input`, con `forwardRef`) y `components/ui/button.tsx` (`Button`, con
  `variant="outline" | "secondary" | "default"` y `size="icon"` = `h-9 w-9`).
- `lucide-react` ya es dependencia (ícono `Calculator`).
- `lib/dashboard/date-range.ts` y `lib/accounts/primary.ts` — el molde de módulo **puro y
  síncrono** en `lib/<dominio>/`, sin React, que resuelve un valor a partir de una entrada. La
  lógica de la calculadora sigue ese molde (fase 1).
- `e2e/helpers/supabase.ts` — `qaSupabase()` y `uniqueName(feature, suffix?)` para los datos de los
  tests.

Restricciones que condicionan el diseño:

1. **Un solo componente, cinco usos.** Todo lo que cambie en `AmountInput` cambia a la vez en los
   cinco formularios. No hay que tocar la lógica de ningún formulario para que hereden la
   calculadora, y por lo mismo un error en el componente rompe los cinco.
2. **`inputMode="numeric"` deja al celular sin `=` ni operadores.** El teclado numérico de iOS solo
   tiene dígitos; el de Android suma a lo sumo `. , -`. En mobile el modo cálculo no se puede
   alcanzar tipeando: por eso existe la fase 3.
3. **Enter dentro de un input envía el formulario.** Los cinco formularios usan
   `<form onSubmit={handleSubmit(onSubmit)}>`. En modo cálculo, Enter tiene que resolver la cuenta
   y **no** enviar.
4. **El `useEffect(() => setDisplay(...), [value])` actual pisa lo que se muestra cada vez que
   cambia `value`.** Si el componente emite un valor mientras hay una expresión escrita, ese efecto
   reemplaza la expresión por el número. Pero el efecto no se puede sacar: es lo que vacía el campo
   cuando `components/movements/create-form.tsx` hace `methods.reset({ amount: 0, ... })` en "Crear
   y agregar otro".
5. **Los montos son enteros positivos.** `amount: z.int().positive("El monto debe ser un número
   entero positivo")` en `lib/schemas/movements.ts`, `transfers.ts`, `budgets.ts` y `debts.ts`
   (dos veces). Una división puede dar decimales y una resta puede dar cero o negativo. La columna
   es `numeric(15,2)`: el entero más grande que entra es `9.999.999.999.999`.
6. **`(4000).toLocaleString("es-PY")` da `4.000`** (verificado en Node): `es-PY` agrupa también los
   números de cuatro dígitos. El formateo de la expresión (1.2) tiene que dar lo mismo.
7. **No hay tests unitarios en el repo, solo Playwright.** La lógica pura de la fase 1 se prueba
   tipeando expresiones en el navegador.
8. **`e2e/transfers.spec.ts` usa `page.getByLabel("Monto").fill(...)`.** `getByLabel` busca por
   subcadena y sin distinguir mayúsculas: cualquier `aria-label` nuevo que contenga "monto" lo
   vuelve ambiguo y rompe ese test.

## Decisiones tomadas

- **En mobile se entra al modo cálculo con un botón de calculadora y una fila de botones de
  operadores, visibles en todas las pantallas (también en escritorio).** Decisión del usuario. Se
  descartó cambiar el input a `inputMode="text"`: no agrega UI, pero obliga a tipear cada monto
  común con el teclado de letras, que es el caso de todos los días. Se descartó también dejar la
  calculadora solo en escritorio. **Contrapartida:** cada campo de monto suma un botón a la derecha,
  y en modo cálculo el campo crece hacia abajo (fila de operadores y vista previa). Consecuencia:
  fase 3 y punto 4.3.
- **Operaciones: `+ - * /` y paréntesis, solo con números enteros.** Decisión del usuario. Cubre
  sumar un ticket, dividir una cuenta y multiplicar cuotas. Se descartaron los decimales con coma y
  el `%`: con enteros el `.` es siempre separador de miles y el formateo en vivo no tiene casos
  ambiguos. **Contrapartida:** no se puede escribir `=150000*1,1` ni `=200000-10%`; la coma se
  descarta al tipearla.
- **No hay menos unario.** `=-5000+10000` es "Cálculo incompleto". Los montos son positivos y
  sostener el signo complica la gramática sin un caso de uso. Contrapartida aceptada.
- **Parser propio, sin librería y sin `eval`.** La gramática son cuatro operadores y paréntesis;
  una dependencia como `mathjs` pesa más que todo el resto del formulario. `eval` y `new Function`
  quedan prohibidos: ejecutarían lo que el usuario pegue en el campo.
- **Un resultado con decimales se redondea al entero más cercano**, y se redondea **una sola vez,
  al final**. `=100000/3` da `33.333`. Se descartó rechazar el resultado con un error: dividir una
  cuenta entre tres es justamente el caso de uso. Contrapartida: `=100000/3` multiplicado por 3 a
  mano no vuelve a 100.000 (pero `=100000/3*3` sí, porque no se redondea en el medio).
- **Mientras hay una expresión, el formulario recibe el resultado en vivo si la expresión es
  válida, y `0` si no.** Así el valor del formulario es siempre lo que muestra la vista previa, y
  una expresión rota nunca deja guardar: `0` no pasa `z.int().positive()`. Se descartó no emitir
  nada hasta resolver: al editar un movimiento de Gs. 50.000, escribir `=20000+` y apretar
  "Guardar" guardaría 50.000 en silencio.
- **Salir del campo resuelve igual que Enter.** Tab o un click en "Crear" con `=20000+10000` sin
  resolver dejan `30.000`, como Excel al cambiar de celda. Si la expresión es inválida, el campo
  queda en modo cálculo con el error debajo.
- **`=` solo (expresión vacía) no es un error:** al resolver sale del modo cálculo y deja el campo
  vacío. Es lo que pasa si alguien toca el botón de calculadora sin querer.
- **`*` y `/` se muestran tal como se tipean, sin espacios alrededor de los operadores.** Los
  botones de la fila muestran `×` y `÷` (lo habitual en una calculadora) pero insertan `*` y `/`.
  Contrapartida: el glifo del botón no es el que aparece en el campo. Se aceptó para que lo que se
  ve sea siempre lo que se puede tipear con un teclado.
- **Tocar el botón de calculadora con el modo cálculo activo cancela** (lo mismo que Escape). En el
  celular no hay tecla Escape y resolver ya tiene su botón `=`.
- **Los botones del componente no entran en el orden de tabulación (`tabIndex={-1}`).** Son
  para mouse y dedo. Con teclado todo se hace desde el input: `=`, los operadores, Enter y Escape.
  Así Tab sigue yendo del monto al campo siguiente, como hoy. Contrapartida: no se puede llegar a
  los botones con Tab; un lector de pantalla los sigue encontrando por su `aria-label`.
- **Conservar la posición del cursor vale para los dos modos.** Es el mismo camino de código. En
  modo normal el único cambio visible es que corregir un dígito del medio ya no manda el cursor al
  final.
- **El componente se muda a `components/amount-input.tsx`** (punto 4.2). Lo usan cuatro módulos, y
  `CLAUDE.md` pide que lo compartido entre entidades viva en la raíz de `components/`. En la lista
  mostrada al usuario figuraba como "idea mía, opcional"; el usuario no lo sacó, así que entra como
  punto firme.
- **El usuario revisó los puntos propuestos y no eliminó ninguno.** Paréntesis (1.5), vista previa
  (2.9), Escape (2.10) y entrar al modo cálculo tipeando un operador (2.11) eran propuestas de
  quien escribió el plan y quedaron aprobadas.

## Arquitectura

```
lib/amounts/calculator.ts     ← nuevo. Puro, sin React: limpiar, formatear, evaluar, cursor.
                                 Absorbe toda la variación de "qué es una expresión válida".
components/amount-input.tsx   ← el AmountInput reescrito (fases 2 y 3) y mudado (4.2).
                                 Solo estado de UI: qué se muestra, error, foco, cursor.
```

Los dos modos se distinguen por lo que muestra el input, sin un estado aparte:

```
                 tipea "="  ·  tipea un operador después de un dígito  ·  botón Calculadora
   ┌────────┐ ─────────────────────────────────────────────────────────────▶ ┌─────────┐
   │ normal │                                                                 │ cálculo │
   │ 40.000 │ ◀───────────────────────────────────────────────────────────── │ =40.000+│
   └────────┘   Enter / salir del campo / botón "=" con expresión válida      └─────────┘
                Escape / botón Calculadora (cancela, vuelve el monto anterior)
                borrar todo el contenido
```

`isCalculating` es `display.startsWith("=")`. En modo cálculo, `display` es siempre
`"=" + formatExpression(expresión)`.

## Fase 1 — Lógica pura

Todo en un archivo nuevo, `lib/amounts/calculator.ts`, sin `"use client"` y sin imports de React.
A lo largo del plan, **"expresión"** es un string que solo contiene `0-9 + - * / ( )`: sin el `=`
inicial, sin puntos y sin espacios.

- [x] **1.1** `evaluateExpression(expression: string): CalculatorResult` — parser de descenso
  recursivo con la precedencia habitual (`*` y `/` antes que `+` y `-`, asociatividad izquierda).
  Gramática: `expr := term (("+" | "-") term)*`, `term := factor (("*" | "/") factor)*`,
  `factor := número | "(" expr ")"`. Sin menos unario. ⚠️ **Nunca `eval` ni `new Function`.**
- [x] **1.2** `formatExpression(expression: string): string` — pone el separador de miles `.` a
  cada corrida de dígitos y deja operadores y paréntesis como están: `20000+10000` ⇒
  `20.000+10.000`. ⚠️ Con la regex `run.replace(/\B(?=(\d{3})+(?!\d))/g, ".")`, **no** con
  `Number(run).toLocaleString("es-PY")`: `Number` se come los ceros a la izquierda (`0005` ⇒ `5`)
  y pierde precisión en corridas largas, y en los dos casos la cantidad de caracteres cambia y el
  cálculo del cursor (1.6) queda corrido. El resultado coincide con `es-PY` (restricción 6).
- [x] **1.3** Tipos y errores de `evaluateExpression`, exportados del mismo archivo:
  - `export const MAX_AMOUNT = 9_999_999_999_999;` (restricción 5).
  - `export type CalculatorError = "incomplete" | "division_by_zero" | "not_positive" | "too_large";`
  - `export type CalculatorResult = { ok: true; value: number } | { ok: false; error: CalculatorError };`
  - `export const calculatorErrorMessages: Record<CalculatorError, string>` con, exactamente:
    `incomplete` ⇒ "Cálculo incompleto", `division_by_zero` ⇒ "No se puede dividir por cero",
    `not_positive` ⇒ "El resultado debe ser mayor a cero", `too_large` ⇒ "El resultado es
    demasiado grande".
  - Qué error corresponde: cualquier error de sintaxis (expresión vacía, operador al final, dos
    operadores seguidos, paréntesis sin cerrar o sin abrir, `()` vacío, operador al principio) ⇒
    `incomplete`. División por cero en cualquier punto de la cuenta ⇒ `division_by_zero`.
    Resultado redondeado `<= 0` ⇒ `not_positive`. Resultado redondeado `> MAX_AMOUNT` o no finito
    ⇒ `too_large`.
- [x] **1.4** Redondeo: `evaluateExpression` devuelve `Math.round(resultado)`. ⚠️ Se redondea **solo
  el resultado final**, nunca los intermedios: `100000/3*3` tiene que dar `100000`, no `99999`. Y
  la comparación de `not_positive` se hace **después** de redondear: `1/3` redondea a `0` y es
  `not_positive`.
- [x] **1.5** Paréntesis: ya están en la gramática de 1.1. `(2+3)*4` ⇒ `20`. Se pueden anidar.
- [x] **1.6** *(apareció al escribir el detalle)* Cuatro funciones más que necesita la fase 2:
  - `sanitizeExpression(raw: string): string` — convierte lo que hay en el input en una expresión:
    reemplaza `×` por `*`, `÷` por `/` y `−` (U+2212) por `-`, y después descarta todo lo que no
    sea `0-9 + - * / ( )`. Se van el `=`, los puntos, las comas, los espacios y las letras.
  - `formatAmount(value: number | undefined): string` — lo que el componente ya hace hoy:
    `value ? value.toLocaleString("es-PY") : ""`.
  - `resolveAmountInput(raw: string, wasCalculating: boolean)` — decide el modo y qué se muestra.
    Devuelve `{ isCalculating: true; display: string; expression: string }` o
    `{ isCalculating: false; display: string; value: number }`. Reglas, con
    `expression = sanitizeExpression(raw)`:
    - Es modo cálculo si `raw.trimStart().startsWith("=")`.
    - Si no, y `wasCalculating` es `false`: es modo cálculo si la expresión tiene **un dígito
      seguido inmediatamente de `+ - * /`** (`/\d[+\-*/]/`). Es el punto 2.11. Un operador o un
      paréntesis sin dígito antes se ignora, como hoy se ignora cualquier no-dígito.
    - Si no, y `wasCalculating` es `true`: sigue en modo cálculo mientras la expresión tenga algún
      operador o paréntesis (`/[+\-*/()]/`). Borrar el `=` de `=20.000+10.000` no sale del modo;
      borrarlo de `=20.000` sí.
    - En modo cálculo: `display = "=" + formatExpression(expression)`.
    - En modo normal: igual que hoy. `digits = raw.replace(/\D/g, "")`,
      `value = digits ? parseInt(digits, 10) : 0`, `display = digits ? value.toLocaleString("es-PY") : ""`.
  - `caretAfterFormat(raw: string, rawCaret: number, display: string, isCalculating: boolean): number`
    — dónde va el cursor en `display` para que quede en el mismo lugar lógico que tenía en `raw`.
    `n` = cantidad de caracteres significativos a la izquierda del cursor:
    `sanitizeExpression(raw.slice(0, rawCaret)).length` en modo cálculo,
    `raw.slice(0, rawCaret).replace(/\D/g, "").length` en modo normal. Devuelve el índice de
    `display` inmediatamente posterior al `n`-ésimo carácter significativo (los `.` y el `=` no
    cuentan). Con `n = 0` devuelve `1` en modo cálculo (después del `=`) y `0` en modo normal. Si
    `display` tiene menos de `n` significativos, devuelve `display.length`.

> **Por qué el modo se decide con una función pura sobre el texto y no con un `useState`.** Hay
> cuatro formas de entrar (tipear `=`, tipear un operador, pegar una expresión, el botón) y cuatro
> de salir. Con un booleano aparte, cada una es un lugar donde el booleano y el texto se pueden
> desincronizar. Derivarlo del texto deja una sola fuente de verdad, y pegar `=1+2` o
> `40.000 + 5.000` funciona sin código propio.

## Fase 2 — `AmountInput`

En `components/movements/amount-input.tsx` (el archivo se muda recién en 4.2). Necesita la fase 1
completa. Las props (`id`, `value`, `onChange`, `disabled`) **no cambian**.

- [x] **2.1** Tipear `=` como primer carácter activa el modo cálculo. El modo normal se comporta
  como hoy: `40000` ⇒ `40.000`, y los no-dígitos se descartan. `isCalculating` se deriva:
  `display.startsWith("=")`, sin estado propio.
- [x] **2.2** Formateo en vivo: en cada cambio, `display` sale de `resolveAmountInput` (1.6), así
  que en modo cálculo se ve `=20.000+10.000` mientras se escribe.
- [x] **2.3** Enter en modo cálculo resuelve (ver 2.7 para qué es "resolver") y hace
  `e.preventDefault()` **siempre**, también si la expresión es inválida, para que el formulario no
  se envíe (restricción 3). ⚠️ En modo normal el `onKeyDown` no hace nada con Enter: el formulario
  se envía como hoy. Así, con `=20000+10000`, el primer Enter deja `30.000` y el segundo envía.
- [x] **2.4** Conservar el cursor al reformatear, en los dos modos. Hace falta un `ref` al
  `<Input>`. En cada cambio se calcula la posición con `caretAfterFormat` (1.6) usando
  `e.target.selectionStart`, y se aplica con `setSelectionRange` en un `useLayoutEffect`.
  - ⚠️ Solo llamar a `setSelectionRange` si `document.activeElement` es el input: en Safari, hacerlo
    sobre un input sin foco le roba el foco al elemento actual.
  - ⚠️ El efecto tiene que correr **también cuando `display` no cambió**. Si se tipea un carácter
    que se descarta (una letra en el medio de la expresión), el `display` nuevo es igual al
    anterior, React restaura el valor del input controlado y manda el cursor al final. Guardar el
    cursor pendiente en un **estado** con un objeto nuevo por cada cambio (por ejemplo
    `useState<{ position: number } | null>`), no en un `ref`: así cada cambio provoca un render y
    el `useLayoutEffect` que depende de ese estado corre siempre.
- [x] **2.5** Rehacer la sincronización con `value` (restricción 4). Un
  `lastEmitted = useRef<number | undefined>(value)` y una función `emit(n)` que hace
  `lastEmitted.current = n; onChange(n);` — **todo llamado a `onChange` pasa por `emit`**. El
  efecto queda:
  `useEffect(() => { if (value === lastEmitted.current) { return; } lastEmitted.current = value; setDisplay(formatAmount(value)); setError(null); }, [value]);`
  Con eso, un valor que emitió el propio componente no toca lo que se muestra, y un cambio que
  viene de afuera (`methods.reset()` en `components/movements/create-form.tsx`, o los
  `defaultValues` de un formulario de edición) sí lo reemplaza y saca del modo cálculo.
- [x] **2.6** En modo cálculo, cada cambio emite `evaluateExpression(expression)`: el `value` si
  `ok`, y `0` si no. En modo normal emite `value` de `resolveAmountInput`, como hoy.
- [x] **2.7** "Resolver" es una sola función, que llaman Enter (2.3), `onBlur` del input y el botón
  `=` (3.2). Si no está en modo cálculo, no hace nada. Si está:
  - Expresión vacía (`display` es `=`): `setDisplay("")`, `emit(0)`, sin error.
  - `evaluateExpression` da `ok`: `setDisplay(formatAmount(value))`, `emit(value)`, sin error. El
    campo vuelve al modo normal.
  - Da error: se guarda el error en un estado `error: CalculatorError | null`, `emit(0)`, y el
    campo **queda en modo cálculo** con la expresión intacta.
  - ⚠️ `onBlur` resuelve para que un click en "Crear" con una expresión sin resolver guarde el
    resultado: el `blur` ocurre antes que el `click`, y `field.onChange` actualiza
    `react-hook-form` de forma síncrona. Ver la excepción de 3.2: los botones del propio
    componente no deben disparar esta resolución.
- [x] **2.8** Debajo del input, cuando hay `error`:
  `<p className="text-sm text-destructive">{calculatorErrorMessages[error]}</p>`. El error se
  limpia (`setError(null)`) en el siguiente cambio del input. Solo aparece después de un intento de
  resolver que falló, nunca mientras se está escribiendo.
- [x] **2.9** Vista previa: en modo cálculo, sin `error`, con una expresión válida que tenga al
  menos un operador, se muestra debajo del input
  `<p className="text-sm text-muted-foreground">= 30.000</p>` (el resultado con `formatAmount`). En
  cualquier otro caso no se muestra nada. Nunca se ven la vista previa y el error a la vez.
- [x] **2.10** Escape en modo cálculo cancela: `setDisplay(formatAmount(previo))`, `emit(previo)`,
  `setError(null)`, donde `previo` es el monto que tenía el campo antes de entrar al modo cálculo.
  Se guarda en un `ref` en el momento de la transición normal ⇒ cálculo, leyendo
  `lastEmitted.current` **antes** de emitir el valor nuevo. En modo normal Escape no hace nada.
- [x] **2.11** Tipear `+`, `-`, `*` o `/` justo después de un número entra al modo cálculo:
  `40.000` y `+` ⇒ `=40.000+`. Ya sale de `resolveAmountInput` (1.6); acá solo hay que verificar
  que el cursor queda al final y que el monto previo de 2.10 es `40000`. Sirve sobre todo al editar:
  abrir un movimiento de `40.000`, tipear `+5000`, Enter.
- [x] **2.12** Con `disabled`, el input sigue deshabilitado como hoy y no hay forma de entrar al
  modo cálculo (el botón de 3.1 también se deshabilita).
- [x] **2.13** *(apareció al escribir el detalle)* Un solo punto de entrada para todo cambio de
  texto: `applyRaw(raw: string, rawCaret: number)`. Hace, en orden: `resolveAmountInput(raw,
  isCalculating)`; si pasa de normal a cálculo, guarda el monto previo (2.10); `setDisplay`;
  `setError(null)`; deja pendiente el cursor (2.4); emite (2.6). El `onChange` del input llama a
  `applyRaw(e.target.value, e.target.selectionStart ?? e.target.value.length)`. Los botones de la
  fase 3 llaman a la misma función: no tienen lógica propia.
- [x] **2.14** *(apareció al escribir el detalle)* La raíz del componente pasa de ser el `<Input>`
  a ser un `<div className="grid gap-2">` con un `ref` (lo usa 3.2), que contiene el input y,
  debajo, el error o la vista previa. El `<Input>` conserva `id`, `inputMode="numeric"` y
  `disabled`, para que el `<Label htmlFor="amount">` de los formularios siga apuntando al input.

## Fase 3 — Botones (mobile)

En el mismo archivo. Necesita la fase 2: los botones solo llaman a `applyRaw` (2.13), a "resolver"
(2.7) y a cancelar (2.10). Los botones se ven en **todas** las pantallas, no solo en mobile.

- [x] **3.1** Botón de calculadora a la derecha del input, en la misma línea
  (`<div className="flex gap-2">`, con el input ocupando el resto):
  `<Button type="button" variant="outline" size="icon">` con el ícono `Calculator` de
  `lucide-react`, `aria-label="Calculadora"`, `aria-pressed={isCalculating}` y
  `disabled={disabled}`. Fuera del modo cálculo, el click hace
  `applyRaw("=" + display, display.length + 1)` y le da foco al input: con el campo vacío queda
  `=`, y con `40.000` queda `=40.000`.
- [x] **3.2** Fila de botones debajo del input, **visible solo en modo cálculo**, en un
  `<div className="flex flex-wrap gap-2">`. Siete `<Button type="button" variant="outline"
  size="icon">`, en este orden, con este texto visible, este `aria-label` y este efecto:

  | Texto | `aria-label` | Efecto |
  |---|---|---|
  | `+` | Sumar | inserta `+` |
  | `-` | Restar | inserta `-` |
  | `×` | Multiplicar | inserta `*` |
  | `÷` | Dividir | inserta `/` |
  | `(` | Abrir paréntesis | inserta `(` |
  | `)` | Cerrar paréntesis | inserta `)` |
  | `=` | Calcular | resuelve (2.7); este usa `variant="default"` |

  "Insertar" es: tomar `selectionStart` y `selectionEnd` del input (si son `null`, el final del
  texto), armar `raw = display.slice(0, start) + carácter + display.slice(end)`, llamar a
  `applyRaw(raw, start + 1)` y devolverle el foco al input.
  - ⚠️ **`type="button"` en todos** (también el de 3.1): el default de `<button>` dentro de un
    `<form>` es `submit` y enviaría el formulario.
  - ⚠️ **Los botones no le pueden sacar el foco al input.** Si se lo sacan, el `onBlur` de 2.7
    resuelve la expresión a medio escribir y, en el celular, se cierra el teclado. Dos defensas, las
    dos obligatorias: (a) `onMouseDown={(e) => e.preventDefault()}` en los ocho botones, que evita
    el cambio de foco; (b) el `onBlur` del input no resuelve si
    `containerRef.current?.contains(e.relatedTarget)`, es decir, si el foco se fue a un botón del
    propio componente.
  - ⚠️ **`tabIndex={-1}` en los ocho botones** (los siete de la fila y el de 3.1). Sin eso, Tab
    desde el input cae en el botón de calculadora, que está dentro del componente: la defensa (b)
    lo toma por un click en un botón propio y la expresión no se resuelve, y además hay que pasar
    por ocho botones para llegar al campo siguiente. Con `tabIndex={-1}`, Tab va directo al campo
    siguiente del formulario, igual que hoy, y resuelve (2.7).
  - ⚠️ **Ningún `aria-label` puede contener la palabra "monto"** (restricción 8). Usar exactamente
    los de la tabla.
- [x] **3.3** *(apareció al escribir el detalle)* Con el modo cálculo activo, el botón de 3.1 pasa a
  `variant="secondary"`, su `aria-label` es "Cancelar cálculo" y el click cancela (lo mismo que
  Escape, 2.10) y deja el foco en el input.
- [x] **3.4** *(apareció al escribir el detalle)* Orden final dentro del `<div>` raíz de 2.14:
  (1) la línea con el input y el botón de calculadora, (2) la fila de operadores, (3) el error o
  la vista previa. A 390 px de ancho los siete botones (`h-9 w-9`, `gap-2`) entran en una línea;
  `flex-wrap` es la red por si un contenedor es más angosto. No tiene que aparecer scroll
  horizontal en la página.

## Fase 4 — Módulos

- [x] **4.1** Verificar que los cinco formularios del *Contexto* siguen compilando y mostrando el
  campo sin cambios en su código: las props de `AmountInput` no cambiaron, así que no debería hacer
  falta tocar ningún `Controller`. Si hace falta tocar alguno, es una señal de que cambió el
  contrato: parar y reportar.
- [x] **4.2** Mudar el componente: `git mv components/movements/amount-input.tsx
  components/amount-input.tsx` y cambiar el import en los cinco archivos del *Contexto* a
  `@/components/amount-input`. No editar los planes viejos de `docs/plans/` que nombran la ruta
  anterior: son registro histórico.
- [x] **4.3** *(apareció al escribir el detalle)* Agregar `items-start` al contenedor
  `grid gap-4 sm:grid-cols-2` de los cinco archivos: `components/movements/movement-form-fields.tsx`,
  `components/transfers/transfer-form-fields.tsx`, `components/budgets/budget-form-fields.tsx`,
  `components/debts/debt-form-fields.tsx` y `components/debts/payment-form.tsx`. Hoy las celdas se
  estiran al alto de la fila; cuando el campo de monto crece (fila de operadores y vista previa,
  unos 70 px), la celda vecina se estira con él y su input se separa del label. Con `items-start`
  cada celda mide lo que mide su contenido.

## Fase 5 — Cierre

- [x] **5.1** `npm run lint` y `npm run build`. Dónde suele romper acá: un `if` sin llaves (regla
  del repo), las dependencias del `useEffect` de 2.5 (`react-hooks/exhaustive-deps` va a pedir
  solo `value`, que es lo correcto), y un import viejo a `@/components/movements/amount-input`
  después de 4.2.
- [x] **5.2** Agregar a `CLAUDE.md`, dentro de *Other conventions*, un párrafo sobre el campo de
  monto: que todo monto se carga con `AmountInput` (`components/amount-input.tsx`), que la lógica de
  la calculadora vive en `lib/amounts/calculator.ts` y es pura, y las tres reglas que impone:
  (1) nunca `eval`; (2) con una expresión sin resolver el formulario recibe el resultado o `0`,
  nunca el monto anterior; (3) los `aria-label` de sus botones no pueden contener "monto" porque
  los tests localizan el campo con `getByLabel("Monto")`.
- [x] **5.3** Notas de cierre al final de este documento, con lo que se desvió del plan — *las
  escribe el orquestador al terminar las pruebas, no el implementador.*

## Criterios de prueba

Van en `e2e/amount-input-calculator.spec.ts`, cada test nombrado con su id (`test("P.1 — …")`).

**Convenciones para todos los criterios:**

- Salvo que se diga otra cosa, la ruta es `/protected/movements/create` y "el campo" es
  `page.getByLabel("Monto")`. En las pantallas donde el label es otro, usar `page.locator("#amount")`.
- "Tipear" es `pressSequentially` (tecla por tecla), no `fill`, salvo en P.1. El valor del campo se
  verifica con `toHaveValue`.
- Los botones se localizan con `getByRole("button", { name: "…", exact: true })`.
- P.1 a P.8 y P.11 **no crean datos**: tipean en el formulario y nunca lo envían con éxito.

**Datos para P.9, P.10 y P.12 (`beforeAll` / `afterAll`):**

- Con `qaSupabase()`, crear una cuenta `uniqueName("amount-input-calculator")` y buscar un tipo de
  movimiento existente que no sea `Transferencia` (`e7f1b48a-be01-48a5-9982-5a4d4025493c`).
  ⚠️ No crear ni editar tipos: el usuario de QA no tiene permiso.
- Para P.12, insertar dos deudas en `debts` con ese tipo, `kind: "service"`, `amount: 50000` y
  `first_due_date` de hoy en `America/Asuncion`: una con `amount_mode: "fixed"` y otra con
  `amount_mode: "variable"`.
- En `afterAll`, borrar las dos deudas y la cuenta; los movimientos de la cuenta se borran en
  cascada.

Criterios:

- **P.1** (2.1, 2.14, 3.1) — Modo normal sin cambios: `fill("40000")` ⇒ el campo vale `40.000`. El
  botón "Calculadora" está visible y el botón "Sumar" no existe en la página.
- **P.2** (1.1, 1.2, 2.2, 2.3, 2.9) — Tipear `=20000+10000` ⇒ el campo vale `=20.000+10.000` y se
  ve el texto `= 30.000`. Enter ⇒ el campo vale `30.000`, la URL sigue siendo
  `/protected/movements/create`, no aparece "La descripción es requerida" (el formulario no se
  envió) y el botón "Sumar" ya no existe.
- **P.3** (1.1, 1.4, 1.5) — Cada expresión, tipeada en el campo vacío y seguida de Enter, deja este
  valor: `=2+3*4` ⇒ `14`; `=(2+3)*4` ⇒ `20`; `=3*25000` ⇒ `75.000`; `=100000-15000` ⇒ `85.000`;
  `=100000/3` ⇒ `33.333`; `=100000/3*3` ⇒ `100.000`; `=((1+2)*(3+4))` ⇒ `21`; `=5000` ⇒ `5.000`.
- **P.4** (1.3, 2.3, 2.7, 2.8) — Errores. Cada expresión seguida de Enter muestra su mensaje, el
  campo conserva la expresión y la URL no cambia: `=20000+` ⇒ "Cálculo incompleto"; `=(2+3` ⇒
  "Cálculo incompleto"; `=2++3` ⇒ "Cálculo incompleto"; `=5/0` ⇒ "No se puede dividir por cero";
  `=1000-5000` ⇒ "El resultado debe ser mayor a cero"; `=1/3` ⇒ "El resultado debe ser mayor a
  cero"; `=9999999999999*10` ⇒ "El resultado es demasiado grande". Después de un error, tipear un
  carácter más hace desaparecer el mensaje.
- **P.5** (2.10, 2.11) — Operador sobre un monto y Escape: `fill("40000")`, después tipear `+` ⇒
  `=40.000+`; tipear `5000` ⇒ `=40.000+5.000`; Escape ⇒ `40.000` y el botón "Sumar" ya no existe.
  Con el campo vacío, tipear `+` deja el campo vacío, y tipear `(` también. Con el campo vacío,
  tipear `=123` y Escape ⇒ campo vacío.
- **P.6** (2.4) — Cursor: tipear `=20000+10000`, apretar `ArrowLeft` 7 veces y tipear `51` ⇒ el
  campo vale `=2.000.051+10.000` (si el cursor saltara al final después del `5`, valdría
  `=200.005+100.001`). Enter ⇒ `2.010.051`. En modo normal: `fill("40000")`, `ArrowLeft` 3 veces,
  tipear `12` ⇒ `4.012.000`.
- **P.7** (2.7, 3.2) — Salir del campo: tipear `=20000+10000` y Tab ⇒ `30.000`, y el foco queda
  en el select "Naturaleza" (`#type`), no en un botón del componente. Tipear solo `=` y Tab
  ⇒ campo vacío y **no** aparece "Cálculo incompleto". Tipear `=20000+` y Tab ⇒ el campo conserva
  `=20.000+` y aparece "Cálculo incompleto".
- **P.8** (3.1, 3.2, 3.3, 3.4) — Mobile, viewport 390 × 844. Click en "Calculadora" ⇒ el campo
  vale `=`, tiene el foco, y se ven los botones "Sumar", "Restar", "Multiplicar", "Dividir", "Abrir
  paréntesis", "Cerrar paréntesis" y "Calcular". Tipear `20000`, click en "Sumar" ⇒ `=20.000+`;
  tipear `10000` sin volver a hacer click en el campo ⇒ `=20.000+10.000` (prueba que el botón no
  sacó el foco ni resolvió). Click en "Calcular" ⇒ `30.000` y los botones de operadores
  desaparecen. Click en "Calculadora" ⇒ `=30.000`; click en "Multiplicar" y tipear `2` ⇒
  `=30.000*2`; click en "Cancelar cálculo" ⇒ `30.000`. En todo momento
  `document.documentElement.scrollWidth <= document.documentElement.clientWidth`.
- **P.9** (2.6, 2.7, 2.11) — Guardar sin resolver. En
  `/protected/movements/create?accountId=<cuenta del test>`, completar la descripción con un nombre
  único, elegir el tipo de movimiento, tipear `=20000+10000` **sin Enter** y hacer click en "Crear"
  (`exact: true`) ⇒ redirige a `/protected/movements`, y en
  `/protected/movements?accountId=<cuenta>` la fila de esa descripción muestra `Gs. 30.000`.
  Después, desde el formulario de edición de ese movimiento, tipear `+5000` al final del campo
  (que muestra `30.000`), Enter, y "Guardar" ⇒ la fila muestra `Gs. 35.000`.
- **P.10** (2.5, 2.6) — En la misma ruta que P.9, con el resto de los campos completos:
  - Tipear `=20000+` y hacer click en "Crear" ⇒ la URL no cambia y aparece "El monto debe ser un
    número entero positivo". No se creó ningún movimiento con esa descripción.
  - Corregir a `=20000+10000`, Enter, y click en "Crear y agregar otro" ⇒ la URL no cambia, el
    campo de monto queda vacío y tipear `5000` deja `5.000`. En
    `/protected/movements?accountId=<cuenta>` hay una fila nueva de `Gs. 30.000`.
- **P.11** (4.1, 4.2, 4.3) — Los otros módulos. En `/protected/budgets/create`,
  `/protected/transfers/create` y `/protected/debts/create`, tipear `=20000+10000` en `#amount` y
  Enter ⇒ `30.000`, con la URL sin cambiar. Y en `/protected/movements/create` con viewport de
  escritorio (1280 × 720): la posición vertical (`boundingBox().y`) del select "Naturaleza"
  (`#type`) es la misma antes y después de tipear `=20000+10000` en el campo de monto.
- **P.12** (2.12, 3.1) — Pago de deuda. En `/protected/debts/<deuda fija>/pay`, `#amount` está
  deshabilitado con valor `50.000` y el botón "Calculadora" está deshabilitado. En
  `/protected/debts/<deuda variable>/pay`, `#amount` vale `50.000`; tipear `+5000` al final y Enter
  ⇒ `55.000`, con la URL sin cambiar (no se registra el pago).
- **P.13** (regresión, restricción 8) — `e2e/transfers.spec.ts` sigue pasando sin modificarlo: su
  `page.getByLabel("Monto")` sigue resolviendo a un solo elemento.

**No cubierto por e2e:**

- **Teclados reales de celular** — Playwright emula el viewport, no el teclado. No se verifica que
  iOS y Android mantengan el teclado abierto al tocar un botón de operador, ni qué hace la tecla de
  acción ("Ir" / "✓") del teclado numérico de Android con una expresión sin resolver. Lo prueba el
  usuario a mano en su teléfono; hasta entonces figura como no verificado en las Notas de cierre.
- **`lib/amounts/calculator.ts` aislado** — no hay runner de tests unitarios (restricción 7). Queda
  cubierto de forma indirecta por P.3, P.4 y P.6.
- **Safari** — el proyecto de Playwright es solo Chromium. La defensa de 2.4 contra el robo de foco
  de `setSelectionRange` no se verifica.

## Fuera de alcance

El usuario revisó los puntos propuestos y no eliminó ninguno. Lo que sigue se descartó al decidir o
directamente no entra:

- **Decimales con coma y `%`** (`=150000*1,1`, `=200000-10%`) — descartado por el usuario al elegir
  el alcance de las operaciones. Con decimales, `.` y `,` pasan a tener significado los dos y el
  formateo en vivo tiene que distinguir la parte decimal; `%` necesita definir qué significa en cada
  posición. Para que entre haría falta rediseñar 1.2 y 1.6.
- **`inputMode="text"` en el campo** — descartado por el usuario: empeora la carga de un monto
  común en el celular. El input sigue con `inputMode="numeric"` también en modo cálculo.
- **Calculadora solo en escritorio** — descartado por el usuario.
- **Menos unario y montos negativos** — ver *Decisiones tomadas*.
- **Guardar o recordar la expresión.** Una vez resuelta, el campo solo conserva el resultado. No hay
  historial, ni columna en la base, ni forma de "volver a ver la cuenta".
- **Cambios en los schemas o en la base.** `amount` sigue siendo `z.int().positive(...)` en los
  cuatro schemas; no se toca `lib/schemas/*`, `lib/services/*` ni `supabase/`.
- **Tope en modo normal.** `MAX_AMOUNT` solo limita el resultado de una expresión. Tipear a mano un
  número más grande se comporta como hoy.
- **Otros inputs numéricos.** `total_installments` y `pending_installments` en
  `components/debts/debt-form-fields.tsx` son `<Input type="number">` y no son montos; el saldo de
  `components/accounts/edit.form.tsx` es de solo lectura. No se convierten a `AmountInput`.
- **Espacios alrededor de los operadores y glifos `×` / `÷` dentro del campo** — ver *Decisiones
  tomadas*.
- **Un runner de tests unitarios** (vitest, jest) para `lib/amounts/calculator.ts`. Sería razonable,
  pero es infraestructura nueva y no es parte de este pedido.
- **`data-testid`** — los tests usan labels y roles, como el resto de `e2e/`.
- **Más atajos de teclado** que Enter y Escape.

## Riesgos conocidos

- **Los cinco formularios cambian a la vez** (restricción 1). Un error en `AmountInput` deja sin
  poder cargar montos en toda la app. La regresión es P.11, P.12, P.13 y la suite completa.
- **El comportamiento en teléfonos reales no lo cubre ningún test** (ver *No cubierto por e2e*). Si
  en iOS el botón de operador cierra el teclado a pesar del `preventDefault` de 3.2, el modo
  cálculo en mobile queda usable pero incómodo (hay que volver a tocar el campo); la segunda
  defensa de 3.2 evita al menos que la expresión se resuelva sola.
- **Dos mensajes a la vez debajo del campo.** Después de un envío fallido, `react-hook-form`
  revalida en cada cambio. Con una expresión inválida se pueden ver juntos "Cálculo incompleto"
  (del componente) y "El monto debe ser un número entero positivo" (del formulario). Es redundante,
  no incorrecto; no se resuelve en este plan.
- **Backspace sobre un separador de miles** mueve el cursor sin borrar ningún dígito (el punto se
  borra y el formateo lo vuelve a poner). Es el comportamiento habitual de un input con máscara; el
  siguiente Backspace borra el dígito.
- **`items-start` (4.3) cambia la alineación de los formularios existentes.** Hoy las celdas de una
  misma fila miden lo mismo; después, cada una mide su contenido. No debería notarse salvo cuando
  una celda tiene mensaje de error y la vecina no, donde ahora la vecina deja de estirarse — que es
  una mejora, pero es un cambio visual en pantallas que este plan no pretendía tocar.
- **Pegar texto con guiones** en un campo vacío (una fecha `2026-10-05`) entra al modo cálculo,
  porque cumple "dígito seguido de operador". Es consecuencia de 2.11 y se sale con Escape.

## Registro de ejecución

**2026-10-05** — Ejecución con la skill `ejecutar-plan`.

- **Paso 0.** Credenciales de QA presentes en `.env.local`. Árbol de trabajo limpio salvo este
  plan (sin commitear). Puntos a hacer: 1.1–1.6, 2.1–2.14, 3.1–3.4, 4.1–4.3, 5.1–5.2 (5.3 es del
  orquestador).
- **Ronda 1 — implementador.** Hechos y marcados `[x]`: 1.1–1.6, 2.1–2.14, 3.1–3.4, 4.1–4.3, 5.1,
  5.2 (checkboxes conciliados con el reporte). Sin bloqueos ni preguntas. `npm run lint` y
  `npm run build` OK según su reporte. No tocó ningún `Controller` (4.1): solo el import y
  `items-start`. Desvíos declarados: ninguno funcional. Un caso que el plan no definía: en una
  expresión con división por cero **y** error de sintaxis (`5/0+`), gana la sintaxis ⇒
  "Cálculo incompleto". No probó nada en el navegador.
- **Ronda 1 — tester.** P.1 a P.13 pasan. Incidencias: ninguna (no se abrió ninguna `I-n`). Tests
  nuevos en `e2e/amount-input-calculator.spec.ts` (12 tests, P.1–P.12); P.13 es
  `e2e/transfers.spec.ts` sin modificar. Suite completa `npm run test:e2e`: 28 pasan, 0 fallan.
  Detalle de entorno, no incidencia: el primer intento del `setup` de login dio timeout (5 s) con
  el dev server recién levantado compilando por primera vez; repetido, pasó.
- **Cierre.** El orquestador volvió a correr `npm run lint` y `npm run build` con el test nuevo en
  el árbol: los dos OK. Notas de cierre escritas, 5.3 marcado y Estado actualizado. Sin commit.

## Notas de cierre

**Resultado:** los 29 puntos de las fases 1 a 5 están hechos en una sola ronda de implementador y
una de tester, sin incidencias ni preguntas al usuario.

**Desvíos respecto del plan:** ninguno funcional. Las props de `AmountInput` no cambiaron y no hizo
falta tocar ningún `Controller` (4.1): en los cinco formularios solo cambió el import (4.2) y se
agregó `items-start` (4.3).

**Un caso que el plan no definía.** Una expresión que tiene a la vez división por cero y un error
de sintaxis (`=5/0+`) da "Cálculo incompleto": el parser evalúa mientras parsea, marca la división
por cero con un flag, y un error de sintaxis tiene prioridad sobre ese flag. Lo decidió el
implementador; es coherente con 1.3 (la expresión está incompleta) pero **no lo cubre ningún test
ni lo probó el tester**.

**Qué quedó sin hacer:** nada.

**Incidencias:** ninguna.

**Tests que quedaron en `e2e/`:**

- `e2e/amount-input-calculator.spec.ts` (nuevo) — 12 tests, `P.1` a `P.12`. P.9, P.10 y P.12 viven
  en un `describe` con datos: `beforeAll` crea una cuenta y dos deudas (fija y variable) con un
  tipo de movimiento existente, y `afterAll` borra las deudas y la cuenta (los movimientos caen en
  cascada).
- `e2e/transfers.spec.ts` — sin modificar; es la regresión P.13.
- Se corren con `npm run test:e2e` (28 tests en total, todos pasan).

**Qué no se pudo verificar:**

- **Teclados reales de celular.** Playwright emula el viewport, no el teclado. No se sabe si iOS y
  Android mantienen el teclado abierto al tocar un botón de operador, ni qué hace la tecla de
  acción ("Ir" / "✓") del teclado numérico de Android con una expresión sin resolver. **Pendiente
  de prueba manual del usuario en su teléfono** — es el motivo por el que existe la fase 3, así
  que es lo primero a probar.
- **Safari.** La suite corre solo en Chromium: la defensa de 2.4 contra el robo de foco de
  `setSelectionRange` está escrita pero no verificada.
- **`lib/amounts/calculator.ts` aislado.** No hay runner de tests unitarios; queda cubierto de
  forma indirecta por P.3, P.4 y P.6.
- **Los riesgos conocidos sin criterio propio:** los dos mensajes de error a la vez después de un
  envío fallido, Backspace sobre un separador de miles y pegar texto con guiones. Ninguno se probó.
