import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL no está definida");
}

const client = postgres(connectionString);
export const db = drizzle(client, { schema });

export type Db = typeof db;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

export type RequestContext = {
  tenantId: string;
  venueId?: string;
  userId?: string;
  role?: string;
};

/**
 * Corre `fn` dentro de una transacción con el contexto de RLS seteado vía
 * SET LOCAL (acá, `set_config(..., true)`, que es su equivalente parametrizable).
 * Nunca usar SET a secas: la conexión del pool se reutiliza entre requests.
 */
export async function withContext<T>(ctx: RequestContext, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.tenant_id', ${ctx.tenantId}, true)`);
    if (ctx.venueId) {
      await tx.execute(sql`select set_config('app.venue_id', ${ctx.venueId}, true)`);
    }
    if (ctx.userId) {
      await tx.execute(sql`select set_config('app.user_id', ${ctx.userId}, true)`);
    }
    if (ctx.role) {
      await tx.execute(sql`select set_config('app.role', ${ctx.role}, true)`);
    }
    return fn(tx);
  });
}
