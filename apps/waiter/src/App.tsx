import { Button, Input, Label } from "@resto-zest/ui";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { PinPad } from "./components/PinPad";
import { useIdleLock } from "./components/useIdleLock";
import { fetchMe, fetchPriceLists, logout, pinLogin, registerDevice } from "./lib/api";
import { forgetDevice, getDeviceId, getVenueId, setDeviceId, setVenueId } from "./lib/storage";
import type { FloorTable } from "./lib/types";
import { FloorScreen } from "./screens/FloorScreen";
import { TableScreen } from "./screens/TableScreen";

export default function App() {
  const queryClient = useQueryClient();
  const [venueId, setVenue] = useState(getVenueId());
  const [deviceId, setDevice] = useState(getDeviceId());
  const [table, setTable] = useState<FloorTable | null>(null);
  const [pinError, setPinError] = useState<string | null>(null);
  const [pinBusy, setPinBusy] = useState(false);

  const me = useQuery({ queryKey: ["me"], queryFn: fetchMe, retry: false, enabled: Boolean(venueId) });
  const loggedIn = Boolean(venueId && me.data && me.data.venueId === venueId);
  const { locked, unlock } = useIdleLock(loggedIn);

  // El dispositivo se registra una vez, la primera vez que un mozo entra en este local.
  useEffect(() => {
    if (!loggedIn || !venueId || deviceId) return;
    registerDevice(venueId, `Tablet de ${me.data?.user.fullName ?? "mozo"}`)
      .then((d) => {
        setDeviceId(d.id);
        setDevice(d.id);
      })
      .catch(() => undefined); // se reintenta en el próximo render/recarga
  }, [loggedIn, venueId, deviceId, me.data?.user.fullName]);

  const priceLists = useQuery({
    queryKey: ["price-lists", venueId],
    queryFn: () => fetchPriceLists(venueId!),
    enabled: loggedIn,
    staleTime: 5 * 60_000,
  });
  const priceList = priceLists.data?.find((p) => p.channel === "salon" && p.active) ?? priceLists.data?.find((p) => p.active);

  async function handlePin(pin: string) {
    if (!venueId) return;
    setPinBusy(true);
    setPinError(null);
    try {
      await pinLogin(venueId, pin);
      await queryClient.invalidateQueries({ queryKey: ["me"] });
      unlock();
    } catch (e) {
      setPinError((e as Error).message || "PIN incorrecto");
    } finally {
      setPinBusy(false);
    }
  }

  async function handleLogout() {
    await logout().catch(() => undefined);
    setTable(null);
    queryClient.clear();
  }

  function handleForget() {
    forgetDevice();
    setVenue(null);
    setDevice(null);
    setTable(null);
    queryClient.clear();
  }

  // 1) Sin local configurado
  if (!venueId) return <VenueSetup onSave={(id) => (setVenueId(id), setVenue(id))} />;

  // 2) Sin sesión de este local → PIN
  if (me.isLoading) return <p className="p-6 text-muted-foreground">Cargando…</p>;
  if (!loggedIn) {
    return (
      <PinPad
        title="Ingresá tu PIN"
        subtitle="Resto Zest · Mozos"
        error={pinError}
        busy={pinBusy}
        onSubmit={handlePin}
      />
    );
  }

  // 3) Bloqueo por inactividad: el carrito y la mesa abierta se conservan debajo
  return (
    <>
      <div className="h-dvh" aria-hidden={locked} inert={locked}>
        {table && deviceId && priceList ? (
          <TableScreen
            venueId={venueId}
            table={table}
            deviceId={deviceId}
            priceListId={priceList.id}
            onBack={() => setTable(null)}
          />
        ) : table ? (
          <p className="p-6 text-muted-foreground">Preparando el dispositivo…</p>
        ) : (
          <FloorScreen
            venueId={venueId}
            userName={me.data!.user.fullName}
            onOpenTable={setTable}
            onLogout={handleLogout}
            onForgetDevice={handleForget}
          />
        )}
      </div>
      {locked && (
        <div className="fixed inset-0 z-50 bg-background" role="dialog" aria-modal="true" aria-label="Pantalla bloqueada">
          <PinPad title="Pantalla bloqueada" subtitle="Ingresá tu PIN para seguir" error={pinError} busy={pinBusy} onSubmit={handlePin} />
        </div>
      )}
    </>
  );
}

function VenueSetup({ onSave }: { onSave: (venueId: string) => void }) {
  const [value, setValue] = useState("");
  return (
    <form
      className="mx-auto flex max-w-sm flex-col gap-4 p-6"
      onSubmit={(e) => {
        e.preventDefault();
        if (value.trim()) onSave(value.trim());
      }}
    >
      <h1 className="text-xl font-semibold">Configurar este dispositivo</h1>
      <p className="text-sm text-muted-foreground">
        Pegá el identificador del local, o abrí el link de configuración que te dio el administrador.
      </p>
      <div>
        <Label htmlFor="venue-id">ID del local</Label>
        <Input id="venue-id" className="mt-2 h-12" value={value} onChange={(e) => setValue(e.target.value)} autoFocus />
      </div>
      <Button type="submit" className="h-14 text-base" disabled={!value.trim()}>
        Continuar
      </Button>
    </form>
  );
}
