-- Aislamiento multi-tenant. FORCE (no solo ENABLE) es necesario: sin FORCE,
-- el dueño de la tabla queda exento de las políticas. El rol de la app
-- (resto_zest, ver docker/init.sql) no es superusuario ni tiene BYPASSRLS,
-- así que FORCE aplica de verdad. Ver docs/adr/0002-contexto-rls-tenant-id.md.
--
-- NULLIF(current_setting(...), '') antes del ::uuid: un GUC custom (app.*)
-- que nunca se seteó en la sesión devuelve '' (string vacío), no NULL, y
-- ''::uuid explota en vez de devolver "sin filas". NULLIF lo convierte a
-- NULL primero, así la comparación da UNKNOWN (cero filas) sin excepción.
--
-- sessions queda deliberadamente sin RLS: ver el comentario en
-- src/schema/sessions.ts.

ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenants FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON tenants
  USING (id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
--> statement-breakpoint

ALTER TABLE venues ENABLE ROW LEVEL SECURITY;
ALTER TABLE venues FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON venues
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
--> statement-breakpoint

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE users FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON users
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
--> statement-breakpoint

-- memberships y devices se aíslan por tenant_id (vía subquery a venues), NO
-- por venue_id: el login necesita listar "todos los venues de este usuario
-- dentro de su tenant" antes de que exista un venue_id en el contexto. Son
-- tablas de directorio, no de alto volumen operativo. Las tablas de Fase 3
-- en adelante (orders, kitchen_tickets, etc.) sí van a aislarse por
-- venue_id estricto, como muestra el ejemplo de 03-modelo-datos.md: ahí sí
-- importa que un dispositivo de un local no vea el de otro del mismo tenant.
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE memberships FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON memberships
  USING (venue_id IN (SELECT id FROM venues WHERE tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid));
--> statement-breakpoint

ALTER TABLE devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE devices FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON devices
  USING (venue_id IN (SELECT id FROM venues WHERE tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid));
