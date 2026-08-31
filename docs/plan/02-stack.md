# Stack tecnológico

El criterio: **un solo lenguaje, un solo motor de base, dos targets de despliegue**. El mismo código de dominio corre en la nube y en el hub, cambiando solo la configuración.

| Capa                     | Elección                                             | Notas                                                                  |
|--------------------------|------------------------------------------------------|------------------------------------------------------------------------|
| Monorepo                 | pnpm workspaces + Turborepo                          | Un repo, apps y packages compartidos, builds incrementales             |
| Lenguaje                 | TypeScript estricto en todo                          | Tipos de dominio compartidos entre servidor, hub y PWAs                |
| Apps operativas          | React 19 + Vite + PWA (Workbox)                      | Mozos, POS, KDS, Admin. SPA pura: el SSR es inútil sin internet        |
| App de clientes          | Next.js (App Router), SSG + ISR                      | Menú público y delivery. Acá sí importan SEO y primer render en 3G     |
| UI                       | Tailwind v4 + shadcn/ui (Radix)                      | Accesibilidad de teclado y foco resueltas de fábrica                   |
| Animación                | Motion (ex Framer Motion)                            | Solo en la app de clientes. En el POS, la velocidad es la UX           |
| Estado de datos          | TanStack Query + capa de repositorio propia          | La caché de Query se hidrata desde IndexedDB, no desde la red          |
| Base local (dispositivo) | Dexie sobre IndexedDB                                | Solo outbox + snapshot corto. El hub hace el trabajo pesado            |
| Backend                  | Node 22 + Fastify + Zod                              | Mismo binario en nube y hub, distinto `ROLE`                           |
| ORM / migraciones        | Drizzle ORM + drizzle-kit                            | SQL explícito, migraciones versionadas que corren igual en ambos lados |
| Base de datos            | PostgreSQL 17 en nube *y* en el hub                  | Mismo motor = mismas migraciones, mismo SQL, cero traducción           |
| Tiempo real              | `ws` nativo en el hub · Supabase Realtime en la nube | El KDS se actualiza por LAN aunque no haya internet                    |
| Auth                     | Better Auth (nube) + PIN local validado en el hub    | Ver sección 07: el login de mozo *debe* funcionar offline              |
| Impresión                | `node-thermal-printer` en el hub                     | Nunca desde el browser. Cola persistida con reintentos                 |
| Archivos                 | Cloudflare R2 (S3-compatible)                        | Fotos de platos + destino de backups off-site                          |
| Jobs                     | BullMQ + Redis (nube) · `pg-boss` (hub)              | Fiscal, webhooks, rollups de reportes                                  |
| Observabilidad           | Sentry + pino + heartbeat de hubs                    | Un panel que muestra qué hub está vivo y cuánto outbox tiene pendiente |
| Testing                  | Vitest + Playwright                                  | Incluye un test de caos que mata la red en medio del servicio          |
| Hosting                  | VPS Hostinger (Coolify o Dokploy) o Supabase         | Ver la nota de abajo                                                   |

### Decisiones que conviene entender, no solo aceptar

Vite SPA para las apps operativas, Next.js solo para el menú público

Next.js optimiza el primer render desde el servidor. Una tablet de mozo se abre una vez por turno y después vive ocho horas sin recargar, muchas veces sin internet. Ahí el SSR no aporta nada y el App Router complica el control fino del service worker.

Descartado: Next.js para todo. Simplifica el repo pero pelea contra el requisito principal.

Postgres también dentro del hub

Tentador usar SQLite en el hub por lo liviano. Pero entonces mantenés dos dialectos de SQL, dos juegos de migraciones y dos comportamientos distintos de `jsonb`, tipos y transacciones. Postgres en Docker en una mini-PC N100 va sobrado para 40 mesas.

Descartado: SQLite en el hub. Ahorra 300 MB de RAM y cuesta el doble de mantenimiento para siempre.

Dexie, no PowerSync ni ElectricSQL

Los motores de sync local-first resuelven «replicar toda la base en cada cliente». Con el hub en la LAN, el dispositivo solo necesita una cola de salida y un snapshot de la mesa que está atendiendo: minutos de datos, no gigabytes. Sumar PowerSync ahora es traer un motor de sync para reemplazar cien líneas de outbox que vas a poder depurar a las 2 AM.

Reevaluar en Fase 10 si aparece un caso real de escritura masiva offline sin hub.

Hostinger VPS + Coolify por sobre Supabase gestionado

Con multi-tenant real ya no necesitás un proyecto Supabase (y un Gmail) por cliente: un Postgres con RLS aloja a todos. Un VPS te da PITR con pgBackRest, cron propio, Redis y el worker fiscal en la misma caja, sin límite de conexiones ni sorpresas de facturación al escalar.

Supabase sigue siendo la vía rápida para las Fases 0–2. Migrar después es factible porque abajo es Postgres puro; lo que **no** hay que usar es Supabase Auth para el login operativo.
