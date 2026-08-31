# Modelo de datos

Esquema inicial para Postgres. No están todas las tablas, pero sí las que definen la forma del sistema: si estas quedan bien, el resto se acomoda solo.

### Cinco reglas que no se negocian

1.  **Plata en centavos enteros** — `bigint`, nunca `float` ni `numeric` en JavaScript. Un solo lugar hace el formateo a pesos.
2.  **Precios y nombres congelados en la línea de la orden** — Un ítem vendido guarda su propio `unit_price_cents` y `name_snapshot`. Con la remarcación semanal argentina, recalcular una orden de la semana pasada joinando a `products` te destruye la contabilidad.
3.  **PK UUIDv7 generada en el dispositivo** — Ordenable por tiempo, sin colisión, y permite crear la orden sin haber hablado nunca con el servidor. Es también la clave de idempotencia.
4.  **Borrado lógico siempre** — `deleted_at`. Un `DELETE` físico no se propaga de forma confiable a un dispositivo que estuvo tres horas offline.
5.  **Toda tabla operativa lleva `venue_id`** — Aunque parezca redundante teniendo `tenant_id`. Simplifica RLS, los índices y el filtro de sync por local.

### Tenencia, usuarios y dispositivos

```sql
create table tenants (
  id          uuid primary key,
  name        text not null,
  slug        text unique not null,
  plan        text not null default 'basic',
  created_at  timestamptz not null default now()
);

create table venues (                          -- sucursal / local
  id            uuid primary key,
  tenant_id     uuid not null references tenants(id),
  name          text not null,
  timezone      text not null default 'America/Argentina/Buenos_Aires',
  fiscal_config jsonb,        -- { cuit, pto_venta, condicion_iva, razon_social }
  settings      jsonb not null default '{}',   -- propina sugerida, cubierto, etc.
  created_at    timestamptz not null default now()
);

create table users (
  id            uuid primary key,
  tenant_id     uuid not null references tenants(id),
  full_name     text not null,
  email         citext,       -- null para mozos y cocina: entran solo con PIN
  pin_hash      text,         -- argon2id · se replica al hub para login OFFLINE
  password_hash text,         -- solo dueño/admin, login en la nube
  active        boolean not null default true
);

create table memberships (
  user_id  uuid not null references users(id),
  venue_id uuid not null references venues(id),
  role     text not null,   -- owner | admin | cashier | waiter | kitchen | runner
  primary key (user_id, venue_id)
);

create table devices (
  id           uuid primary key,
  venue_id     uuid not null references venues(id),
  label        text not null,   -- "Tablet Mozo 2", "Caja 1", "KDS Parrilla"
  kind         text not null,   -- waiter | pos | kds | admin | hub
  token_hash   text not null,
  lamport      bigint not null default 0,  -- reloj lógico para ordenar eventos
  last_seen_at timestamptz
);
```
### Catálogo y precios

```sql
create table products (
  id               uuid primary key,
  venue_id         uuid not null references venues(id),
  category_id      uuid references categories(id),
  name             text not null,
  description      text,
  image_url        text,
  base_price_cents bigint not null,
  cost_cents       bigint,            -- necesario para el reporte de ganancias
  kind             text not null default 'food',     -- food | drink | combo
  prep_station     text not null default 'kitchen',  -- kitchen | bar | grill
  tracks_stock     boolean not null default false,   -- true en bebidas
  available        boolean not null default true,
  tags             text[] default '{}',             -- sin_tacc, vegano, picante
  position         int not null default 0,
  deleted_at       timestamptz,
  updated_at       timestamptz not null default now()
);
-- prep_station es lo que rutea la comanda a la impresora correcta (sección 05)

-- Variantes ("Porción / Media"), grupos de modificadores ("Punto de cocción",
-- min/max selección) y modificadores con price_delta_cents: mismo patrón.

create table price_lists (            -- Salón / Delivery / Take away
  id uuid primary key, venue_id uuid not null,
  name text not null, channel text not null, active boolean default true
);
create table prices (
  price_list_id uuid not null references price_lists(id),
  product_id    uuid not null references products(id),
  variant_id    uuid,
  price_cents   bigint not null,
  primary key (price_list_id, product_id, variant_id)
);

-- Remarcación masiva CON deshacer. En Argentina esto se usa todas las semanas.
create table price_change_batches (
  id         uuid primary key,
  venue_id   uuid not null,
  rule       jsonb not null,  -- {scope:'category', id:'…', op:'percent', value:12.5}
  snapshot   jsonb not null,  -- precios previos → un click para revertir
  applied_by uuid not null, applied_at timestamptz not null,
  reverted_at timestamptz
);
```
### Salón y órdenes

