-- Núcleo operativo (Fase 3): todas las tablas llevan venue_id propio y usan
-- políticas de venue_id estricto (no la subquery por tenant_id de Fase 0) —
-- acá sí importa que un dispositivo de un local no vea la actividad de otro
-- local del mismo tenant, como ya preveía el ADR 0002.
--
-- NULLIF(..., '') antes del ::uuid: mismo fix de siempre (ver ADR 0002) para
-- que un contexto sin venue_id dé cero filas en vez de una excepción.

ALTER TABLE areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE areas FORCE ROW LEVEL SECURITY;
CREATE POLICY venue_isolation ON areas
  USING (venue_id = NULLIF(current_setting('app.venue_id', true), '')::uuid);
--> statement-breakpoint

ALTER TABLE stations ENABLE ROW LEVEL SECURITY;
ALTER TABLE stations FORCE ROW LEVEL SECURITY;
CREATE POLICY venue_isolation ON stations
  USING (venue_id = NULLIF(current_setting('app.venue_id', true), '')::uuid);
--> statement-breakpoint

-- "tables" ya tiene RLS desde la migración 0006 (Fase 2) — no se repite acá.

ALTER TABLE table_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE table_sessions FORCE ROW LEVEL SECURITY;
CREATE POLICY venue_isolation ON table_sessions
  USING (venue_id = NULLIF(current_setting('app.venue_id', true), '')::uuid);
--> statement-breakpoint

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders FORCE ROW LEVEL SECURITY;
CREATE POLICY venue_isolation ON orders
  USING (venue_id = NULLIF(current_setting('app.venue_id', true), '')::uuid);
--> statement-breakpoint

ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items FORCE ROW LEVEL SECURITY;
CREATE POLICY venue_isolation ON order_items
  USING (venue_id = NULLIF(current_setting('app.venue_id', true), '')::uuid);
--> statement-breakpoint

ALTER TABLE order_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_events FORCE ROW LEVEL SECURITY;
CREATE POLICY venue_isolation ON order_events
  USING (venue_id = NULLIF(current_setting('app.venue_id', true), '')::uuid);
--> statement-breakpoint

ALTER TABLE kitchen_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE kitchen_tickets FORCE ROW LEVEL SECURITY;
CREATE POLICY venue_isolation ON kitchen_tickets
  USING (venue_id = NULLIF(current_setting('app.venue_id', true), '')::uuid);
--> statement-breakpoint

ALTER TABLE kitchen_ticket_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE kitchen_ticket_items FORCE ROW LEVEL SECURITY;
CREATE POLICY venue_isolation ON kitchen_ticket_items
  USING (venue_id = NULLIF(current_setting('app.venue_id', true), '')::uuid);
