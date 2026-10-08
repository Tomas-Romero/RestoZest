import { formatCents, generateId } from "@resto-zest/domain";
import { Button, Input, Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@resto-zest/ui";
import { Minus, Plus } from "lucide-react";
import { useState } from "react";
import { type CartItem, cartItemTotalCents } from "../lib/ordering";
import type { PosProduct } from "../lib/types";

const COURSES = [
  { value: 1, label: "Entrada" },
  { value: 2, label: "Principal" },
  { value: 3, label: "Postre" },
];

export function ItemConfigSheet({
  product,
  onAdd,
  onClose,
}: {
  product: PosProduct;
  onAdd: (item: CartItem) => void;
  onClose: () => void;
}) {
  const [variantId, setVariantId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Record<string, string[]>>({}); // groupId -> modifierIds
  const [qty, setQty] = useState(1);
  const [course, setCourse] = useState(2);
  const [note, setNote] = useState("");

  const variant = product.variants.find((v) => v.id === variantId) ?? null;
  const chosenModifiers = product.modifierGroups.flatMap((g) =>
    g.modifiers
      .filter((m) => selected[g.id]?.includes(m.id))
      .map((m) => ({ id: m.id, name: m.name, deltaCents: m.priceDeltaCents })),
  );
  const missingGroup = product.modifierGroups.find((g) => (selected[g.id]?.length ?? 0) < g.minSelect);

  const draft: CartItem = {
    itemId: generateId(),
    productId: product.id,
    variantId: variant?.id ?? null,
    name: variant ? `${product.name} (${variant.name})` : product.name,
    unitPriceCents: product.basePriceCents + (variant?.priceDeltaCents ?? 0),
    costSnapshotCents: product.costCents,
    qty,
    modifiers: chosenModifiers,
    note: note.trim() || null,
    course,
    prepStation: product.prepStation,
  };

  function toggle(groupId: string, modifierId: string, max: number) {
    setSelected((prev) => {
      const current = prev[groupId] ?? [];
      if (current.includes(modifierId)) return { ...prev, [groupId]: current.filter((id) => id !== modifierId) };
      // grupo de elección única: reemplaza; si no, respeta el máximo
      if (max === 1) return { ...prev, [groupId]: [modifierId] };
      return current.length >= max ? prev : { ...prev, [groupId]: [...current, modifierId] };
    });
  }

  const optionClass = (active: boolean) =>
    `flex min-h-12 w-full items-center justify-between rounded-lg border-2 px-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
      active ? "border-primary bg-muted font-medium" : "border-border"
    }`;

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="max-w-none">
        <SheetHeader>
          <SheetTitle>{product.name}</SheetTitle>
          <SheetDescription>{product.description ?? "Configurá el ítem antes de agregarlo al pedido."}</SheetDescription>
        </SheetHeader>

        {product.variants.length > 0 && (
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-medium">Presentación</legend>
            <button type="button" className={optionClass(variantId === null)} aria-pressed={variantId === null} onClick={() => setVariantId(null)}>
              <span>Normal</span>
              <span className="tabular-nums">{formatCents(product.basePriceCents)}</span>
            </button>
            {product.variants.map((v) => (
              <button key={v.id} type="button" className={optionClass(variantId === v.id)} aria-pressed={variantId === v.id} onClick={() => setVariantId(v.id)}>
                <span>{v.name}</span>
                <span className="tabular-nums">{formatCents(product.basePriceCents + v.priceDeltaCents)}</span>
              </button>
            ))}
          </fieldset>
        )}

        {product.modifierGroups.map((group) => (
          <fieldset key={group.id} className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-medium">
              {group.name}{" "}
              <span className="font-normal text-muted-foreground">
                {group.minSelect > 0 ? `(elegí al menos ${group.minSelect})` : group.maxSelect === 1 ? "(opcional, una)" : `(hasta ${group.maxSelect})`}
              </span>
            </legend>
            {group.modifiers.map((m) => {
              const active = selected[group.id]?.includes(m.id) ?? false;
              return (
                <button key={m.id} type="button" className={optionClass(active)} aria-pressed={active} onClick={() => toggle(group.id, m.id, group.maxSelect)}>
                  <span>{m.name}</span>
                  {m.priceDeltaCents !== 0 && <span className="tabular-nums">+{formatCents(m.priceDeltaCents)}</span>}
                </button>
              );
            })}
          </fieldset>
        ))}

        <fieldset>
          <legend className="mb-2 text-sm font-medium">Tiempo</legend>
          <div className="grid grid-cols-3 gap-2">
            {COURSES.map((c) => (
              <button key={c.value} type="button" className={`${optionClass(course === c.value)} justify-center`} aria-pressed={course === c.value} onClick={() => setCourse(c.value)}>
                {c.label}
              </button>
            ))}
          </div>
        </fieldset>

        <div>
          <label htmlFor="item-note" className="mb-2 block text-sm font-medium">
            Nota para cocina
          </label>
          <Input id="item-note" className="h-12" value={note} onChange={(e) => setNote(e.target.value)} placeholder="sin sal, bien cocido…" />
        </div>

        <div className="mt-auto flex items-center gap-3 border-t border-border pt-4">
          <div className="flex items-center gap-2">
            <Button variant="outline" className="h-12 w-12 rounded-full p-0" aria-label="Menos cantidad" onClick={() => setQty((q) => Math.max(1, q - 1))}>
              <Minus />
            </Button>
            <span className="w-8 text-center text-xl font-semibold tabular-nums" aria-live="polite">
              {qty}
            </span>
            <Button variant="outline" className="h-12 w-12 rounded-full p-0" aria-label="Más cantidad" onClick={() => setQty((q) => q + 1)}>
              <Plus />
            </Button>
          </div>
          <Button
            className="h-14 flex-1 text-base"
            disabled={Boolean(missingGroup)}
            onClick={() => {
              onAdd(draft);
              onClose();
            }}
          >
            {missingGroup ? `Elegí ${missingGroup.name}` : `Agregar · ${formatCents(cartItemTotalCents(draft))}`}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
