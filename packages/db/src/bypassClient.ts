import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

const authConnectionString = process.env.AUTH_DATABASE_URL;
if (!authConnectionString) {
  throw new Error("AUTH_DATABASE_URL no está definida");
}

/**
 * Conexión con el rol angosto resto_zest_auth (BYPASSRLS + grant a nivel de
 * columna en docker/init.sql + migraciones). Se usa SOLO para los lookups
 * que necesitan resolver el tenant/venue antes de tener contexto de RLS:
 * login por email (auth.ts) y venue público por slug (publicMenu.ts).
 * Nunca reutilizar `db` (el cliente general) para esto, y nunca ampliar los
 * grants de esta conexión más allá de columnas puntuales y de solo lectura.
 */
export const bypassDb = drizzle(postgres(authConnectionString));
