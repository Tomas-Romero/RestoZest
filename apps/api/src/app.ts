import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import Fastify, { type FastifyInstance } from "fastify";
import { registerAuthRoutes } from "./routes/auth";

export async function buildApp(opts: { logger?: boolean } = {}): Promise<FastifyInstance> {
  const role = process.env.ROLE ?? "cloud";
  const adminOrigin = process.env.ADMIN_ORIGIN ?? "http://localhost:5173";

  const app = Fastify({ logger: opts.logger ?? true });

  await app.register(cors, { origin: adminOrigin, credentials: true });
  await app.register(cookie);

  app.get("/health", async () => ({ status: "ok", role }));

  registerAuthRoutes(app);

  return app;
}
