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
} from "@resto-zest/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useState } from "react";
import {
  type ApplyBatchInput,
  type Category,
  type PriceChangeBatch,
  type RoundingOption,
  applyPriceChangeBatch,
  fetchPriceChangeBatches,
  revertPriceChangeBatch,
} from "../lib/catalogApi";
import { useVenue } from "../lib/venueContext";

type Scope = "all" | "category" | "tag";
type Op = "percent" | "fixed";

function ruleSummary(rule: PriceChangeBatch["rule"], categories: Category[]): string {
  const scopeLabel =
    rule.scope === "all"
      ? "todo el catálogo"
      : rule.scope === "category"
        ? `categoría "${categories.find((c) => c.id === rule.categoryId)?.name ?? rule.categoryId}"`
        : `tag "${rule.tag}"`;
  const opLabel =
    rule.op === "percent" ? `${rule.percent! > 0 ? "+" : ""}${rule.percent}%` : `${(rule.amountCents! / 100).toFixed(2)} pesos`;
  return `${opLabel} en ${scopeLabel}`;
}

export function PriceChangeSheet({ categories, onClose }: { categories: Category[]; onClose: () => void }) {
  const { venueId } = useVenue();
  const queryClient = useQueryClient();

  const [scope, setScope] = useState<Scope>("all");
  const [categoryId, setCategoryId] = useState<string | undefined>(categories[0]?.id);
  const [tag, setTag] = useState("");
  const [op, setOp] = useState<Op>("percent");
  const [value, setValue] = useState("");
  const [rounding, setRounding] = useState<string>("none");
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<string | null>(null);

  const batchesQuery = useQuery({
    queryKey: ["price-change-batches", venueId],
    queryFn: () => fetchPriceChangeBatches(venueId),
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["products", venueId] });
    queryClient.invalidateQueries({ queryKey: ["price-change-batches", venueId] });
  };

  const applyMutation = useMutation({
    mutationFn: (input: ApplyBatchInput) => applyPriceChangeBatch(venueId, input),
    onSuccess: (result) => {
      setLastResult(`Se actualizaron ${result.affectedCount} producto(s).`);
      setError(null);
      setValue("");
      invalidateAll();
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Error al aplicar la remarcación"),
  });

  const revertMutation = useMutation({
    mutationFn: (batchId: string) => revertPriceChangeBatch(venueId, batchId),
    onSuccess: invalidateAll,
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLastResult(null);
    try {
      const roundingValue = rounding === "none" ? undefined : (Number(rounding) as RoundingOption);
      const base =
        op === "percent"
          ? { op: "percent" as const, percent: Number(value.replace(",", ".")) }
          : { op: "fixed" as const, amountCents: parseCents(value) };

      let input: ApplyBatchInput;
      if (scope === "all") {
        input = { scope: "all", rounding: roundingValue, ...base };
      } else if (scope === "category") {
        if (!categoryId) throw new Error("Elegí una categoría");
        input = { scope: "category", categoryId, rounding: roundingValue, ...base };
      } else {
        if (!tag.trim()) throw new Error("Escribí un tag");
        input = { scope: "tag", tag: tag.trim(), rounding: roundingValue, ...base };
      }
      applyMutation.mutate(input);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Datos inválidos");
    }
  }

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Remarcación masiva</SheetTitle>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>Alcance</Label>
            <Select value={scope} onValueChange={(v) => setScope(v as Scope)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todo el catálogo</SelectItem>
                <SelectItem value="category">Por categoría</SelectItem>
                <SelectItem value="tag">Por tag</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {scope === "category" && (
            <div className="flex flex-col gap-1.5">
              <Label>Categoría</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
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

          {scope === "tag" && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="tag">Tag</Label>
              <Input id="tag" value={tag} onChange={(e) => setTag(e.target.value)} placeholder="oferta" />
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label>Operación</Label>
              <Select value={op} onValueChange={(v) => setOp(v as Op)}>
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
              <Label htmlFor="value">{op === "percent" ? "% (ej: 15 o -10)" : "Monto (+/-)"}</Label>
              <Input id="value" value={value} onChange={(e) => setValue(e.target.value)} required />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Redondeo</Label>
            <Select value={rounding} onValueChange={setRounding}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sin redondeo</SelectItem>
                <SelectItem value="10">Al múltiplo de $10</SelectItem>
                <SelectItem value="50">Al múltiplo de $50</SelectItem>
                <SelectItem value="100">Al múltiplo de $100</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
          {lastResult && <p className="text-sm text-muted-foreground">{lastResult}</p>}

          <Button type="submit" disabled={applyMutation.isPending}>
            Aplicar
          </Button>
        </form>

        <div className="mt-2 border-t border-border pt-4">
          <p className="mb-2 text-sm font-medium">Historial</p>
          <div className="flex flex-col gap-2">
            {(batchesQuery.data ?? []).map((batch) => (
              <div key={batch.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
                <div>
                  <p className={batch.revertedAt ? "text-muted-foreground line-through" : ""}>
                    {ruleSummary(batch.rule, categories)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(batch.appliedAt).toLocaleString("es-AR")} · {Object.keys(batch.snapshot).length} producto(s)
                  </p>
                </div>
                {!batch.revertedAt && (
                  <Button variant="outline" size="sm" onClick={() => revertMutation.mutate(batch.id)}>
                    Revertir
                  </Button>
                )}
              </div>
            ))}
            {batchesQuery.data?.length === 0 && <p className="text-sm text-muted-foreground">Sin remarcaciones todavía.</p>}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
