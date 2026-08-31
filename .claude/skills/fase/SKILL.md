---
name: fase
description: Arranca o continúa una fase del roadmap de GastroControl. Uso: /fase 3
disable-model-invocation: true
---

# Arrancar una fase del roadmap

El usuario indicó un número de fase (0 a 10). Si no indicó ninguno, leé
`docs/ESTADO.md` y proponé la que sigue, pero preguntá antes de arrancar.

## Pasos

1. Leé `docs/ESTADO.md` para saber qué está hecho y qué quedó pendiente.
2. Leé la fase correspondiente en `docs/plan/08-roadmap.md` — **solo esa fase**,
   no el archivo entero si podés evitarlo.
3. Leé las secciones del plan que esa fase menciona. Guía rápida:
   - Fase 0 → `03-modelo-datos.md`, `02-stack.md`
   - Fase 1 → `03-modelo-datos.md`
   - Fase 2 → `02-stack.md`
   - Fase 3 → `03-modelo-datos.md`, `04-offline-first.md`
   - Fase 4 → `03-modelo-datos.md`
   - Fase 5 → `04-offline-first.md`, `01-arquitectura.md` (leelas enteras)
   - Fase 6 → `05-impresion.md`
   - Fase 7 → `06-pagos-fiscal.md`
   - Fase 8 → `03-modelo-datos.md`
   - Fase 9 → `02-stack.md`
4. **Partí la fase en sub-entregables** de una sesión cada uno y mostrame la lista.
   Una fase completa no entra en una sola sesión: no intentes hacerla toda.
5. Esperá que yo elija el sub-entregable antes de escribir código.
6. Si el sub-entregable toca esquema de datos o sincronización, mostrame primero
   el esquema y los tipos, y esperá aprobación.

## Al terminar

Corré `pnpm typecheck && pnpm lint && pnpm test`. Si está todo en verde,
verificá el criterio de "Listo cuando" de la fase y decime si se cumple o qué falta.
Después usá `/cerrar-sesion`.
