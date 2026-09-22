import { formatCents, parseCents } from "@resto-zest/domain";
import {
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  Switch,
} from "@resto-zest/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { type FormEvent, useState } from "react";
import {
  type Channel,
  type PriceList,
  createPriceList,
  deletePriceOverride,
  fetchPriceLists,
  fetchPriceOverrides,
  fetchProducts,
  updatePriceList,
  upsertPriceOverride,
} from "../lib/catalogApi";
import { canManageCatalog, useVenue } from "../lib/venueContext";

const CHANNEL_LABELS: Record<Channel, string> = { salon: "Salón", delivery: "Delivery", take_away: "Take away" };

export function PriceListsTab() {
  const { venueId, role } = useVenue();
  const canEdit = canManageCatalog(role);
  const queryClient = useQueryClient();

  const listsQuery = useQuery({ queryKey: ["price-lists", venueId], queryFn: () => fetchPriceLists(venueId) });
  const [open, setOpen] = useState<PriceList | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [name, setName] = useState("");
  const [channel, setChannel] = useState<Channel>("delivery");

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["price-lists", venueId] });

  const createMutation = useMutation({
    mutationFn: () => createPriceList(venueId, name, channel),
    onSuccess: () => {
      invalidate();
      setName("");
      setNewOpen(false);
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => updatePriceList(venueId, id, { active }),
    onSuccess: invalidate,
  });

  if (listsQuery.isLoading) return <div className="text-muted-foreground">Cargando…</div>;

  return (
    <div>
      <div className="flex flex-col rounded-md border border-border">
        {(listsQuery.data ?? []).length === 0 && <p className="p-3 text-sm text-muted-foreground">Sin listas todavía.</p>}
        {(listsQuery.data ?? []).map((list) => (
          <div key={list.id} className="flex items-center gap-3 border-b border-border p-3 last:border-b-0">
            <button type="button" onClick={() => setOpen(list)} className="flex-1 text-left text-sm hover:underline">
              {list.name} <span className="text-muted-foreground">· {CHANNEL_LABELS[list.channel]}</span>
            </button>
            {canEdit && (
              <Switch
                checked={list.active}
                onCheckedChange={(active) => toggleActiveMutation.mutate({ id: list.id, active })}
              />
            )}
          </div>
        ))}
      </div>

      {canEdit && (
        <div className="mt-4">
          {newOpen ? (
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (name.trim()) createMutation.mutate();
              }}
            >
              <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre" />
              <Select value={channel} onValueChange={(v) => setChannel(v as Channel)}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(CHANNEL_LABELS) as Channel[]).map((c) => (
                    <SelectItem key={c} value={c}>
                      {CHANNEL_LABELS[c]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button type="submit" disabled={createMutation.isPending}>
                Crear
              </Button>
              <Button type="button" variant="outline" onClick={() => setNewOpen(false)}>
                Cancelar
              </Button>
            </form>
          ) : (
            <Button variant="outline" size="sm" onClick={() => setNewOpen(true)}>
              <Plus className="mr-1 h-4 w-4" /> Lista
            </Button>
          )}
        </div>
      )}

      {open && <PriceListSheet priceList={open} canEdit={canEdit} onClose={() => setOpen(null)} />}
    </div>
  );
}

function PriceListSheet({ priceList, canEdit, onClose }: { priceList: PriceList; canEdit: boolean; onClose: () => void }) {
  const { venueId } = useVenue();
  const queryClient = useQueryClient();

  const productsQuery = useQuery({ queryKey: ["products", venueId], queryFn: () => fetchProducts(venueId) });
  const overridesQuery = useQuery({
    queryKey: ["price-overrides", venueId, priceList.id],
    queryFn: () => fetchPriceOverrides(venueId, priceList.id),
  });

  const invalidateOverrides = () =>
    queryClient.invalidateQueries({ queryKey: ["price-overrides", venueId, priceList.id] });

  const upsertMutation = useMutation({
    mutationFn: (input: { productId: string; priceCents: number }) => upsertPriceOverride(venueId, priceList.id, input),
    onSuccess: invalidateOverrides,
  });
  const deleteMutation = useMutation({
    mutationFn: (priceId: string) => deletePriceOverride(venueId, priceList.id, priceId),
    onSuccess: invalidateOverrides,
  });

  if (productsQuery.isLoading || overridesQuery.isLoading) {
    return (
      <Sheet open onOpenChange={(o) => !o && onClose()}>
        <SheetContent>
          <p className="text-muted-foreground">Cargando…</p>
        </SheetContent>
      </Sheet>
    );
  }

  const overridesByProduct = new Map((overridesQuery.data ?? []).map((o) => [o.productId, o]));

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{priceList.name}</SheetTitle>
        </SheetHeader>
        <div className="flex flex-col gap-2">
          {(productsQuery.data ?? []).map((product) => (
            <PriceOverrideRow
              key={product.id}
              productName={product.name}
              basePriceCents={product.basePriceCents}
              override={overridesByProduct.get(product.id)}
              canEdit={canEdit}
              onSave={(priceCents) => upsertMutation.mutate({ productId: product.id, priceCents })}
              onClear={(priceId) => deleteMutation.mutate(priceId)}
            />
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function PriceOverrideRow({
  productName,
  basePriceCents,
  override,
  canEdit,
  onSave,
  onClear,
}: {
  productName: string;
  basePriceCents: number;
  override: { id: string; priceCents: number } | undefined;
  canEdit: boolean;
  onSave: (priceCents: number) => void;
  onClear: (priceId: string) => void;
}) {
  const [value, setValue] = useState(override ? (override.priceCents / 100).toFixed(2).replace(".", ",") : "");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!value.trim()) {
      if (override) onClear(override.id);
      return;
    }
    try {
      onSave(parseCents(value));
    } catch {
      // valor inválido, no se envía
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2 border-b border-border py-2 last:border-b-0">
      <div className="flex-1 text-sm">
        <p>{productName}</p>
        <p className="text-xs text-muted-foreground">base: {formatCents(basePriceCents)}</p>
      </div>
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="usa el base"
        className="h-8 w-28"
        disabled={!canEdit}
      />
      {canEdit && (
        <Button type="submit" size="sm" variant="outline">
          OK
        </Button>
      )}
    </form>
  );
}
