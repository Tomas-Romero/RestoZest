import { Button } from "@resto-zest/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LogOut, Minus, Plus, Users } from "lucide-react";
import { useState } from "react";
import { fetchFloor, openSession } from "../lib/api";
import type { FloorTable } from "../lib/types";

export function FloorScreen({
  venueId,
  userName,
  onOpenTable,
  onLogout,
  onForgetDevice,
}: {
  venueId: string;
  userName: string;
  onOpenTable: (table: FloorTable) => void;
  onLogout: () => void;
  onForgetDevice: () => void;
}) {
  const queryClient = useQueryClient();
  // Hasta que llegue el WebSocket (3.5), el plano se refresca solo cada 5 s
  // para ver las mesas que abrieron los otros mozos.
  const floor = useQuery({ queryKey: ["floor", venueId], queryFn: () => fetchFloor(venueId), refetchInterval: 5000 });
  const [opening, setOpening] = useState<FloorTable | null>(null);
  const [guests, setGuests] = useState(2);

  const open = useMutation({
    mutationFn: (table: FloorTable) => openSession(venueId, table.id, guests),
    onSuccess: async (_session, table) => {
      await queryClient.invalidateQueries({ queryKey: ["floor", venueId] });
      setOpening(null);
      onOpenTable({ ...table, session: { id: _session.id, guests, status: "open", openedAt: new Date().toISOString() } });
    },
  });

  const areas = floor.data?.areas ?? [];
  const tables = floor.data?.tables ?? [];
  const sections = [
    ...areas.map((a) => ({ id: a.id, name: a.name, tables: tables.filter((t) => t.areaId === a.id) })),
    { id: "none", name: "Sin área", tables: tables.filter((t) => !t.areaId || !areas.some((a) => a.id === t.areaId)) },
  ].filter((s) => s.tables.length > 0);

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <div>
          <h1 className="text-lg font-semibold">Mesas</h1>
          <p className="text-sm text-muted-foreground">{userName}</p>
        </div>
        <div className="flex gap-1">
          <Button variant="ghost" className="h-12 px-3 text-xs" onClick={onForgetDevice}>
            Cambiar local
          </Button>
          <Button variant="outline" className="h-12 gap-2 px-4" onClick={onLogout}>
            <LogOut className="h-4 w-4" /> Salir
          </Button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-4">
        {floor.isLoading && <p className="text-muted-foreground">Cargando mesas…</p>}
        {floor.isError && <p className="text-destructive">No se pudo cargar el plano. Reintentando…</p>}
        {floor.data && sections.length === 0 && (
          <p className="text-muted-foreground">Este local todavía no tiene mesas. Cargalas desde el panel de administración.</p>
        )}
        {sections.map((section) => (
          <section key={section.id} className="mb-6" aria-label={section.name}>
            <h2 className="mb-2 text-sm font-semibold text-muted-foreground">{section.name}</h2>
            <div className="grid grid-cols-3 gap-3">
              {[...section.tables]
                .sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }))
                .map((table) => {
                  const busy = table.session !== null;
                  return (
                    <button
                      key={table.id}
                      type="button"
                      onClick={() => (busy ? onOpenTable(table) : (setGuests(Math.min(2, table.seats)), setOpening(table)))}
                      className={`flex min-h-24 flex-col items-center justify-center gap-1 rounded-xl border-2 p-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                        busy ? "border-amber-500 bg-amber-100 text-amber-950" : "border-border bg-background"
                      }`}
                    >
                      <span className="text-2xl font-semibold">{table.code}</span>
                      <span className="flex items-center gap-1 text-xs">
                        {busy ? (
                          <>
                            <Users className="h-3.5 w-3.5" aria-hidden /> Ocupada · {table.session!.guests}
                          </>
                        ) : (
                          `Libre · ${table.seats}`
                        )}
                      </span>
                    </button>
                  );
                })}
            </div>
          </section>
        ))}
      </main>

      {opening && (
        <div className="fixed inset-0 z-40 flex items-end bg-black/40" role="dialog" aria-modal="true" aria-label={`Abrir mesa ${opening.code}`}>
          <div className="w-full rounded-t-2xl bg-background p-5 pb-8">
            <h2 className="text-lg font-semibold">Abrir mesa {opening.code}</h2>
            <p className="mt-1 text-sm text-muted-foreground">¿Cuántos comensales?</p>
            <div className="my-6 flex items-center justify-center gap-6">
              <Button variant="outline" className="h-14 w-14 rounded-full" aria-label="Menos comensales" onClick={() => setGuests((g) => Math.max(1, g - 1))}>
                <Minus />
              </Button>
              <span className="w-12 text-center text-4xl font-semibold tabular-nums" aria-live="polite">
                {guests}
              </span>
              <Button variant="outline" className="h-14 w-14 rounded-full" aria-label="Más comensales" onClick={() => setGuests((g) => Math.min(30, g + 1))}>
                <Plus />
              </Button>
            </div>
            {open.isError && <p className="mb-3 text-center text-sm text-destructive">{(open.error as Error).message}</p>}
            <div className="flex gap-3">
              <Button variant="outline" className="h-14 flex-1 text-base" onClick={() => setOpening(null)}>
                Cancelar
              </Button>
              <Button className="h-14 flex-1 text-base" disabled={open.isPending} onClick={() => open.mutate(opening)}>
                Abrir mesa
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
