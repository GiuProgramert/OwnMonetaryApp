# Plantilla de plan

Estructura de `docs/plans/<feature>-implementation.md`. Las secciones marcadas *(si aplica)* se
omiten cuando no hay nada real que poner — una sección vacía o de relleno es peor que no tenerla.

---

```markdown
# Plan: <título en minúscula, descriptivo, no el nombre técnico>

**Fecha:** <YYYY-MM-DD>
**Estado:** propuesto — nada implementado todavía

## Objetivo

Dos o tres oraciones: qué queda funcionando cuando el plan se termina, en términos de lo que el
usuario puede hacer. No es el resumen del plan, es el resultado.

## Cómo ejecutar este plan

Este bloque se copia tal cual, y le habla a quienes ejecuten — que no son quien lo escribió y no
vieron la conversación donde se decidió todo esto.

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

Lo que ya existe y **hay que reusar, no reescribir** — con nombre y archivo.

Y después: las restricciones del sistema que condicionan el diseño, numeradas para que las fases
las puedan referenciar. Solo las que cambian qué se puede construir.

1. **<Restricción>.** Qué es y qué consecuencia tiene.

## Decisiones tomadas

Una viñeta por decisión, en negrita el qué, seguido del porqué **y de la contrapartida aceptada**.
Acá aterrizan las decisiones bloqueantes que el usuario respondió en el chat.

- **<Qué se decidió>.** Por qué, contra qué alternativa, y qué se pierde. Si tiene consecuencia
  sobre algún punto del plan, decir cuál.

## Dependencias externas (si aplica)

Lo que el plan necesita y no está en el repo: un archivo real de ejemplo, una credencial, un acceso.
Si algo es bloqueante, decirlo acá y no distribuirlo entre las fases.

## Arquitectura (si aplica)

Solo si el diseño no se entiende leyendo las fases. Un diagrama ASCII del flujo y el árbol de
archivos nuevos valen más que tres párrafos. Marcá qué parte es la que absorbe la variación.

## Fase 1 — <nombre>

- [ ] **1.1** <Punto accionable: qué archivo, qué queda funcionando, y el porqué si no es obvio.>
- [ ] **1.2** ⚠️ <Punto con una advertencia: el caso borde o el orden que no se puede invertir.>

> Razonamiento largo detrás de alguna decisión de esta fase, si un lector futuro la va a cuestionar.

## Fase 2 — <nombre>

- [ ] **2.1** …

## Fase N — Cierre

Siempre presente. Siempre incluye:

- [ ] **N.1** `npm run lint` y `npm run build`. <Dónde suele romper esto en particular.>
- [ ] **N.2** Documentar en `docs/<archivo>.md`: <qué>.
- [ ] **N.3** Agregar a `CLAUDE.md` la sección del módulo nuevo y las reglas que impone.
- [ ] **N.4** Notas de cierre al final de este documento, con lo que se desvió del plan — *las
  escribe el orquestador al terminar las pruebas, no el implementador.*

Los casos borde no van acá: van en *Criterios de prueba*.

## Criterios de prueba

Lo que el tester verifica en el navegador con el usuario de QA y deja escrito como test en
`e2e/<feature>.spec.ts`, nombrado con el id (`test("P.1 — …")`). Numeración estable, igual que los
puntos. Cada criterio: los puntos que cubre, los datos que el test crea (y borra), la acción, y el
resultado **concreto** que se ve. Incluye los bordes (vacío, límite, validación, el caso de cada
⚠️) y, si hay UI nueva, la vista mobile.

- **P.1** (<puntos>) — Con <datos que crea el test>, en `<ruta>` <acción> ⇒ <resultado observable:
  texto, monto, URL, elemento que aparece o desaparece>.
- **P.2** (<puntos>) — <borde: vacío / límite / error de validación con su mensaje exacto>.

**No cubierto por e2e** *(si aplica)*: lo que no se puede probar desde el navegador (RPC sin UI,
trigger, algo que depende del paso del tiempo, algo que el usuario QA no tiene permiso de hacer,
como crear `movement_types`) y cómo se verifica en su lugar.

- **<Qué>** — <cómo se verifica: query de `docs/database.md`, a mano, o no se verifica>.

## Fuera de alcance

Lo que se propuso y se descartó, **con el motivo**, y lo que directamente no entra en este plan.
Sin esta sección, quien implemente re-agrega de buena fe justo lo que se decidió sacar.

- **<Lo descartado>** — por qué quedó afuera y, si corresponde, qué haría falta para que entre.

## Riesgos conocidos

Lo que puede salir mal y no lo cubre ningún punto. Sobre todo: qué toca este plan que ya funciona
hoy, y cómo verificar que no se rompió.

## Registro de ejecución   ← lo agrega y lo lleva el orquestador al ejecutar, no antes

- **Ronda 1 (<YYYY-MM-DD>)** — implementador: puntos <…>; desvíos: <…>. Tester: <P.n pasan>;
  incidencias I-1 <resumen> (punto <X.Y>) → corregida en ronda 2.
- **Bloqueos y respuestas del usuario** — <pregunta> → <respuesta textual>.
- **Correcciones pedidas después del cierre** — C-1 <pedido textual> → <qué se cambió, test que
  la cubre>.

## Notas de cierre (ejecución del <YYYY-MM-DD>)   ← las escribe el orquestador al terminar

Qué se desvió del plan y por qué. Qué quedó sin hacer, con el motivo. Qué incidencias aparecieron y
cómo se resolvieron. Qué tests quedaron en `e2e/` (`npm run test:e2e`). Qué se verificó y **qué no
se pudo verificar** — esto último es lo más importante de la sección.
```
