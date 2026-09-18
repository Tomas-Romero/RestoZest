-- Tablas del catálogo (Fase 1): todas llevan venue_id propio (regla del
-- modelo de datos, aunque se pueda derivar via product_id/combo_id), así
-- que la política es directa, sin la subquery que hizo falta en Fase 0
-- para memberships/devices. Ver docs/adr/0002-contexto-rls-tenant-id.md.
--
-- NULLIF(..., '') antes del ::uuid: un GUC custom (app.venue_id) que nunca
-- se seteó en la sesión (p. ej. un request con solo tenant_id, sin venue_id
-- todavía elegido) devuelve '' en vez de NULL, y ''::uuid tira una excepción
-- en vez de simplemente no matchear ninguna fila. Mismo fix que en 0001.

CREATE UNIQUE INDEX prices_list_product_variant_key
  ON prices (price_list_id, product_id, variant_id) NULLS NOT DISTINCT;
--> statement-breakpoint

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories FORCE ROW LEVEL SECURITY;
CREATE POLICY venue_isolation ON categories
  USING (venue_id = NULLIF(current_setting('app.venue_id', true), '')::uuid);
--> statement-breakpoint

ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE products FORCE ROW LEVEL SECURITY;
CREATE POLICY venue_isolation ON products
  USING (venue_id = NULLIF(current_setting('app.venue_id', true), '')::uuid);
--> statement-breakpoint

ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_variants FORCE ROW LEVEL SECURITY;
CREATE POLICY venue_isolation ON product_variants
  USING (venue_id = NULLIF(current_setting('app.venue_id', true), '')::uuid);
--> statement-breakpoint

ALTER TABLE modifier_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE modifier_groups FORCE ROW LEVEL SECURITY;
CREATE POLICY venue_isolation ON modifier_groups
  USING (venue_id = NULLIF(current_setting('app.venue_id', true), '')::uuid);
--> statement-breakpoint

ALTER TABLE modifiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE modifiers FORCE ROW LEVEL SECURITY;
CREATE POLICY venue_isolation ON modifiers
  USING (venue_id = NULLIF(current_setting('app.venue_id', true), '')::uuid);
--> statement-breakpoint

ALTER TABLE product_modifier_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_modifier_groups FORCE ROW LEVEL SECURITY;
CREATE POLICY venue_isolation ON product_modifier_groups
  USING (venue_id = NULLIF(current_setting('app.venue_id', true), '')::uuid);
--> statement-breakpoint

ALTER TABLE combos ENABLE ROW LEVEL SECURITY;
ALTER TABLE combos FORCE ROW LEVEL SECURITY;
CREATE POLICY venue_isolation ON combos
  USING (venue_id = NULLIF(current_setting('app.venue_id', true), '')::uuid);
--> statement-breakpoint

ALTER TABLE combo_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE combo_items FORCE ROW LEVEL SECURITY;
CREATE POLICY venue_isolation ON combo_items
  USING (venue_id = NULLIF(current_setting('app.venue_id', true), '')::uuid);
--> statement-breakpoint

ALTER TABLE price_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_lists FORCE ROW LEVEL SECURITY;
CREATE POLICY venue_isolation ON price_lists
  USING (venue_id = NULLIF(current_setting('app.venue_id', true), '')::uuid);
--> statement-breakpoint

ALTER TABLE prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE prices FORCE ROW LEVEL SECURITY;
CREATE POLICY venue_isolation ON prices
  USING (venue_id = NULLIF(current_setting('app.venue_id', true), '')::uuid);
--> statement-breakpoint

ALTER TABLE price_change_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_change_batches FORCE ROW LEVEL SECURITY;
CREATE POLICY venue_isolation ON price_change_batches
  USING (venue_id = NULLIF(current_setting('app.venue_id', true), '')::uuid);
--> statement-breakpoint

ALTER TABLE daily_menus ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_menus FORCE ROW LEVEL SECURITY;
CREATE POLICY venue_isolation ON daily_menus
  USING (venue_id = NULLIF(current_setting('app.venue_id', true), '')::uuid);
--> statement-breakpoint

ALTER TABLE daily_menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_menu_items FORCE ROW LEVEL SECURITY;
CREATE POLICY venue_isolation ON daily_menu_items
  USING (venue_id = NULLIF(current_setting('app.venue_id', true), '')::uuid);
--> statement-breakpoint

ALTER TABLE promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE promotions FORCE ROW LEVEL SECURITY;
CREATE POLICY venue_isolation ON promotions
  USING (venue_id = NULLIF(current_setting('app.venue_id', true), '')::uuid);
