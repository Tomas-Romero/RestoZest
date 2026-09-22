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
} from "@resto-zest/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { type FormEvent, useState } from "react";
import {
  type DailyMenu,
  type DailyMenuInput,
  createDailyMenu,
  createDailyMenuItem,
  deleteDailyMenu,
  deleteDailyMenuItem,
  fetchDailyMenuItems,
  fetchDailyMenus,
  fetchProducts,
  updateDailyMenu,
} from "../lib/catalogApi";
import { canManageCatalog, useVenue } from "../lib/venueContext";

export function DailyMenusTab() {
  const { venueId, role } = useVenue();
  const canEdit = canManageCatalog(role);
  const queryClient = useQueryClient();

  const menusQuery = useQuery({ queryKey: ["daily-menus", venueId], queryFn: () => fetchDailyMenus(venueId) });
  const [editing, setEditing] = useState<DailyMenu | "new" | null>(null);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["daily-menus", venueId] });
  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => updateDailyMenu(venueId, id, { active }),
    onSuccess: invalidate,
  });

  if (menusQuery.isLoading) return <div className="text-muted-foreground">Cargando…</div>;

  return (
    <div>
      <div className="flex flex-col rounded-md border border-border">
        {(menusQuery.data ?? []).length === 0 && <p className="p-3 text-sm text-muted-foreground">Sin menús todavía.</p>}
        {(menusQuery.data ?? []).map((menu) => (
          <div key={menu.id} className="flex items-center gap-3 border-b border-border p-3 last:border-b-0">
            <button type="button" onClick={() => setEditing(menu)} className="flex-1 text-left text-sm hover:underline">
              {menu.name}
              <span className="text-muted-foreground">
                {" "}
                · desde {menu.validFrom}
                {menu.validTo ? ` hasta ${menu.validTo}` : ""}
                {menu.startsAt ? ` · ${menu.startsAt.slice(0, 5)}–${menu.endsAt?.slice(0, 5) ?? ""}` : ""}
              </span>
            </button>
            {canEdit && (
              <Switch
                checked={menu.active}
                onCheckedChange={(active) => toggleActiveMutation.mutate({ id: menu.id, active })}
              />
            )}
          </div>
        ))}
      </div>

      {canEdit && (
        <Button variant="outline" size="sm" className="mt-4" onClick={() => setEditing("new")}>
          <Plus className="mr-1 h-4 w-4" /> Menú
        </Button>
      )}

      {editing && (
        <DailyMenuSheet
          key={editing === "new" ? "new" : editing.id}
          menu={editing === "new" ? null : editing}
          canEdit={canEdit}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function DailyMenuSheet({ menu, canEdit, onClose }: { menu: DailyMenu | null; canEdit: boolean; onClose: () => void }) {
  const { venueId } = useVenue();
  const queryClient = useQueryClient();
  const isNew = menu === null;

  const [name, setName] = useState(menu?.name ?? "");
  const [validFrom, setValidFrom] = useState(menu?.validFrom ?? new Date().toISOString().slice(0, 10));
  const [validTo, setValidTo] = useState(menu?.validTo ?? "");
  const [startsAt, setStartsAt] = useState(menu?.startsAt?.slice(0, 5) ?? "");
  const [endsAt, setEndsAt] = useState(menu?.endsAt?.slice(0, 5) ?? "");
  const [error, setError] = useState<string | null>(null);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["daily-menus", venueId] });

  const saveMutation = useMutation({
    mutationFn: () => {
      const input: DailyMenuInput = {
        name,
        validFrom,
        validTo: validTo || null,
        startsAt: startsAt || null,
        endsAt: endsAt || null,
      };
      return isNew ? createDailyMenu(venueId, input) : updateDailyMenu(venueId, menu.id, input);
    },
    onSuccess: () => {
      invalidate();
      onClose();
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Error al guardar"),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteDailyMenu(venueId, menu!.id),
    onSuccess: () => {
      invalidate();
      onClose();
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    saveMutation.mutate();
  }

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{isNew ? "Nuevo menú del día" : menu.name}</SheetTitle>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">Nombre</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required disabled={!canEdit} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="validFrom">Vigente desde</Label>
              <Input id="validFrom" type="date" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} disabled={!canEdit} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="validTo">Vigente hasta (opcional)</Label>
              <Input id="validTo" type="date" value={validTo} onChange={(e) => setValidTo(e.target.value)} disabled={!canEdit} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="startsAt">Desde (hora, opcional)</Label>
              <Input id="startsAt" type="time" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} disabled={!canEdit} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="endsAt">Hasta (hora, opcional)</Label>
              <Input id="endsAt" type="time" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} disabled={!canEdit} />
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          {canEdit && (
            <div className="mt-2 flex gap-2">
              <Button type="submit" disabled={saveMutation.isPending} className="flex-1">
                {isNew ? "Crear" : "Guardar"}
              </Button>
              {!isNew && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    if (confirm(`¿Borrar "${menu.name}"?`)) deleteMutation.mutate();
                  }}
                >
                  Borrar
                </Button>
              )}
            </div>
          )}
        </form>

        {!isNew && <DailyMenuItemsSection dailyMenuId={menu.id} canEdit={canEdit} />}
      </SheetContent>
    </Sheet>
  );
}

