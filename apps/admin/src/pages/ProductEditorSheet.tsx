import { parseCents } from "@resto-zest/domain";
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
  Textarea,
} from "@resto-zest/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { type FormEvent, useState } from "react";
import {
  type Category,
  type PrepStation,
  type Product,
  type ProductKind,
  createProduct,
  createVariant,
  deleteProduct,
  deleteVariant,
  fetchVariants,
  updateProduct,
} from "../lib/catalogApi";
import { useVenue } from "../lib/venueContext";

const KIND_LABELS: Record<ProductKind, string> = { food: "Comida", drink: "Bebida", combo: "Combo" };
const PREP_STATION_LABELS: Record<PrepStation, string> = { kitchen: "Cocina", bar: "Barra", grill: "Parrilla" };

function centsToInputValue(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return "";
  return (cents / 100).toFixed(2).replace(".", ",");
}

export function ProductEditorSheet({
  product,
  categories,
  onClose,
}: {
  product: Product | null;
  categories: Category[];
  onClose: () => void;
}) {
  const { venueId } = useVenue();
  const queryClient = useQueryClient();
  const isNew = product === null;

  const [name, setName] = useState(product?.name ?? "");
  const [description, setDescription] = useState(product?.description ?? "");
  const [categoryId, setCategoryId] = useState<string | undefined>(product?.categoryId ?? undefined);
  const [basePrice, setBasePrice] = useState(centsToInputValue(product?.basePriceCents));
  const [cost, setCost] = useState(centsToInputValue(product?.costCents));
  const [kind, setKind] = useState<ProductKind>(product?.kind ?? "food");
  const [prepStation, setPrepStation] = useState<PrepStation>(product?.prepStation ?? "kitchen");
  const [tracksStock, setTracksStock] = useState(product?.tracksStock ?? false);
  const [available, setAvailable] = useState(product?.available ?? true);
  const [tags, setTags] = useState((product?.tags ?? []).join(", "));
  const [error, setError] = useState<string | null>(null);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["products", venueId] });

  const saveMutation = useMutation({
    mutationFn: () => {
      const input = {
        categoryId: categoryId ?? null,
        name,
        description: description || null,
        basePriceCents: parseCents(basePrice),
        costCents: cost ? parseCents(cost) : null,
        kind,
        prepStation,
        tracksStock,
        available,
        tags: tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
      };
      return isNew ? createProduct(venueId, input) : updateProduct(venueId, product.id, input);
    },
    onSuccess: () => {
      invalidate();
      onClose();
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Error al guardar"),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteProduct(venueId, product!.id),
    onSuccess: () => {
      invalidate();
      onClose();
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      saveMutation.mutate();
    } catch {
      setError("Precio inválido");
    }
  }

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{isNew ? "Nuevo producto" : product.name}</SheetTitle>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">Nombre</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="description">Descripción</Label>
            <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Categoría</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger>
                <SelectValue placeholder="Sin categoría" />
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

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="basePrice">Precio</Label>
              <Input id="basePrice" value={basePrice} onChange={(e) => setBasePrice(e.target.value)} required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cost">Costo (opcional)</Label>
              <Input id="cost" value={cost} onChange={(e) => setCost(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label>Tipo</Label>
              <Select value={kind} onValueChange={(v) => setKind(v as ProductKind)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(KIND_LABELS) as ProductKind[]).map((k) => (
                    <SelectItem key={k} value={k}>
                      {KIND_LABELS[k]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Estación</Label>
              <Select value={prepStation} onValueChange={(v) => setPrepStation(v as PrepStation)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(PREP_STATION_LABELS) as PrepStation[]).map((k) => (
                    <SelectItem key={k} value={k}>
                      {PREP_STATION_LABELS[k]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tags">Tags (separados por coma)</Label>
            <Input id="tags" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="sin_tacc, vegano" />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="tracksStock">Controla stock</Label>
            <Switch id="tracksStock" checked={tracksStock} onCheckedChange={setTracksStock} />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="available">Disponible</Label>
            <Switch id="available" checked={available} onCheckedChange={setAvailable} />
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
                  if (confirm(`¿Borrar "${product.name}"?`)) deleteMutation.mutate();
                }}
              >
                Borrar
              </Button>
            )}
          </div>
        </form>

        {!isNew && <VariantsSection productId={product.id} />}
      </SheetContent>
    </Sheet>
  );
}

function VariantsSection({ productId }: { productId: string }) {
  const { venueId } = useVenue();
  const queryClient = useQueryClient();
  const variantsQuery = useQuery({
    queryKey: ["variants", venueId, productId],
    queryFn: () => fetchVariants(venueId, productId),
  });
  const [name, setName] = useState("");
  const [priceDelta, setPriceDelta] = useState("");

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["variants", venueId, productId] });

  const createMutation = useMutation({
    mutationFn: () =>
      createVariant(venueId, productId, {
        name,
        priceDeltaCents: priceDelta ? parseCents(priceDelta) : 0,
      }),
    onSuccess: () => {
      invalidate();
      setName("");
      setPriceDelta("");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (variantId: string) => deleteVariant(venueId, productId, variantId),
    onSuccess: invalidate,
  });

  return (
    <div className="mt-2 border-t border-border pt-4">
      <p className="mb-2 text-sm font-medium">Variantes</p>
      <div className="flex flex-col gap-2">
        {(variantsQuery.data ?? []).map((variant) => (
          <div key={variant.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
            <span>
              {variant.name} <span className="text-muted-foreground">({centsToInputValue(variant.priceDeltaCents)})</span>
            </span>
            <button type="button" onClick={() => deleteMutation.mutate(variant.id)} className="text-muted-foreground hover:text-destructive">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
        {variantsQuery.data?.length === 0 && <p className="text-sm text-muted-foreground">Sin variantes.</p>}
      </div>
      <form
        className="mt-2 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) createMutation.mutate();
        }}
      >
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre" className="h-8" />
        <Input
          value={priceDelta}
          onChange={(e) => setPriceDelta(e.target.value)}
          placeholder="+/- precio"
          className="h-8 w-28"
        />
        <Button type="submit" size="sm" disabled={createMutation.isPending}>
          +
        </Button>
      </form>
    </div>
  );
}
