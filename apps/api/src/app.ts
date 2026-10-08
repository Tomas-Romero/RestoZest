import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import Fastify, { type FastifyInstance } from "fastify";
import { registerAuthRoutes } from "./routes/auth";
import { registerCategoryRoutes } from "./routes/categories";
import { registerComboRoutes } from "./routes/combos";
import { registerDailyMenuRoutes } from "./routes/dailyMenus";
import { registerModifierGroupRoutes } from "./routes/modifierGroups";
import { registerOrderRoutes } from "./routes/orders";
import { registerPriceChangeBatchRoutes } from "./routes/priceChangeBatches";
import { registerPriceListRoutes } from "./routes/priceLists";
import { registerProductModifierGroupRoutes } from "./routes/productModifierGroups";
import { registerProductRoutes } from "./routes/products";
import { registerProductVariantRoutes } from "./routes/productVariants";
import { registerPromotionRoutes } from "./routes/promotions";
import { registerPublicMenuRoutes } from "./routes/publicMenu";
import { registerSalonRoutes } from "./routes/salon";

export async function buildApp(opts: { logger?: boolean } = {}): Promise<FastifyInstance> {
  const role = process.env.ROLE ?? "cloud";
  // Las apps web (admin, mozos, KDS, POS) corren en puertos distintos en dev.
  const corsOrigins = (
    process.env.CORS_ORIGINS ??
    [process.env.ADMIN_ORIGIN ?? "http://localhost:5173", "http://localhost:5174", "http://localhost:5175", "http://localhost:5176"].join(",")
  )
    .split(",")
    .map((o) => o.trim());

  const app = Fastify({ logger: opts.logger ?? true });

  await app.register(cors, { origin: corsOrigins, credentials: true });
  await app.register(cookie);

  app.get("/health", async () => ({ status: "ok", role }));

  registerAuthRoutes(app);
  registerCategoryRoutes(app);
  registerProductRoutes(app);
  registerProductVariantRoutes(app);
  registerProductModifierGroupRoutes(app);
  registerModifierGroupRoutes(app);
  registerComboRoutes(app);
  registerPriceChangeBatchRoutes(app);
  registerPriceListRoutes(app);
  registerDailyMenuRoutes(app);
  registerPromotionRoutes(app);
  registerPublicMenuRoutes(app);
  registerOrderRoutes(app);
  registerSalonRoutes(app);

  return app;
}
