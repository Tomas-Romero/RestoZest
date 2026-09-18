# Resto Zest

SaaS multi-tenant de gestión gastronómica, propio (no es un desarrollo para un cliente puntual). **En construcción activa** — Fase 0 de 10 del roadmap, ver `docs/plan/08-roadmap.md`.

---

## ¿Qué es esto?

Un sistema completo de gestión para restaurantes y locales gastronómicos: salón y mesas, mozos, cocina (KDS), caja/POS, administración de catálogo y precios, y un menú digital público — pensado desde el día uno como multi-tenant (un mismo sistema aloja a muchos locales distintos, cada uno viendo solo lo suyo).

La decisión que ordena todo el proyecto no es una feature: es de **dónde vive la verdad durante el servicio**. La arquitectura es nube + **hub local** — una mini-PC físicamente en el salón que mantiene la red del local funcionando aunque se corte internet. El escenario de diseño no es "una tablet perdió WiFi", es *"se cortó internet un viernes a las 21:30 y hay seis dispositivos que necesitan seguir viendo las mismas mesas"* — ahí es donde la mayoría de los sistemas gastronómicos se rompen.

## ¿Para qué sirve?

Un monorepo con **7 apps** y **5 paquetes compartidos**:

| App | Para quién | Rol |
|---|---|---|
| `client` | Comensales | Menú digital público (QR en la mesa), Next.js con SSG/ISR — acá sí importan el SEO y el primer render en 3G |
| `waiter` | Mozos | Tomar la orden con una mano, modificadores, notas, envío a cocina por estación |
| `kds` | Cocina | Tablero Kanban (Pendiente → En preparación → Listo) por comanda, con alertas de tiempo |
| `pos` | Caja | Cobro con medios mixtos, división de cuenta (por partes, por ítem o por monto libre), cierre de turno y cierre Z |
| `admin` | Administración | Catálogo, precios por canal, remarcación masiva con deshacer, reportes |
| `api` | — | Backend compartido. El mismo binario corre en la nube *y* en el hub local, cambiando solo un `ROLE` |
| `hub` | — | La pieza física: el mismo `api` con `ROLE=hub`, Postgres local y Docker Compose, corriendo en una mini-PC en el salón |

Las diez fases del roadmap (`docs/plan/08-roadmap.md`) van, en orden: fundaciones → catálogo y admin → menú digital → salón/órdenes/KDS → POS y caja → **hub local y offline-first** → impresión térmica → pagos y fiscal (Mercado Pago + ARCA/AFIP) → seguridad y backups → roadmap final. El offline-first llega recién en la Fase 5 a propósito: no se puede hacer resiliente algo que todavía no existe.

## ¿Qué tecnologías usa?

| Capa | Elección | Por qué |
|---|---|---|
| Monorepo | **pnpm workspaces + Turborepo** | Un repo, paquetes compartidos, builds incrementales |
| Lenguaje | **TypeScript estricto** en todo | Tipos de dominio compartidos entre servidor, hub y las PWAs |
| Apps operativas (mozos, POS, KDS, admin) | **React 19 + Vite + PWA** (Workbox) | SPA pura — el SSR no aporta nada a una tablet que se abre una vez por turno y vive ocho horas sin recargar |
| App de clientes (menú) | **Next.js** (App Router), SSG + ISR | Acá sí importan SEO y el primer render en una conexión mala |
| UI | Tailwind v4 + shadcn/ui (Radix) | Accesibilidad de teclado y foco resueltas de fábrica |
| Estado de datos | TanStack Query + capa de repositorio propia | La caché se hidrata desde IndexedDB, no directo de la red |
| Base local (dispositivo) | **Dexie** sobre IndexedDB | Solo outbox + snapshot corto — minutos de datos, no una réplica completa |
| Backend | Node 22 + Fastify + Zod | Mismo binario en la nube y en el hub, distinto `ROLE` |
| ORM | Drizzle ORM + drizzle-kit | SQL explícito, migraciones idénticas en ambos lados |
| Base de datos | **PostgreSQL 17**, en la nube *y* en el hub | Mismo motor en los dos lados: mismas migraciones, cero traducción de dialecto |
| Tiempo real | `ws` nativo en el hub · Supabase Realtime en la nube | El KDS se actualiza por LAN aunque no haya internet |
| Auth | Better Auth (nube) + PIN local validado en el hub | El login de un mozo tiene que funcionar sin internet |
| Impresión | `node-thermal-printer` en el hub | Nunca desde el navegador; cola persistida con reintentos |
| Pagos / fiscal | Mercado Pago Orders API · ARCA (ex-AFIP) WSAA + WSFEv1 | El CAE se pide siempre online, desde la nube — nunca desde el hub |
| Testing | Vitest + Playwright, incluido un **test de caos** en CI | Corta la red a mitad de un servicio simulado y verifica que todo siga andando |
| Hosting | VPS (Hostinger, Coolify/Dokploy) o Supabase | Supabase es la vía rápida para las primeras fases; con multi-tenant real, un VPS con Postgres + RLS aloja a todos los clientes sin un proyecto (y una cuenta) por cliente |

