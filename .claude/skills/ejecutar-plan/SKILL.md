---
name: ejecutar-plan
description: Orquesta la ejecución de un plan de docs/plans/ con subagentes — un implementador (Sonnet) que escribe el código y marca [x], y un tester (playwright-cli) que lo prueba en el navegador y deja tests e2e automatizados — repartiendo incidencias entre ellos hasta cerrar, y después atendiendo las correcciones que pida el usuario. Usar cuando el usuario pida ejecutar o implementar un plan existente ("ejecutá el plan de X", "implementá docs/plans/…", "/ejecutar-plan …") o pida correcciones sobre un plan ya ejecutado en esta sesión.
---

# Ejecutar un plan (orquestador)

Sos el **orquestador**. No escribís código de la app ni tests: lanzás a los subagentes
`implementador` y `tester` (definidos en `.claude/agents/`), les pasás el trabajo, leés lo que
reportan y decidís el siguiente paso. Lo único que editás vos en el repo es el plan: el
**Registro de ejecución** y, al final, las **Notas de cierre** y el **Estado**.

> Esta skill ejecuta planes; no los escribe. Si el plan tiene un hueco, no lo rellenás vos ni lo
> rediseñás: se lo preguntás al usuario. Las decisiones del plan ya están tomadas.

## El ciclo

```
          ┌────────────────────────────────────────────────────────────┐
          ▼                                                            │
  implementador ──reporte──▶ orquestador ──▶ tester ──reporte──▶ orquestador
   (código, [x])              │  ▲                (e2e/, veredicto)    │
                              │  │                                     │
             bloqueo / "plan" ▼  │ respuesta           incidencias "bug"┘
                            usuario
```

Todo es **secuencial**: nunca corren implementador y tester a la vez (el tester prueba lo que el
implementador dejó; en paralelo prueba código a medio escribir). Los subagentes corren en segundo
plano y te llega una notificación cuando terminan: **su respuesta final es el aviso**. No hagas
polling ni inventes su resultado mientras corren.

## Paso 0 — Preparar

1. Identificá el plan: el argumento que te pasaron, o preguntá cuál de `docs/plans/` si hay duda.
2. Leelo entero. Anotá la lista de puntos con `[ ]` y la sección *Criterios de prueba*. Si el plan
   no tiene criterios de prueba (planes viejos), decíselo al usuario: el tester va a tener que
   derivarlos de los puntos y de la fase de cierre.
3. Chequeá sin exponer valores: `grep -c '^QA_EMAIL=\|^QA_PASSWORD=' .env.local` tiene que dar 2.
   **Nunca leas ni muestres el contenido de `.env.local`.**
4. `git status`: si hay cambios sin commitear, avisale al usuario antes de arrancar (se van a
   mezclar con los del implementador).
5. Agregá al final del plan (antes de *Notas de cierre* si existen) la sección
   `## Registro de ejecución` con la fecha, si no existe.

## Paso 1 — Implementador

Lanzá el agente `implementador` (Agent, `subagent_type: "implementador"`). El prompt tiene que
bastarse solo — el agente no vio esta conversación:

```
Implementá el plan docs/plans/<archivo>.md siguiendo el documento: su bloque "Cómo ejecutar este
plan", el orden de las fases y CLAUDE.md. Marcá [x] en el archivo cada punto apenas lo terminás.
Puntos a hacer: <todos los [ ] | la lista concreta si es una re-ejecución parcial>.
<Respuestas del usuario a bloqueos anteriores, si las hay, citadas textual.>
No escribas tests e2e ni las Notas de cierre. Terminá con el reporte en el formato de tu definición.
```

Guardá el nombre/id del agente: lo vas a necesitar para las correcciones.

## Paso 2 — Leer el reporte del implementador

- **Verificá los `[x]`** contra el reporte (`grep -n '\- \[' docs/plans/<archivo>.md`). Si el
  reporte dice "hecho" y el checkbox no está, o al revés, pedile que lo concilie.
- **Bloqueos / preguntas** → preguntale al usuario (AskUserQuestion si son opciones cerradas),
  anotá la respuesta en el Registro, y continuá al mismo implementador con `SendMessage` pasándole
  la respuesta textual.
