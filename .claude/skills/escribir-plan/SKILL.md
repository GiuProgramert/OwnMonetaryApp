---
name: escribir-plan
description: Escribe un plan de implementación numerado en docs/plans/ siguiendo la convención de este repo — explorar el código real, mostrar los puntos en el chat para que el usuario pode antes de escribir nada, y recién después generar el documento. Usar cuando el usuario pida planear, planificar o diseñar una feature, un módulo, una refactorización o un cambio grande ("planeemos X", "quiero planear lo que agregaremos en Y", "hacé un plan para Z", "plan for", "let's plan").
---

# Escribir un plan de implementación

Un plan de este repo no es una lista de tareas: es **el documento donde quedan escritas las
decisiones y el porqué de cada una**, para que la sesión que lo ejecute (o el vos de dentro de tres
meses) no las vuelva a discutir. Los planes existentes son
[`docs/plans/movements-implementation.md`](../../../docs/plans/movements-implementation.md) y
[`docs/plans/movements-import-implementation.md`](../../../docs/plans/movements-import-implementation.md)
— leé uno antes de escribir el tuyo.

Todo el documento va **en español**, igual que el resto de `docs/`.

> **Esta skill es para escribir un plan, no para ejecutarlo.** Si lo que tenés que hacer es
> implementar un plan que ya existe, seguí el bloque "Cómo ejecutar este plan" del propio documento
> y no vuelvas sobre esta skill: acá abajo hay método de planificación, y aplicarlo mientras se
> implementa lleva a reabrir decisiones que ya están cerradas.

## Quien ejecuta el plan no es quien lo escribe

**El agente que implementa arranca en frío.** No vio la conversación, no sabe qué se descartó, no
sabe por qué el punto 5.3 dice lo que dice. Lo único que recibe es el archivo. De ahí salen cinco
reglas que atraviesan todo lo demás:

1. **El documento se basta solo.** Nada de "como hablamos", "el enfoque que elegiste", "la opción
   b". Si una decisión importa, va escrita completa, con sus alternativas y su porqué — aunque en el
   chat ya fuera obvio.
2. **Rutas y nombres exactos, no descripciones.** `components/movements/filters.tsx`, no "el
   componente de filtros". `getMovementsTotals`, no "el servicio de totales". El implementador busca
   por nombre; una descripción lo manda a adivinar.
3. **Lo descartado se escribe.** Es la sección *Fuera de alcance*, y es la que más se olvida. Sin
   ella, el implementador re-agrega por iniciativa propia justo lo que el usuario mandó sacar, y lo
   hace convencido de estar ayudando.
4. **Las dependencias entre puntos van dichas.** "6.6 necesita un parámetro de orden en
   `getMovements`, que hoy siempre ordena por fecha". Quien ejecuta puede tomar los puntos de a uno,
   en sesiones distintas o en paralelo: lo que no está escrito como dependencia, se pisa.
5. **El plan tiene fecha y el código sigue vivo.** Todo lo que el plan afirma sobre el código puede
   haber cambiado desde entonces. Por eso el documento lleva su propio bloque de instrucciones de
   ejecución (ver abajo): el implementador puede no tener esta skill cargada.

### El bloque "Cómo ejecutar este plan"

Va **dentro del documento**, después del Objetivo, y le habla al implementador. Cubre: verificar
que lo que el plan afirma del código siga siendo cierto antes de arrancar; seguir el orden de las
fases salvo que se diga lo contrario; **parar y preguntar** cuando la realidad contradice al plan,
en vez de improvisar una salida; no ampliar el alcance; y marcar `[x]` a medida que avanza.

La plantilla lo trae redactado — se copia tal cual.

## El flujo tiene dos tiempos, y no se saltea el primero

### Tiempo 1 — Explorar y mostrar los puntos en el chat

**No escribas ningún archivo todavía.** Ni el plan, ni código, ni un borrador.

1. **Leé el código real primero.** Los archivos que la feature va a tocar, los servicios y
   componentes que ya existen, `CLAUDE.md`, y `docs/database.md` si hay base de por medio. Un plan
   escrito sin leer el código propone reescribir cosas que ya están hechas y se pierde las
   restricciones que importan.
2. **Anotá lo reutilizable.** Este repo tiene mucho: `AccountSelect`, `MovementsTotals`,
   `FormContainer`, `TableSkeleton`, el patrón de filtros por `searchParams`. Cada punto del plan
   que reinventa algo existente es un punto malo.
3. **Buscá las restricciones que condicionan el diseño**, no las que son trivia. Las buenas son las
   que cambian *qué* se puede construir: un dato que no existe en el modelo, un límite del runtime
   o de la API, un trigger que ya escribe la columna que ibas a escribir vos.
4. **Mostrá los puntos numerados en el chat**, agrupados por fase, y decí explícitamente que no
   escribiste nada.
5. **Separá lo que pidió el usuario de lo que agregaste vos.** Marcá tus ideas con *(idea mía)* y
   cerrá con un resumen de qué es de cada uno, para que podar sea decir "sacá 4.3 y 5.6" y nada más.
   **Lo que el usuario pode no se borra: baja a *Fuera de alcance* con el motivo.** Un punto
   eliminado y no registrado vuelve solo, propuesto de nuevo por el agente que implementa.
6. **Terminá con las decisiones que bloquean.** Ver abajo.

### Tiempo 2 — Escribir el documento

Solo después de que el usuario respondió. Ahí sí, `docs/plans/<feature>-implementation.md` con la
estructura de [`plantilla.md`](plantilla.md).

