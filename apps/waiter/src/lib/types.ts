export type Area = { id: string; name: string; position: number };

export type FloorTable = {
  id: string;
  areaId: string | null;
  code: string;
  seats: number;
  posX: number | null;
  posY: number | null;
  qrToken: string;
  session: { id: string; guests: number; status: string; openedAt: string } | null;
};

export type Floor = { areas: Area[]; tables: FloorTable[] };

export type PosModifier = { id: string; name: string; priceDeltaCents: number };
export type PosModifierGroup = { id: string; name: string; minSelect: number; maxSelect: number; modifiers: PosModifier[] };
export type PosVariant = { id: string; name: string; priceDeltaCents: number };

export type PosProduct = {
  id: string;
  categoryId: string | null;
  name: string;
  description: string | null;
  basePriceCents: number;
  kind: string;
  tags: string[];
  position: number;
  prepStation: string;
  costCents: number | null;
  variants: PosVariant[];
  modifierGroups: PosModifierGroup[];
};

export type PosMenu = { categories: { id: string; name: string; position: number }[]; products: PosProduct[] };

export type PriceList = { id: string; name: string; channel: string; active: boolean };

export type SessionOrderItem = {
  id: string;
  nameSnapshot: string;
  qty: string;
  status: "pending" | "preparing" | "ready" | "served" | "void";
  note: string | null;
  course: number;
};
export type SessionOrder = { id: string; code: string; status: string; items: SessionOrderItem[] };

export type Me = {
  user: { id: string; fullName: string };
  tenantId: string;
  venueId: string | null;
  role: string | null;
};
