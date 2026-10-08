import { formatCents } from "@resto-zest/domain";
import { Button, Input, Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@resto-zest/ui";
import { useMemo, useState } from "react";
import type { PosMenu, PosProduct } from "../lib/types";

/** Buscar un producto en pocos toques: categorías arriba, búsqueda, y la lista lista para tocar. */
export function ProductPicker({
  menu,
  onPick,
  onClose,
}: {
  menu: PosMenu;
  onPick: (product: PosProduct) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);

  const products = useMemo(() => {
    const q = query.trim().toLowerCase();
    return menu.products
      .filter((p) => (categoryId ? p.categoryId === categoryId : true))
      .filter((p) => !q || p.name.toLowerCase().includes(q))
      .sort((a, b) => a.position - b.position);
  }, [menu.products, query, categoryId]);

  const chip = (active: boolean) =>
    `h-12 shrink-0 rounded-full border-2 px-4 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
      active ? "border-primary bg-primary text-primary-foreground" : "border-border"
    }`;

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="max-w-none gap-3">
        <SheetHeader>
          <SheetTitle>Agregar al pedido</SheetTitle>
          <SheetDescription className="sr-only">Elegí un producto del menú</SheetDescription>
        </SheetHeader>

        <Input className="h-12" type="search" aria-label="Buscar producto" placeholder="Buscar…" value={query} onChange={(e) => setQuery(e.target.value)} />

        <div className="-mx-6 flex gap-2 overflow-x-auto px-6 pb-1 [scrollbar-width:none]" role="group" aria-label="Categorías">
          <button type="button" className={chip(categoryId === null)} aria-pressed={categoryId === null} onClick={() => setCategoryId(null)}>
            Todo
          </button>
          {menu.categories.map((c) => (
            <button key={c.id} type="button" className={chip(categoryId === c.id)} aria-pressed={categoryId === c.id} onClick={() => setCategoryId(c.id)}>
              {c.name}
            </button>
          ))}
        </div>

        <ul className="flex flex-col gap-2 pb-4">
          {products.map((p) => (
            <li key={p.id}>
              <Button variant="outline" className="h-14 w-full justify-between px-4 text-base" onClick={() => onPick(p)}>
                <span className="truncate text-left">{p.name}</span>
                <span className="tabular-nums">{formatCents(p.basePriceCents)}</span>
              </Button>
            </li>
          ))}
          {products.length === 0 && <li className="py-8 text-center text-muted-foreground">No hay productos con ese criterio.</li>}
        </ul>
      </SheetContent>
    </Sheet>
  );
}