Al entregarlo, contá **qué cambió respecto de lo que mostraste en el chat**: renumeraciones,
puntos que aparecieron al escribir el detalle, dependencias ocultas que salieron a la luz. Si no
cambió nada, es señal de que no pensaste al escribirlo.

## Las decisiones bloqueantes

Al final del Tiempo 1, presentá **2 a 4 decisiones** que el usuario tiene que tomar. Una decisión
califica solo si **respuestas distintas producen trabajo distinto**. Si podés elegir vos sin
arrepentirte, elegí vos y decilo.

Cada una lleva: las opciones reales, qué se gana y qué se pierde con cada una, y **tu
recomendación**. Nunca una lista de opciones sin postura.

> Ejemplo del plan del dashboard: "¿la torta muestra el saldo actual o el flujo del período?" era
> bloqueante — la opción (a) hace que el gráfico ignore el filtro de fecha, y eso obliga a agregar
> un punto sobre el texto del card que con la opción (b) no existiría.

Lo que **no** es una decisión bloqueante: cómo nombrar un archivo, qué primitivo de shadcn usar,
si conviene un `<Card>` o un `<div>`. Eso se decide y se anota.

Cuando el usuario responde, esas decisiones **suben a la sección "Decisiones tomadas" con su
porqué**. Ese es el punto de todo el ejercicio: que nadie las vuelva a discutir.

## Cómo se escribe un punto

Numeración `X.Y`, con checkbox, **estable**: el número es cómo se habla del punto ("cambiá el 5.3"),
así que no se renumera después de acordado. Si se agrega algo en el medio, va como `5.3.1` o al
final de la fase.

Un punto bueno:

- **Es accionable y verificable.** Nombra el archivo que crea o toca, y qué queda funcionando.
- **Dice el porqué cuando no es obvio.** No "barras horizontales", sino "barras horizontales, no
  verticales: los nombres en español son largos y rotados quedan ilegibles".
- **Cabe en una cabeza.** Si necesita tres párrafos, son tres puntos.

```markdown
- [ ] **5.4** `expenses-by-type-chart.tsx` — **barras horizontales**, no verticales: los nombres de
  los tipos de movimiento son largos en español y en vertical quedan rotados e ilegibles.
```

Un punto malo: "investigar cómo hacer los gráficos", "mejorar la UX", "agregar tests" (¿de qué?),
"refactorizar el servicio" (¿en qué queda?).

### Marcas que el plan usa

- **⚠️ inline** en el punto exacto donde algo muerde: un caso borde, un orden que no se puede
  invertir, una API que hace lo contrario de lo que parece. No al final en una sección de notas
  que nadie lee cuando está ejecutando el punto 3.7.
- **Citas `>`** para el razonamiento largo detrás de una decisión que un lector futuro va a
  cuestionar. Van pegadas a la fase que explican.
- ***(opcional)*** en los puntos que se pueden saltear sin romper el resto. Y respetalos al
  ejecutar: si el plan dice opcional, no lo implementes por las tuyas.

## Las secciones que hacen la diferencia

La plantilla las tiene todas, pero estas cuatro son las que separan un plan útil de una lista de
tareas:

- **Contexto / restricciones.** Lo que descubriste leyendo el código y condiciona el diseño.
  Numeradas, porque las fases las van a referenciar.
- **Decisiones tomadas.** Qué se decidió **y por qué**, incluida la contrapartida que se aceptó.
  Sin la contrapartida escrita, la decisión se relitiga sola.
- **Fuera de alcance.** Lo que se propuso y se descartó, con el motivo, y lo que directamente no
  entra. Es la única defensa contra que el implementador lo re-agregue de buena fe. Si el usuario no
  podó nada, decilo — "el usuario revisó los puntos y no eliminó ninguno" también es información.
- **Riesgos conocidos.** Lo que puede salir mal y no lo cubre ningún punto. Especialmente: lo que
  este plan toca y afecta a pantallas que ya funcionan.

## Fases

Agrupá por **capa o por dependencia**, no por tamaño. En este repo suele caer así, y el orden
importa porque cada fase se apoya en la anterior:

```
1. Dependencias y primitivas     (npx shadcn add …, verificar variables de CSS)
2. Base de datos                 (triggers, RPC, RLS — solo si hace falta)
3. Schemas y servicios           (lib/schemas/, lib/services/)
4. Componentes                   (components/<entidad>/)
5. Páginas y rutas               (app/protected/…)
6. Cierre                        (lint, build, bordes, docs, notas)
```

La **fase de cierre nunca se omite** y siempre incluye: `npm run lint` y `npm run build`, la lista
concreta de casos borde a probar (no "probar bien"), qué documentar en `docs/` y `CLAUDE.md`, y el
punto de escribir las notas de cierre.

## Cuando el plan se ejecuta

Esto vale igual si lo ejecutás vos en otra sesión o si lo ejecuta otro agente — por eso está
duplicado dentro del documento, en el bloque "Cómo ejecutar este plan". La duplicación es a
propósito: quien implementa puede no tener esta skill cargada.

- Marcá `[x]` a medida que avanzás, en el archivo.
- Un punto que quedó afuera se marca `[ ]` **con el motivo escrito ahí mismo** — bloqueado, sin
  acceso, explícitamente opcional. Nunca se borra el punto.
- Actualizá el **Estado** del encabezado.
- Agregá **Notas de cierre** al final: qué se desvió del plan, qué se verificó y qué no se pudo
  verificar. Ser honesto acá es lo que hace que el próximo plan sirva; ver el cierre de
  `movements-implementation.md`, que dice cuál fase quedó bloqueada y por qué.
