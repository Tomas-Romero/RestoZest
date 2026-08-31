---
description: Reglas obligatorias al tocar el esquema, migraciones o queries
paths:
  - packages/db/**
  - apps/api/src/**/*.sql
  - "**/migrations/**"
---

# Al tocar el esquema o las migraciones

Referencia completa: `docs/plan/03-modelo-datos.md`. Leelo antes de crear tablas nuevas.

## Obligatorio en toda tabla operativa

- `id uuid primary key` — UUIDv7 generado en la app, nunca `gen_random_uuid()` en la base.
- `venue_id uuid not null` — aunque ya tengas `tenant_id`.
- `deleted_at timestamptz` si la fila puede desaparecer.
- `updated_at timestamptz not null default now()` si participa del sync descendente.
- RLS activo con la policy de aislamiento por `current_setting('app.venue_id')`.

## Plata

Siempre `bigint` en centavos, con el sufijo `_cents` en el nombre de la columna.
Nunca `numeric`, nunca `float`, nunca centavos fraccionarios.
Cantidades sí pueden ser `numeric(10,3)` (media porción, 1.5 kg).

## Snapshots

Cualquier tabla que registre una transacción congela lo que necesita para reconstruirse
sola: nombre, precio unitario y costo al momento de la venta. Nunca dependas de un JOIN
a `products` para reconstruir una orden histórica.

## Stock

`stock_movements` con `qty_delta`, nunca una columna `qty` que se sobreescriba con `SET`.
Los deltas son conmutativos y por eso sincronizan sin conflicto.

## Conexión y RLS

`SET LOCAL app.venue_id / app.user_id / app.role` **dentro de la transacción**.
Nunca `SET` a secas: el pool reutiliza conexiones y filtrarías datos de otro tenant.

## Antes de dar por terminada una migración

- Corre limpia sobre una base vacía **y** sobre una base con datos de seed.
- Hay un test que verifica que un tenant no puede leer filas de otro.