```sql
create table tables (
  id        uuid primary key,
  venue_id  uuid not null,
  area_id   uuid,                  -- Salón, Vereda, Patio → mapa de calor por zona
  code      text not null,        -- "12"
  seats     int not null default 4,
  pos_x     int, pos_y int,        -- plano del salón en el admin
  qr_token  text unique,          -- QR de la mesa → menú "solo vista"
  deleted_at timestamptz
);

create table table_sessions (         -- una apertura de mesa
  id        uuid primary key,
  venue_id  uuid not null, table_id uuid not null,
  opened_by uuid not null,        -- mozo
  guests    int not null default 1,
  status    text not null default 'open',  -- open | billing | closed
  opened_at timestamptz not null, closed_at timestamptz
);

create table orders (
  id               uuid primary key,   -- UUIDv7 generado EN EL DISPOSITIVO
  venue_id         uuid not null,
  session_id       uuid references table_sessions(id),  -- null si delivery
  channel          text not null,   -- dine_in | takeaway | delivery | qr_self
  code             text not null,   -- legible: "C1-0831-042" (device-fecha-seq local)
  status           text not null default 'open',  -- open|sent|served|paid|void
  price_list_id    uuid not null,
  customer_id      uuid,
  subtotal_cents   bigint not null default 0,
  discount_cents   bigint not null default 0,
  service_cents    bigint not null default 0,   -- cubierto / servicio de mesa
  total_cents      bigint not null default 0,
  origin_device_id uuid not null,
  created_at       timestamptz not null,
  synced_at        timestamptz,
  unique (venue_id, code)
);

create table order_items (
  id                  uuid primary key,
  order_id            uuid not null references orders(id),
  product_id          uuid not null, variant_id uuid,
  name_snapshot       text not null,     -- congelado
  unit_price_cents    bigint not null,   -- congelado, NO se recalcula jamás
  cost_snapshot_cents bigint,             -- congelado → margen histórico correcto
  qty                 numeric(10,3) not null default 1,
  modifiers           jsonb not null default '[]',  -- [{id,name,delta_cents}]
  note                text,               -- "sin sal", "para llevar"
  course              int not null default 1,      -- entrada / principal / postre
  prep_station        text not null,
  status              text not null default 'pending',
  void_reason         text
);
```
### El log de eventos: la pieza clave

Las órdenes no se editan con `UPDATE`. Se escriben eventos inmutables y el estado de la orden es el resultado de plegarlos. Dos dispositivos offline nunca «pisan» el mismo dato: solo agregan eventos que después se intercalan de forma determinística.

```sql
create table order_events (
  id            uuid primary key,   -- UUIDv7 del cliente = CLAVE DE IDEMPOTENCIA
  venue_id      uuid not null,
  order_id      uuid not null,
  type          text not null,
  -- order.created · item.added · item.qty_changed · item.voided
  -- order.sent_to_station · item.status_changed · discount.applied
  -- payment.registered · order.split · order.closed · order.reopened
  payload       jsonb not null,
  actor_user_id uuid not null,
  device_id     uuid not null,
  lamport       bigint not null,   -- reloj lógico del dispositivo
  occurred_at   timestamptz not null, -- hora del dispositivo (puede mentir)
  received_at   timestamptz,           -- hora del hub (autoridad)
  server_seq    bigserial              -- orden canónico al recibirse
);
create index on order_events (venue_id, server_seq);
create index on order_events (order_id, lamport, device_id);

-- Reenviar el mismo evento es un no-op: el PK lo rechaza.
-- Orden determinístico de replay: (lamport, device_id) desempata siempre igual.
```
### Caja, pagos y fiscal

