import "dotenv/config";
import { generateId } from "@resto-zest/domain";
import { hashPassword } from "./auth";
import { withContext } from "./client";
import { devices, memberships, tenants, users, venues } from "./schema";

const SEED_PASSWORD = "resto1234";

async function seedTenant(name: string, slug: string) {
  const tenantId = generateId();
  const venueId = generateId();
  const userId = generateId();
  const deviceId = generateId();
  const email = `owner@${slug}.test`;
  const passwordHash = await hashPassword(SEED_PASSWORD);

  await withContext({ tenantId }, async (tx) => {
    await tx.insert(tenants).values({ id: tenantId, name, slug });
    await tx.insert(venues).values({ id: venueId, tenantId, name: `${name} - Casa Matriz` });
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
  });

  return { tenantId, venueId, userId, deviceId, email };
}

async function main() {
  const a = await seedTenant("Rotisería de prueba", "rotiseria-demo");
  const b = await seedTenant("Parrilla de prueba", "parrilla-demo");
  console.log("Seed listo. Login de prueba (plano de gestión):");
  console.log(`  ${a.email} / ${SEED_PASSWORD}`);
  console.log(`  ${b.email} / ${SEED_PASSWORD}`);
  console.log(JSON.stringify({ a, b }, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
