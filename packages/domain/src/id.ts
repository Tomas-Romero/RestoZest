/**
 * UUIDv7: 48 bits de timestamp + 74 bits aleatorios. Ordenable por tiempo,
 * generado en el cliente (regla no negociable del modelo de datos).
 *
 * Usa la Web Crypto API global en vez de "node:crypto" para poder correr
 * igual en las PWAs (navegador) y en apps/api y apps/hub (Node).
 */
export function generateId(): string {
  const bytes = new Uint8Array(16);
  const ts = BigInt(Date.now());

  bytes[0] = Number((ts >> 40n) & 0xffn);
  bytes[1] = Number((ts >> 32n) & 0xffn);
  bytes[2] = Number((ts >> 24n) & 0xffn);
  bytes[3] = Number((ts >> 16n) & 0xffn);
  bytes[4] = Number((ts >> 8n) & 0xffn);
  bytes[5] = Number(ts & 0xffn);

  crypto.getRandomValues(bytes.subarray(6));

  bytes[6] = (bytes[6]! & 0x0f) | 0x70; // versión 7
  bytes[8] = (bytes[8]! & 0x3f) | 0x80; // variante RFC 4122

  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
