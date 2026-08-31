-- Rol general de la app: SIN privilegios de superusuario ni BYPASSRLS. Un
-- superusuario (o un dueño de tabla con BYPASSRLS) ignora las políticas de
-- RLS aunque la tabla tenga FORCE ROW LEVEL SECURITY. Para que el test de
-- aislamiento multi-tenant sea real, la app tiene que conectarse con un rol
-- que efectivamente quede sujeto a las políticas.
CREATE ROLE resto_zest WITH LOGIN PASSWORD 'resto_zest' NOSUPERUSER NOBYPASSRLS;
CREATE DATABASE resto_zest_dev OWNER resto_zest;

-- Rol angosto SOLO para el lookup de login (auth_find_user_by_email): en ese
-- momento todavía no hay tenant_id para setear el contexto de RLS, así que
-- necesita BYPASSRLS. El daño posible se limita con un GRANT a nivel de
-- columna en la migración 0002: ni con BYPASSRLS puede leer email,
-- full_name ni pin_hash — solo lo que el login necesita.
CREATE ROLE resto_zest_auth WITH LOGIN PASSWORD 'resto_zest_auth' NOSUPERUSER BYPASSRLS;

\c resto_zest_dev
CREATE EXTENSION IF NOT EXISTS citext;
GRANT ALL ON SCHEMA public TO resto_zest;
GRANT USAGE ON SCHEMA public TO resto_zest_auth;
