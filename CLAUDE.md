# Resto Zest

SaaS multi-tenant de gestión gastronómica. Cinco apps operativas + menú público,
arquitectura nube + hub local en el salón, offline-first.

El plan técnico completo vive en `docs/plan/`. **No lo leas entero**: leé solo la
sección que corresponde a la tarea. El índice está en `docs/plan/README.md`.
El estado actual del proyecto está en `docs/ESTADO.md` — leelo al empezar cualquier sesión.

## Reglas del modelo de datos (no negociables)

1. **Plata en `bigint` centavos.** Nunca `float` ni `numeric` en TypeScript. Un solo helper formatea a pesos.
2. **Precios y nombres congelados en la línea de la orden.** `order_items` guarda `unit_price_cents`, `name_snapshot` y `cost_snapshot_cents`. Jamás recalcular una orden pasada joinando a `products`.
3. **PK UUIDv7 generada en el cliente**, nunca en la base. Es también la clave de idempotencia.
4. **Borrado lógico siempre** (`deleted_at`). Nunca `DELETE` físico en tablas que sincronizan.
5. **Toda tabla operativa lleva `venue_id`** además de `tenant_id`, con RLS activo.

## Regla de arquitectura (no negociable)

Las órdenes son **event-sourced**. Toda mutación entra como fila en `order_events`;
un reductor puro en `packages/domain` proyecta a `orders` / `order_items`.
**Está prohibido el `UPDATE` directo sobre `orders` y `order_items`** fuera del proyector.
Si una tarea parece necesitar uno, es señal de que falta un tipo de evento.

Cada entidad tiene **un único dueño de escritura**: catálogo y usuarios se escriben
en la nube; órdenes, pagos y stock en el hub; comprobantes fiscales solo en la nube.
Nunca agregues un flujo que escriba la misma entidad desde los dos lados.

## Estructura

```
apps/     api · hub · admin · pos · waiter · kds · client
packages/ domain · db · ui · sync · printing
docs/     plan/ · adr/ · ESTADO.md
```

- `apps/api` y `apps/hub` son el **mismo binario** con distinto `ROLE`. No dupliques lógica.
- `apps/client` es Next.js (SEO). Las cuatro apps operativas son Vite + React SPA + PWA.
- `packages/domain` no importa nada de infraestructura: tipos, reductores y reglas puras.

## Comandos

```bash
pnpm dev            # todo el monorepo
pnpm dev --filter=pos
pnpm test           # vitest
pnpm test:e2e       # playwright, incluye el test de caos
pnpm db:generate    # drizzle-kit generate
pnpm db:migrate
pnpm typecheck && pnpm lint
```

## Convenciones

- TypeScript estricto. Nada de `any`; si hace falta, `unknown` + Zod.
- Validación de entrada con Zod en el borde; adentro se confía en los tipos.
- Nombres de tablas y columnas en `snake_case` inglés; UI y comentarios en español.
- Tests con Vitest junto al código (`*.test.ts`). E2E en `e2e/`.
- Commits en español, imperativo, uno por sub-entregable.

## Cómo trabajamos

- **Una sesión = un sub-entregable.** Al terminar, actualizá `docs/ESTADO.md` (usá `/cerrar-sesion`).
- En módulos grandes, primero plan y esquema de datos; esperá aprobación antes de codear.
- **Tests antes que implementación** en cuatro lugares: el reductor de eventos, el outbox,
  la aritmética de plata y la división de cuentas. En el resto, tests después está bien.
- Decisión de arquitectura nueva → un ADR corto en `docs/adr/`.
- Antes de dar por terminada una tarea: `pnpm typecheck && pnpm lint && pnpm test` en verde.

## Qué NO hacer sin preguntar

- Cambiar el esquema de una tabla que ya tiene datos en producción.
- Agregar una dependencia pesada nueva (evaluamos alternativas primero).
- Tocar el flujo fiscal o de pagos: son los dos lugares donde un bug cuesta plata real.
- Generar números de comprobante, CAE o cualquier secuencia global del lado del cliente.
