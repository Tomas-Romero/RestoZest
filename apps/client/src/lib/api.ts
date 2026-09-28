const API_URL = process.env.API_URL ?? "http://localhost:3001";

export type PublicVenue = { slug: string; name: string; timezone: string };

export type PublicMenuVariant = { id: string; name: string; priceDeltaCents: number };
export type PublicMenuModifier = { id: string; name: string; priceDeltaCents: number };
export type PublicMenuModifierGroup = {
  id: string;
  name: string;
  minSelect: number;
  maxSelect: number;
  modifiers: PublicMenuModifier[];
};
export type PublicMenuProduct = {
  id: string;
  categoryId: string | null;
  name: string;
  description: string | null;
  imageUrl: string | null;
  basePriceCents: number;
  kind: string;
  tags: string[];
  position: number;
  variants: PublicMenuVariant[];
  modifierGroups: PublicMenuModifierGroup[];
};
export type PublicMenuCategory = { id: string; name: string; position: number };
export type PublicMenu = { categories: PublicMenuCategory[]; products: PublicMenuProduct[] };

export type MenuResponse = { venue: PublicVenue; menu: PublicMenu };
export type TableMenuResponse = MenuResponse & { table: { code: string } };

// Estas fetch corren en el servidor (build/ISR), nunca en el navegador: el
// menú ya viaja armado en el HTML, así que no hace falta CORS ni un cliente
// aparte para el browser.

export async function fetchPublicMenu(venueSlug: string): Promise<MenuResponse | null> {
  const res = await fetch(`${API_URL}/public/menu/${venueSlug}`, { next: { revalidate: 60 } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Error ${res.status} al cargar el menú`);
  return res.json() as Promise<MenuResponse>;
}

export async function fetchPublicMenuForTable(venueSlug: string, qrToken: string): Promise<TableMenuResponse | null> {
  const res = await fetch(`${API_URL}/public/menu/${venueSlug}/mesa/${qrToken}`, { next: { revalidate: 60 } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Error ${res.status} al cargar el menú`);
  return res.json() as Promise<TableMenuResponse>;
}
