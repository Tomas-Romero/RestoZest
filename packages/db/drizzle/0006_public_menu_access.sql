-- RLS de "tables" (Fase 2, versión mínima): venue_id directo, mismo patrón
-- que el resto del catálogo (Fase 1).
ALTER TABLE tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE tables FORCE ROW LEVEL SECURITY;
CREATE POLICY venue_isolation ON tables
  USING (venue_id = NULLIF(current_setting('app.venue_id', true), '')::uuid);
--> statement-breakpoint

-- El menú público (Fase 2) resuelve un venue por slug ANTES de tener
-- tenant_id/venue_id en el contexto: mismo problema de bootstrap que el
-- login (ver docs/adr/0002). Reutiliza el rol resto_zest_auth (BYPASSRLS +
-- grant a nivel de columna) en vez de crear un tercer rol para lo mismo.
GRANT SELECT (id, tenant_id, slug, name, timezone) ON venues TO resto_zest_auth;
