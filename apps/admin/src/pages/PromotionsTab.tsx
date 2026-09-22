import {
  Button,
  Input,
  Label,
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
  type DiscountType,
  type Promotion,
  type PromotionInput,
  type PromotionScope,
  createPromotion,
  deletePromotion,
  fetchCategories,
  fetchPromotions,
  updatePromotion,
} from "../lib/catalogApi";
import { canManageCatalog, useVenue } from "../lib/venueContext";

const SCOPE_LABELS: Record<PromotionScope, string> = { all: "Todo el catálogo", category: "Una categoría", product: "Un producto" };

export function PromotionsTab() {
  const { venueId, role } = useVenue();
  const canEdit = canManageCatalog(role);
  const queryClient = useQueryClient();

  const promotionsQuery = useQuery({ queryKey: ["promotions", venueId], queryFn: () => fetchPromotions(venueId) });
  const categoriesQuery = useQuery({ queryKey: ["categories", venueId], queryFn: () => fetchCategories(venueId) });
  const [editing, setEditing] = useState<Promotion | "new" | null>(null);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["promotions", venueId] });
  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => updatePromotion(venueId, id, { active }),
    onSuccess: invalidate,
  });

  if (promotionsQuery.isLoading) return <div className="text-muted-foreground">Cargando…</div>;

  const categoriesById = new Map((categoriesQuery.data ?? []).map((c) => [c.id, c.name]));

  return (
    <div>
      <div className="flex flex-col rounded-md border border-border">
        {(promotionsQuery.data ?? []).length === 0 && (
          <p className="p-3 text-sm text-muted-foreground">Sin promociones todavía.</p>
        )}
        {(promotionsQuery.data ?? []).map((promo) => (
          <div key={promo.id} className="flex items-center gap-3 border-b border-border p-3 last:border-b-0">
            <button type="button" onClick={() => setEditing(promo)} className="flex-1 text-left text-sm hover:underline">
              {promo.name}
              <span className="text-muted-foreground">
                {" "}
                · {promo.discountType === "percent" ? `${promo.discountValue}%` : `$${promo.discountValue}`} en{" "}
                {promo.scope === "category" ? (categoriesById.get(promo.scopeId ?? "") ?? "categoría") : SCOPE_LABELS[promo.scope]}
              </span>
            </button>
            {canEdit && (
              <Switch
                checked={promo.active}
                onCheckedChange={(active) => toggleActiveMutation.mutate({ id: promo.id, active })}
              />
            )}
          </div>
        ))}
      </div>

      {canEdit && (
        <Button variant="outline" size="sm" className="mt-4" onClick={() => setEditing("new")}>
          <Plus className="mr-1 h-4 w-4" /> Promoción
        </Button>
      )}

      {editing && (
        <PromotionSheet
          key={editing === "new" ? "new" : editing.id}
          promotion={editing === "new" ? null : editing}
          categories={categoriesQuery.data ?? []}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function PromotionSheet({
  promotion,
  categories,
  onClose,
}: {
  promotion: Promotion | null;
  categories: { id: string; name: string }[];
  onClose: () => void;
}) {
  const { venueId } = useVenue();
  const queryClient = useQueryClient();
  const isNew = promotion === null;

  const [name, setName] = useState(promotion?.name ?? "");
  const [scope, setScope] = useState<PromotionScope>(promotion?.scope ?? "all");
  const [scopeId, setScopeId] = useState<string | undefined>(promotion?.scopeId ?? undefined);
  const [discountType, setDiscountType] = useState<DiscountType>(promotion?.discountType ?? "percent");
  const [discountValue, setDiscountValue] = useState(promotion?.discountValue ?? "");
  const [validFrom, setValidFrom] = useState(promotion?.validFrom?.slice(0, 10) ?? new Date().toISOString().slice(0, 10));
  const [validTo, setValidTo] = useState(promotion?.validTo?.slice(0, 10) ?? "");
  const [startsAt, setStartsAt] = useState(promotion?.startsAt?.slice(0, 5) ?? "");
  const [endsAt, setEndsAt] = useState(promotion?.endsAt?.slice(0, 5) ?? "");
  const [error, setError] = useState<string | null>(null);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["promotions", venueId] });

  const saveMutation = useMutation({
    mutationFn: () => {
      const input: PromotionInput = {
        name,
        scope,
        scopeId: scope === "all" ? null : scopeId,
        discountType,
        discountValue: Number(discountValue.replace(",", ".")),
        validFrom: new Date(validFrom).toISOString(),
        validTo: validTo ? new Date(validTo).toISOString() : null,
        startsAt: startsAt || null,
        endsAt: endsAt || null,
      };
      return isNew ? createPromotion(venueId, input) : updatePromotion(venueId, promotion.id, input);
    },
    onSuccess: () => {
      invalidate();
      onClose();
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Error al guardar"),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deletePromotion(venueId, promotion!.id),
    onSuccess: () => {
      invalidate();
      onClose();
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (scope !== "all" && !scopeId) {
      setError("Elegí una categoría");
      return;
    }
    saveMutation.mutate();
  }

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{isNew ? "Nueva promoción" : promotion.name}</SheetTitle>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">Nombre</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Alcance</Label>
            <Select value={scope} onValueChange={(v) => setScope(v as PromotionScope)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todo el catálogo</SelectItem>
                <SelectItem value="category">Una categoría</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {scope === "category" && (
            <div className="flex flex-col gap-1.5">
              <Label>Categoría</Label>
              <Select value={scopeId} onValueChange={setScopeId}>
                <SelectTrigger>
                  <SelectValue placeholder="Elegí una categoría" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label>Tipo de descuento</Label>
              <Select value={discountType} onValueChange={(v) => setDiscountType(v as DiscountType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percent">Porcentaje</SelectItem>
                  <SelectItem value="fixed">Monto fijo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="discountValue">Valor</Label>
              <Input id="discountValue" value={discountValue} onChange={(e) => setDiscountValue(e.target.value)} required />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="validFrom">Vigente desde</Label>
              <Input id="validFrom" type="date" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="validTo">Vigente hasta (opcional)</Label>
              <Input id="validTo" type="date" value={validTo} onChange={(e) => setValidTo(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="startsAt">Franja desde (opcional)</Label>
              <Input id="startsAt" type="time" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="endsAt">Franja hasta (opcional)</Label>
              <Input id="endsAt" type="time" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="mt-2 flex gap-2">
            <Button type="submit" disabled={saveMutation.isPending} className="flex-1">
              {isNew ? "Crear" : "Guardar"}
            </Button>
            {!isNew && (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  if (confirm(`¿Borrar "${promotion.name}"?`)) deleteMutation.mutate();
                }}
              >
                Borrar
              </Button>
            )}
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
