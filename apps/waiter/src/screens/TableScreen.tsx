import { formatCents, generateId } from "@resto-zest/domain";
import { Button } from "@resto-zest/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Minus, Plus, Send, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { ItemConfigSheet } from "../components/ItemConfigSheet";
import { ProductPicker } from "../components/ProductPicker";
import { fetchPosMenu, fetchSessionOrders, postOrderEvent } from "../lib/api";
import { type CartItem, type SendBatch, buildSendBatch, cartItemTotalCents } from "../lib/ordering";
import { getLamport, setLamport } from "../lib/storage";
import type { FloorTable, PosProduct, SessionOrderItem } from "../lib/types";

const STATUS_LABEL: Record<SessionOrderItem["status"], string> = {
  pending: "Enviado",
  preparing: "En preparación",
  ready: "Listo",
  served: "Servido",
  void: "Anulado",
};

const STATUS_STYLE: Record<SessionOrderItem["status"], string> = {
  pending: "bg-muted text-foreground",
  preparing: "bg-amber-100 text-amber-950",
  ready: "bg-green-100 text-green-950",
  served: "bg-muted text-muted-foreground",
  void: "bg-muted text-muted-foreground line-through",
};

export function TableScreen({
  venueId,
  table,
  deviceId,
  priceListId,
  onBack,
}: {
  venueId: string;
  table: FloorTable;
  deviceId: string;
  priceListId: string;
  onBack: () => void;
}) {
  const queryClient = useQueryClient();
  const sessionId = table.session!.id;

  const menu = useQuery({ queryKey: ["pos-menu", venueId, priceListId], queryFn: () => fetchPosMenu(venueId, priceListId), staleTime: 60_000 });
  const orders = useQuery({
    queryKey: ["session-orders", venueId, sessionId],
    queryFn: () => fetchSessionOrders(venueId, sessionId),
    refetchInterval: 5000,
  });

  const [cart, setCart] = useState<CartItem[]>([]);
  const [picking, setPicking] = useState(false);
  const [configuring, setConfiguring] = useState<PosProduct | null>(null);
  // Lote ya armado y no confirmado: si el envío falla se reintenta con los MISMOS
  // ids de evento, así el backend lo trata como duplicado y no crea ítems dobles.
  const pending = useRef<{ orderId: string; batch: SendBatch } | null>(null);

  const send = useMutation({
    mutationFn: async () => {
      const existing = orders.data?.[0];
      if (!pending.current) {
        const orderId = existing?.id ?? generateId();
        const batch = buildSendBatch({
          orderId,
          existingOrder: Boolean(existing),
          sessionId,
          tableCode: table.code,
          priceListId,
          deviceId,
          startLamport: getLamport(),
          items: cart,
        });
        setLamport(batch.nextLamport);
        pending.current = { orderId, batch };
      }
      const { orderId, batch } = pending.current;
      for (const event of batch.events) await postOrderEvent(venueId, orderId, event);
    },
    onSuccess: async () => {
      pending.current = null;
      setCart([]);
      await queryClient.invalidateQueries({ queryKey: ["session-orders", venueId, sessionId] });
    },
  });

  // Tocar el carrito después de un envío fallido invalida el lote guardado.
  function changeCart(next: CartItem[]) {
    pending.current = null;
    setCart(next);
  }

  const cartTotal = cart.reduce((sum, i) => sum + cartItemTotalCents(i), 0);
  const sentItems = (orders.data ?? []).flatMap((o) => o.items);

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-2 border-b border-border px-2 py-3">
        <Button variant="ghost" className="h-12 w-12 p-0" aria-label="Volver a las mesas" onClick={onBack}>
          <ArrowLeft />
        </Button>
        <div>
          <h1 className="text-lg font-semibold">Mesa {table.code}</h1>
          <p className="text-sm text-muted-foreground">{table.session!.guests} comensales</p>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-4">
        <section aria-label="Ya enviado a cocina" className="mb-6">
          <h2 className="mb-2 text-sm font-semibold text-muted-foreground">Enviado</h2>
          {sentItems.length === 0 && <p className="text-sm text-muted-foreground">Todavía no se envió nada a cocina.</p>}
          <ul className="flex flex-col gap-2">
            {sentItems.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate">
                    <span className="tabular-nums">{Number(item.qty)}×</span> {item.nameSnapshot}
                  </p>
                  {item.note && <p className="truncate text-xs text-muted-foreground">{item.note}</p>}
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLE[item.status]}`}>{STATUS_LABEL[item.status]}</span>
              </li>
            ))}
          </ul>
        </section>

        <section aria-label="Por enviar">
          <h2 className="mb-2 text-sm font-semibold text-muted-foreground">Por enviar</h2>
          {cart.length === 0 && <p className="text-sm text-muted-foreground">Agregá productos para armar la comanda.</p>}
          <ul className="flex flex-col gap-2">
            {cart.map((item) => (
              <li key={item.itemId} className="rounded-lg border-2 border-primary/40 px-3 py-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium">{item.name}</p>
                    {item.modifiers.length > 0 && <p className="text-xs text-muted-foreground">{item.modifiers.map((m) => m.name).join(", ")}</p>}
                    {item.note && <p className="text-xs text-muted-foreground">“{item.note}”</p>}
                  </div>
                  <span className="shrink-0 tabular-nums">{formatCents(cartItemTotalCents(item))}</span>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      className="h-11 w-11 rounded-full p-0"
                      aria-label={`Menos ${item.name}`}
                      onClick={() => changeCart(cart.map((c) => (c.itemId === item.itemId ? { ...c, qty: Math.max(1, c.qty - 1) } : c)))}
                    >
                      <Minus />
                    </Button>
                    <span className="w-6 text-center tabular-nums">{item.qty}</span>
                    <Button
                      variant="outline"
                      className="h-11 w-11 rounded-full p-0"
                      aria-label={`Más ${item.name}`}
                      onClick={() => changeCart(cart.map((c) => (c.itemId === item.itemId ? { ...c, qty: c.qty + 1 } : c)))}
                    >
                      <Plus />
                    </Button>
                  </div>
                  <Button variant="ghost" className="h-11 w-11 p-0" aria-label={`Quitar ${item.name}`} onClick={() => changeCart(cart.filter((c) => c.itemId !== item.itemId))}>
                    <Trash2 />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </main>

      <footer className="flex flex-col gap-2 border-t border-border p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {send.isError && (
          <p role="alert" className="text-center text-sm text-destructive">
            No se pudo enviar ({(send.error as Error).message}). Tocá de nuevo para reintentar; no se duplica nada.
          </p>
        )}
        <div className="flex gap-3">
          <Button variant="outline" className="h-14 flex-1 gap-2 text-base" disabled={!menu.data} onClick={() => setPicking(true)}>
            <Plus /> Agregar
          </Button>
          <Button className="h-14 flex-1 gap-2 text-base" disabled={cart.length === 0 || send.isPending} onClick={() => send.mutate()}>
            <Send /> {send.isPending ? "Enviando…" : cart.length ? `Enviar · ${formatCents(cartTotal)}` : "Enviar"}
          </Button>
        </div>
      </footer>

      {picking && menu.data && (
        <ProductPicker
          menu={menu.data}
          onClose={() => setPicking(false)}
          onPick={(product) => {
            setPicking(false);
            setConfiguring(product);
          }}
        />
      )}
      {configuring && <ItemConfigSheet product={configuring} onClose={() => setConfiguring(null)} onAdd={(item) => changeCart([...cart, item])} />}
    </div>
  );
}
