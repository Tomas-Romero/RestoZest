import "dotenv/config";
import { generateId } from "@resto-zest/domain";
import { hashPassword } from "./auth";
import { withContext } from "./client";
import { categories, devices, memberships, productVariants, products, tables, tenants, users, venues } from "./schema";

const SEED_PASSWORD = "resto1234";
const SEED_PIN = "1234";

async function seedTenant(name: string, slug: string, opts: { withCatalog?: boolean } = {}) {
  const tenantId = generateId();
  const venueId = generateId();
  const userId = generateId();
  const deviceId = generateId();
  const email = `owner@${slug}.test`;
  const passwordHash = await hashPassword(SEED_PASSWORD);

  await withContext({ tenantId }, async (tx) => {
    await tx.insert(tenants).values({ id: tenantId, name, slug });
    await tx.insert(venues).values({ id: venueId, tenantId, name: `${name} - Casa Matriz`, slug });
    await tx.insert(users).values({
      id: userId,
      tenantId,
      fullName: "Dueño de prueba",
      email,
      passwordHash,
    });
  });

  await withContext({ tenantId, venueId }, async (tx) => {
    await tx.insert(memberships).values({ userId, venueId, role: "owner" });
    await tx.insert(devices).values({
      id: deviceId,
      venueId,
      label: "Admin — semilla",
      kind: "admin",
      tokenHash: "seed-token",
    });

    if (opts.withCatalog) {
      const categoryId = generateId();
      const empanadaId = generateId();
      const gaseosaId = generateId();
      await tx.insert(categories).values({ id: categoryId, venueId, name: "Entradas" });
      await tx.insert(products).values([
        { id: empanadaId, venueId, categoryId, name: "Empanada", description: "Carne cortada a cuchillo", basePriceCents: 150000, tags: ["picante"] },
        { id: gaseosaId, venueId, categoryId, name: "Gaseosa 500ml", basePriceCents: 200000, kind: "drink", tags: [] },
      ]);
      await tx.insert(productVariants).values({ id: generateId(), venueId, productId: empanadaId, name: "Docena", priceDeltaCents: 1200000 });
      await tx.insert(tables).values({ id: generateId(), venueId, code: "12", qrToken: `${slug}-mesa-12` });

      // plano operativo: mozo y cocina de prueba, login por PIN (sin email/password)
      // PINs distintos a propósito: si fueran iguales, cuál usuario matchea
      // primero sería no determinístico (ver findUsersForPinLogin).
      const waiterId = generateId();
      const kitchenId = generateId();
      await tx.insert(users).values([
        { id: waiterId, tenantId, fullName: "Mozo de prueba", pinHash: await hashPassword(SEED_PIN) },
        { id: kitchenId, tenantId, fullName: "Cocinero de prueba", pinHash: await hashPassword("5678") },
      ]);
      await tx.insert(memberships).values([
        { userId: waiterId, venueId, role: "waiter" },
        { userId: kitchenId, venueId, role: "kitchen" },
      ]);
    }
  });

  return { tenantId, venueId, userId, deviceId, email };
}

async function main() {
  const a = await seedTenant("Rotisería de prueba", "rotiseria-demo", { withCatalog: true });
  const b = await seedTenant("Parrilla de prueba", "parrilla-demo");
  console.log("Seed listo. Login de prueba (plano de gestión):");
  console.log(`  ${a.email} / ${SEED_PASSWORD}`);
  console.log(`  ${b.email} / ${SEED_PASSWORD}`);
  console.log("Login PIN de prueba (plano operativo, solo en rotiseria-demo):");
  console.log(`  mozo: PIN ${SEED_PIN} — cocina: PIN 5678`);
  console.log("Menú público de prueba: /m/rotiseria-demo (mesa: /m/rotiseria-demo/mesa/rotiseria-demo-mesa-12)");
  console.log(JSON.stringify({ a, b }, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
