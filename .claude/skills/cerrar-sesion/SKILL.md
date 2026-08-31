---
name: cerrar-sesion
description: Deja el proyecto listo para la próxima sesión. Correlo siempre antes de /clear.
disable-model-invocation: true
---

# Cerrar sesión

El objetivo es que la próxima sesión —que arranca con contexto vacío— pueda
retomar sin que yo tenga que explicar nada. El código y estos archivos son la
única memoria que sobrevive.

## Pasos

1. Corré `pnpm typecheck && pnpm lint && pnpm test`. Reportá el resultado.
   Si algo falla, decímelo antes de seguir: capaz conviene arreglarlo ahora.

2. Actualizá `docs/ESTADO.md`:
   - Movés a "Hecho" lo que se completó, con la fecha.
   - En "En curso" dejás lo que quedó a medias, con el archivo y la línea exactos
     donde retomar y qué falta.
   - En "Decisiones de esta sesión" anotás lo que definimos y no está escrito en
     ningún otro lado. Sé concreto: "elegimos X porque Y", no "se avanzó en el módulo".
   - En "Trampas encontradas" anotás cualquier cosa que te costó descubrir y que
     la próxima sesión va a volver a pisar si no está escrita.

3. Si en esta sesión tomamos una decisión de arquitectura, escribí un ADR nuevo
   en `docs/adr/NNNN-titulo.md` con tres párrafos: contexto, decisión, consecuencias.

4. Si aprendimos una convención que aplica siempre, proponeme agregarla a
   `CLAUDE.md` o a la regla de `.claude/rules/` que corresponda. **Proponé, no
   edites CLAUDE.md sin que yo lo apruebe**: ese archivo se carga en cada sesión
   y tiene que quedarse corto.

5. Hacé el commit con un mensaje descriptivo en español. No hagas push.

6. Decime en dos líneas con qué arrancar la próxima sesión.