## ¿Cómo lo veo funcionando? (demo en vivo)

**Todavía no hay nada desplegado.** El proyecto está en Fase 0 (fundaciones) de diez: hoy existe el monorepo, el esquema de base y el arranque de cada app, pero ningún flujo de punta a punta está listo para mostrarse todavía. El plan completo, fase por fase, con qué significa "listo" en cada una, está en [`docs/plan/08-roadmap.md`](docs/plan/08-roadmap.md).

## ¿Cómo lo corro en mi máquina?

Requiere Node.js ≥ 22 y pnpm (el repo fija `pnpm@11.24.0` en `packageManager`).

```bash
git clone https://github.com/Tomas-Romero/RestoZest.git
cd RestoZest
pnpm install
```

Cada app tiene su propio `.env.example` (`apps/api/.env.example`, `apps/admin/.env.example`) — copiarlos a `.env` y completar la conexión a Postgres antes de levantar nada.

```bash
pnpm dev         # levanta todas las apps en paralelo (turbo run dev)
pnpm typecheck   # chequeo de tipos de todo el monorepo
pnpm lint        # lint de todo el monorepo
pnpm test        # tests (Vitest)
```

Comandos de base de datos (paquete `db`, Drizzle):

```bash
pnpm db:up        # levanta Postgres local (Docker)
pnpm db:migrate   # corre las migraciones
pnpm db:seed      # datos de ejemplo
pnpm db:down      # apaga Postgres local
```

## ¿Qué partes interesantes tiene?

- **El hub local, no IndexedDB, es la primera red de contención.** El diseño parte de un escenario concreto — seis dispositivos en un salón sin internet un viernes a la noche — y decide que la pieza central es una mini-PC en el propio local que mantiene la LAN operativa. IndexedDB en cada dispositivo es la *segunda* capa de resiliencia, no la primera.
- **El mismo motor de base corre en los dos lados.** Se descartó a propósito SQLite para el hub (aunque sea más liviano) para no terminar manteniendo dos dialectos SQL, dos juegos de migraciones y dos comportamientos de `jsonb` — Postgres en una mini-PC N100 va sobrado para 40 mesas, y el ahorro de RAM de SQLite no compensa el doble de mantenimiento.
- **Se descartaron a propósito PowerSync y ElectricSQL.** Esos motores resuelven "replicar toda la base en cada cliente"; con el hub ya en la LAN, cada dispositivo solo necesita una cola de salida y el snapshot de la mesa que está atendiendo — sumar un motor de sync completo sería reemplazar cien líneas de outbox depurables por una dependencia nueva para depurar a las 2 AM.
- **Los IDs son UUIDv7 generados en el propio dispositivo.** Eso permite crear una orden completamente sin red y sincronizarla después sin colisión ni renumeración — la orden ya "existe" con su identidad final antes de que exista conexión.
- **La plata se guarda en enteros (centavos, `bigint`)**, nunca en punto flotante — una decisión chica que evita una categoría entera de bugs de redondeo, particularmente relevante en un contexto de inflación y remarcaciones frecuentes.
- **`order_events` es la única vía de escritura del núcleo operativo**, con `orders` y `order_items` como proyecciones derivadas — el criterio de "listo" de la Fase 3 es literal: borrar las proyecciones, reproducir el log de eventos desde cero, y obtener exactamente el mismo estado.
- **Niveles de degradación explícitos (L0–L3)** gobiernan qué botones se habilitan en cada app según qué tan offline está el dispositivo (`canDo(action, level)`) — la interfaz nunca deja que alguien intente una acción que el nivel de conectividad actual no puede sostener.
- **La documentación de arquitectura se escribió completa antes del código**, en diez documentos numerados con una instrucción explícita: "no leas todo esto de una — cada archivo se lee cuando la tarea lo pide."

---

*Este README fue redactado a partir de `docs/plan/*.md` del propio repo — no los reemplaza, los resume para quien llega por primera vez. Para el detalle real de cada decisión, esos documentos son la fuente.*