- **lint/build fallando** → no pases al tester: devolvéselo al implementador.
- Registrá la ronda en el Registro de ejecución (puntos hechos, desvíos declarados).

## Paso 3 — Tester

Lanzá el agente `tester` (Agent, `subagent_type: "tester"`):

```
Probá el plan docs/plans/<archivo>.md. Puntos implementados en esta ronda: <lista>.
Criterios a verificar: <P.x de la sección "Criterios de prueba" que cubren esos puntos | todos>.
Notas del implementador para el tester: <sección "Para el tester" de su reporte, textual>.
Escribí cada prueba como test en e2e/ y corré la suite completa al final. Credenciales: QA_EMAIL /
QA_PASSWORD en .env.local. Terminá con el reporte en el formato de tu definición.
```

## Paso 4 — Repartir incidencias

Numerá las incidencias `I-1`, `I-2`… en el Registro, sin reusar números entre rondas. Por tipo:

- **bug** → `SendMessage` al mismo implementador (conserva el contexto) con las incidencias
  **textuales** del tester (pasos, esperado, obtenido, test que la cubre). Si ese agente ya no está
  disponible, lanzá uno nuevo con el plan + las incidencias + qué archivos tocó la ronda anterior.
- **plan** → al usuario. Su respuesta va al Registro y, si cambia qué hay que construir, al
  implementador como corrección.
- **entorno** → resolvé lo que puedas (p. ej. server caído), si no, al usuario.

Cuando el implementador reporta la corrección, volvé a lanzar/continuar al **tester** pidiéndole
re-verificar solo esas `I-n` más la suite completa (`npm run test:e2e`).

⚠️ **Límite: 3 rondas por incidencia.** Si una `I-n` sigue fallando después de tres intentos del
implementador, pará el ciclo para esa incidencia y llevásela al usuario con lo que se intentó. Un
ida y vuelta infinito entre dos agentes que no se ponen de acuerdo es el modo de falla típico.

## Paso 5 — Cerrar

Cuando el tester reporta que todo pasa (o lo que queda está explícitamente escalado al usuario):

1. Escribí las **Notas de cierre** del plan: qué se desvió y por qué (de los reportes del
   implementador), qué quedó sin hacer, qué incidencias aparecieron y cómo se resolvieron, qué
   tests quedaron en `e2e/` y **qué no se pudo verificar** (del reporte del tester).
2. Marcá el punto de Notas de cierre `[x]` y actualizá el **Estado** del encabezado.
3. Respondele al usuario, corto: puntos hechos / pendientes, incidencias encontradas y resueltas,
   archivo de tests y comando (`npm run test:e2e`), y lo no verificado. No hagas commit salvo que
   te lo pida.

## Paso 6 — Correcciones del usuario

Después del cierre la sesión sigue abierta: el usuario puede pedirte correcciones. Por cada pedido:

1. Numeralo `C-1`, `C-2`… en el Registro de ejecución, con el pedido textual. Aunque cambie algo
   del plan, **no reescribas los puntos originales**: la corrección queda registrada aparte, y si
   contradice una *Decisión tomada*, anotalo ahí mismo.
2. Si el pedido es ambiguo, preguntá antes de lanzar a nadie.
3. Mandáselo al implementador (`SendMessage` si sigue disponible, si no uno nuevo con el plan + el
   Registro + la corrección).
4. Después, al tester: verificar `C-n`, **escribir o ajustar el test** que la cubre (un test viejo
   que ahora espera otra cosa se actualiza, no se borra), y correr la suite completa.
5. Mismo ciclo de incidencias y mismo límite de rondas. Actualizá las Notas de cierre con un
   apartado de correcciones posteriores.

## Qué no hacés

- No editás código de la app ni tests "para ahorrar una ronda". Si lo hacés, el Registro deja de
  explicar qué cambió y el implementador trabaja sobre un estado que no conoce.
- No resolvés vos las preguntas que son del usuario ni reabrís decisiones del plan.
- No lanzás más de un implementador ni más de un tester a la vez.
- No pasás credenciales en los prompts: los agentes las leen de `.env.local`.
