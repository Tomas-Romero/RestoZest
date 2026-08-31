# Estado del proyecto

> Este archivo es la memoria entre sesiones. Se actualiza al final de cada una con
> `/cerrar-sesion`. Si estás arrancando una sesión, leelo primero.

**Última actualización:** 2026-08-31
**Fase actual:** 0 — Fundaciones (**completa**, los 5 sub-entregables)

---

## En curso

_Nada todavía._

Próximo paso: `/fase 1` — catálogo y panel admin.

---

## Hecho

- **2026-08-31** — Fase 0.1: monorepo pnpm + Turborepo, TS estricto, ESLint 9 flat
  config compartido. `apps/{api,hub,admin,pos,waiter,kds,client}` y
  `packages/{domain,db,ui,sync,printing}` compilando (hub queda placeholder
  hasta Fase 5). `typecheck`/`lint`/`test` en verde.
- **2026-08-31** — Fase 0.2: `packages/db` con Drizzle — esquema `tenants`,
  `venues`, `users`, `memberships`, `devices`, `sessions`. RLS activo con
  `FORCE ROW LEVEL SECURITY` en todas menos `sessions`. Rol `resto_zest`
  (sin BYPASSRLS) para la app y `resto_zest_auth` (BYPASSRLS + grant a nivel
  de columna) solo para el lookup de login. Docker Compose con Postgres 17
  para dev local. Seed + test de aislamiento multi-tenant, todo verificado
  contra una base real.
- **2026-08-31** — Fase 0.3: `apps/api` con Fastify + Zod. `POST /auth/login`,
  `GET /auth/me`, `POST /auth/logout` con cookies httpOnly + CORS para el
  admin. Verificado end-to-end (curl y tests con `app.inject`).
- **2026-08-31** — Fase 0.4: `packages/ui` con Tailwind v4 + componentes tipo
  shadcn mínimos (Button, Input, Label, Card). `apps/admin` con TanStack
  Query: login real contra la API, selector de venue si hay más de uno, shell
  con nav filtrada por rol (matriz de `07-seguridad.md`). Probado en
  navegador real: login → shell → logout → login.
- **2026-08-31** — Fase 0.5: CI en GitHub Actions (`.github/workflows/ci.yml`) —
  typecheck, lint, test y migración contra Postgres 17 efímero. El workflow
  se simuló localmente completo (contenedor limpio, sin volumen de init)
  antes de confiarlo a GitHub.

**"Listo cuando" de la Fase 0 (roadmap):** cumplido — `pnpm dev` levanta API y
admin (y el resto de las apps operativas, vacías), entrás con un usuario
sembrado (`owner@rotiseria-demo.test` / `resto1234`), y el test de
`packages/db/src/isolation.test.ts` prueba que un tenant no puede leer datos
de otro.

---

## Decisiones de esta sesión

- **Nombre**: se renombró "GastroControl" (nombre de trabajo del bundle
  original) a **Resto Zest** en todo `CLAUDE.md` y `docs/plan/`.
- **RLS**: se agregó `app.tenant_id` al contexto de sesión (el plan original
  solo mencionaba `app.venue_id`/`app.user_id`/`app.role`) porque `tenants` y
  `users` no tienen `venue_id`. Además, `memberships` y `devices` se aíslan
  por `tenant_id` (vía subquery a `venues`), no por `venue_id` — el login
  necesita listar los venues de un usuario antes de tener un `venue_id` en
  contexto. Detalle completo en `docs/adr/0002-contexto-rls-tenant-id.md`.
  Las tablas operativas de Fase 3+ (`orders`, etc.) sí van a usar `venue_id`
  estricto, como muestra el ejemplo original del plan.
- **Auth**: se implementó login email/password a mano (Fastify + argon2id +
  sesiones en tabla propia) en vez de integrar Better Auth como decía
  `02-stack.md`. Motivo: Better Auth exige columnas (`emailVerified`, etc.)
  que no están en el esquema documentado y trae su propio migrador,
  compitiendo con Drizzle. Queda como pendiente evaluar si conviene migrar a
  Better Auth cuando haga falta 2FA/OAuth (ver "Pendientes conocidos").
- **Puerto de Postgres local**: el docker-compose de `packages/db` usa
  **5434**, no 5432/5433 — ver "Trampas encontradas".

---

## Trampas encontradas

- El puerto 5433 ya estaba tomado por un servicio nativo de PostgreSQL 18 de
  Windows en esta máquina (no Docker). Las conexiones caían ahí en silencio
  y daban "password authentication failed" con credenciales que en realidad
  eran correctas. `packages/db/docker-compose.yml` quedó en el puerto 5434.
- `corepack enable` falla con EPERM en esta máquina (Node instalado en
  `C:\Program Files\nodejs`, sin permisos de escritura). Alternativa que
  funciona: `npm install -g pnpm` (el prefix global de npm no está bajo
  Program Files).
- Un `fetch` con `Content-Type: application/json` pero sin body hace que
  Fastify intente parsear un JSON vacío y devuelva 400. El helper de fetch
  de `apps/admin` solo manda ese header cuando efectivamente hay `body`.
- Un `GRANT SELECT (columnas...)` a nivel de columna en Postgres tiene que
  incluir también las columnas usadas en el `WHERE`, no solo las del
  `SELECT` — si no, da "permission denied" aunque las columnas que devolvés
  sí estén otorgadas.
- `FORCE ROW LEVEL SECURITY` es indispensable, no solo `ENABLE`: sin
  `FORCE`, el dueño de la tabla queda exento de las políticas y el test de
  aislamiento pasaría en falso.
- Turborepo no invalida la caché de una tarea cuando cambia un archivo de
  configuración raíz (`eslint.config.js`, `tsconfig.base.json`) ni cuando
  cambia una variable de entorno (`DATABASE_URL`) salvo que se declaren
  explícitamente en `turbo.json` (`globalDependencies` y `tasks.<x>.env`).
  Ya está corregido, pero si se agrega una env var nueva de la que dependa
  algún test, hay que sumarla ahí.
- Editar un archivo de migración de Drizzle **después** de que ya se aplicó
  no lo vuelve a aplicar (`drizzle-kit migrate` lo da por hecho). En dev,
  mientras no haya datos reales, lo más simple es `docker compose down -v`
  y volver a migrar.

---

## Pendientes conocidos (deuda consciente)

- Better Auth no se integró (ver "Decisiones de esta sesión"). El login
  actual es sólido para email+password simple pero no tiene 2FA ni OAuth.
- `apps/admin` no tiene router todavía — el shell muestra secciones filtradas
  por rol pero sin páginas reales detrás. Se resuelve orgánicamente cuando
  Fase 1 agregue las primeras pantallas de verdad.
- `packages/ui` tiene solo 4 componentes (Button, Input, Label, Card) — el
  mínimo para el login. Crece bajo demanda en las próximas fases.
- El plano operativo (PIN, cashier/waiter/kitchen) no está implementado —
  Fase 0 solo cubre el plano de gestión (dueño/admin, email+password).