```sql
create table cash_sessions (           -- turno de caja
  id                    uuid primary key,
  venue_id              uuid not null, register_id uuid not null,
  opened_by             uuid not null, opening_float_cents bigint not null,
  closed_by             uuid, closing_counted_cents bigint,
  expected_cents        bigint, difference_cents bigint,
  status                text not null default 'open',
  opened_at timestamptz not null, closed_at timestamptz,
  seal_hash             text  -- hash encadenado de los movimientos → antifraude
);

create table payments (
  id              uuid primary key,   -- UUIDv7 del dispositivo = idempotency key
  venue_id        uuid not null, order_id uuid not null,
  cash_session_id uuid,
  method          text not null,
  -- cash | card_debit | card_credit | mp_qr | mp_point | transfer | account
  amount_cents    bigint not null,
  tip_cents       bigint not null default 0,
  provider        text, provider_ref text,   -- mercadopago + id de la order
  status          text not null default 'captured',
  split_group     uuid,                      -- agrupa los pagos de una cuenta dividida
  captured_at     timestamptz not null
);

create table fiscal_documents (
  id            uuid primary key,
  venue_id      uuid not null, order_id uuid not null,
  doc_type      int not null,      -- 6=Factura B · 11=Factura C · 8=NC B
  pto_venta     int not null,
  number        bigint,               -- lo asigna ARCA. NUNCA se genera offline
  cae           text, cae_due date,
  net_cents     bigint, vat_cents bigint, total_cents bigint,
  vat_breakdown jsonb,                -- alícuotas discriminadas (obligatorio 2026)
  receiver_doc_type int, receiver_doc_nro text,
  status        text not null default 'queued',
  -- queued | authorized | rejected | contingency
  request jsonb, response jsonb, attempts int default 0, last_error text,
  authorized_at timestamptz
);
```
### Resto del esquema

| Grupo            | Tablas                                                                                                                                             |
|------------------|----------------------------------------------------------------------------------------------------------------------------------------------------|
| Catálogo         | `categories` · `product_variants` · `modifier_groups` · `modifiers` · `combos` · `combo_items` · `daily_menus` · `daily_menu_items` · `promotions` |
| Inventario       | `stock_items` · `recipes` (producto → insumo + cantidad) · `stock_movements` (deltas, nunca `SET`) · `suppliers` · `purchases` · `stock_alerts`    |
| Cocina           | `kitchen_tickets` · `kitchen_ticket_items` · `stations`                                                                                            |
| Impresión        | `printers` · `print_jobs` · `print_routes`                                                                                                         |
| Clientes         | `customers` · `addresses` · `delivery_orders` · `couriers`                                                                                         |
| Sync y auditoría | `outbox` · `sync_cursors` · `sync_incidents` · `audit_log`                                                                                         |
| Reportes         | `mv_sales_hourly` · `mv_product_ranking` · `mv_margin_daily` (vistas materializadas, refresh nocturno)                                             |

### Aislamiento multi-tenant

```sql
-- Cada request setea el contexto y RLS hace el resto. Un bug en un WHERE
-- ya no puede filtrar datos de otro restaurante.
alter table orders enable row level security;

create policy venue_isolation on orders
  using (venue_id = current_setting('app.venue_id', true)::uuid);

-- En el pool: SET LOCAL app.venue_id / app.user_id / app.role dentro de la
-- transacción. Nunca con SET a secas: la conexión se reutiliza.
```
