# Cómo trabajar con Claude Code en este proyecto

**CLAUDE.md desde la Fase 0**

Convenciones del repo, las cinco reglas del modelo de datos, el patrón event-sourced y la prohibición de `UPDATE` directo sobre órdenes. Es lo que evita que dentro de tres meses aparezca código que rompe la sincronización sin que nadie se dé cuenta.

**Una fase, una rama, un PR**

Y dentro de la fase, un commit por sub-entregable. Si una sesión se va de tema, es más fácil descartar.

**Planificá antes de codear**

En módulos grandes (Fases 3, 4, 5, 7) pedí el plan y el esquema de datos primero, revisalo, y recién después dale luz verde. Corregir un esquema en una conversación cuesta minutos; corregirlo con la UI construida encima cuesta días.

**Tests primero donde duele**

El reductor de eventos, el outbox, la aritmética de plata y la división de cuentas. En estos cuatro lugares escribí los tests antes que la implementación; en el resto alcanza con tests después.

**Un ADR por decisión grande**

`docs/adr/0001-hub-local.md`. Tres párrafos: contexto, decisión, consecuencias. Sirve para que Claude entienda el porqué en sesiones futuras, y para vos dentro de seis meses.

**Datos de prueba realistas**

Un seed con el menú completo de una rotisería de verdad: empanadas por unidad y por docena, milanesas con guarnición a elección, promos de fin de semana. El sistema tiene que estar bien en ese caso, no con «Producto 1».
