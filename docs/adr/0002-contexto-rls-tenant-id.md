# 0002 — Agregar `app.tenant_id` al contexto de RLS

## Contexto

`03-modelo-datos.md` documenta el contexto de sesión para RLS como
`app.venue_id` / `app.user_id` / `app.role`, seteados con `SET LOCAL` dentro
de la transacción. Pero `tenants` y `users` no tienen `venue_id` (por
diseño: un usuario pertenece a un tenant y accede a distintos venues vía
`memberships`). Con solo `app.venue_id` no hay forma de escribir una política
de RLS sobre esas dos tablas.

## Decisión

Se agrega `app.tenant_id` como cuarta variable de sesión, seteada siempre
(las otras tres son opcionales según el tipo de request). El helper
`withContext` de `packages/db` la setea con `set_config('app.tenant_id', ..., true)`
al principio de toda transacción.

Política resultante:

- `tenants`, `users` → aislados por `tenant_id = current_setting('app.tenant_id')`.
- `venues` → aislado por `tenant_id` también (un dueño administra varios
  locales del mismo tenant sin necesitar `venue_id` seteado).
- `memberships`, `devices` → **aislados por `tenant_id` (vía subquery a
  `venues`), no por `venue_id`**. Esto es una desviación de lo que decía el
  plan original y vale la pena explicarla: el login necesita listar "todos
  los venues de este usuario dentro de su tenant" para armar el selector de
  local, y en ese momento todavía no hay ningún `venue_id` en el contexto
  (es lo que se está por descubrir). Con una política `venue_id =
  current_setting('app.venue_id')`, sin `venue_id` seteado la condición es
  `venue_id = NULL`, que no matchea nada — la consulta devuelve vacío
  siempre, sin importar el tenant. Son tablas de directorio (bajo volumen),
  no operativas de alto volumen, así que el costo de la subquery no importa.
  **Las tablas de Fase 3 en adelante (`orders`, `kitchen_tickets`, etc.) sí
  van a usar `venue_id` estricto**, como muestra el ejemplo original de
  `03-modelo-datos.md`: ahí un dispositivo de un local no debe ver la
  actividad de otro local del mismo tenant, aunque comparta tenant.

Todas las tablas usan `FORCE ROW LEVEL SECURITY`, no solo `ENABLE`: sin
`FORCE`, el dueño de la tabla (el rol de la aplicación) queda exento de las
políticas, lo que en la práctica anula el aislamiento. Por esto
`packages/db/docker/init.sql` crea un rol `resto_zest` explícitamente
`NOSUPERUSER NOBYPASSRLS` en vez de usar el superusuario por defecto de la
imagen de Postgres.

## Consecuencias

- Todo código que escriba en `tenants`, `venues`, `users`, `memberships` o
  `devices` tiene que pasar por `withContext` (o setear las cuatro variables
  a mano). Un insert sin contexto falla la política, no se salta la
  verificación silenciosamente.
- Cuando el modelo de datos crezca a tablas operativas nuevas (`Fase 1` en
  adelante), la convención pasa a ser: si la tabla tiene `venue_id`, la
  política usa `venue_id`; si no, usa `tenant_id`. No hace falta una tercera
  variante salvo que aparezca un caso concreto que no encaje.
