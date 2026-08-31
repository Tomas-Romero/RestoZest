-- resto_zest_auth bypasea RLS (ver docker/init.sql) porque en el momento del
-- login todavía no se conoce el tenant_id. El GRANT a nivel de columna es lo
-- único que lo limita: ni con BYPASSRLS puede leer full_name ni pin_hash —
-- solo lo que el login necesita. "email" se incluye porque Postgres exige
-- privilegio también sobre las columnas usadas en el WHERE, no solo en el SELECT.
GRANT SELECT (id, tenant_id, password_hash, active, email) ON users TO resto_zest_auth;