function DailyMenuItemsSection({ dailyMenuId, canEdit }: { dailyMenuId: string; canEdit: boolean }) {
  const { venueId } = useVenue();
  const queryClient = useQueryClient();
  const itemsQuery = useQuery({
    queryKey: ["daily-menu-items", venueId, dailyMenuId],
    queryFn: () => fetchDailyMenuItems(venueId, dailyMenuId),
  });
  const productsQuery = useQuery({ queryKey: ["products", venueId], queryFn: () => fetchProducts(venueId) });
  const [productId, setProductId] = useState<string | undefined>();
  const [price, setPrice] = useState("");

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["daily-menu-items", venueId, dailyMenuId] });

  const createMutation = useMutation({
    mutationFn: () =>
      createDailyMenuItem(venueId, dailyMenuId, {
        productId: productId!,
        priceCents: price ? parseCents(price) : null,
      }),
    onSuccess: () => {
      invalidate();
      setProductId(undefined);
      setPrice("");
    },
  });
  const deleteMutation = useMutation({
    mutationFn: (itemId: string) => deleteDailyMenuItem(venueId, dailyMenuId, itemId),
    onSuccess: invalidate,
  });

  const productsById = new Map((productsQuery.data ?? []).map((p) => [p.id, p]));

  return (
    <div className="mt-2 border-t border-border pt-4">
      <p className="mb-2 text-sm font-medium">Platos incluidos</p>
      <div className="flex flex-col gap-2">
        {(itemsQuery.data ?? []).map((item) => (
          <div key={item.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
            <span>{productsById.get(item.productId)?.name ?? item.productId}</span>
            <div className="flex items-center gap-2">
              {item.priceCents !== null && <span className="text-muted-foreground">{(item.priceCents / 100).toFixed(2)}</span>}
              {canEdit && (
                <button type="button" onClick={() => deleteMutation.mutate(item.id)} className="text-muted-foreground hover:text-destructive">
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        ))}
        {itemsQuery.data?.length === 0 && <p className="text-sm text-muted-foreground">Sin platos todavía.</p>}
      </div>

      {canEdit && (
        <form
          className="mt-2 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (productId) createMutation.mutate();
          }}
        >
          <Select value={productId} onValueChange={setProductId}>
            <SelectTrigger className="h-8">
              <SelectValue placeholder="Elegí un producto" />
            </SelectTrigger>
            <SelectContent>
              {(productsQuery.data ?? []).map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input value={price} onChange={(e) => setPrice(e.target.value)} placeholder="precio (opcional)" className="h-8 w-32" />
          <Button type="submit" size="sm" disabled={!productId || createMutation.isPending}>
            +
          </Button>
        </form>
      )}
    </div>
  );
}
