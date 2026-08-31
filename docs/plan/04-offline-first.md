# Estrategia offline-first

### Las tres reglas de oro

1.  **Toda escritura es un evento inmutable con UUID generado en el cliente** — Reenviar es gratis: el servidor lo deduplica por PK. Sin esto, cada reintento duplica una venta.
2.  **Cada entidad tiene un único dueño de escritura** — El catálogo se escribe en la nube; las órdenes en el hub. Nadie edita lo mismo desde dos lados y no hace falta resolver merges.
3.  **Nada que necesite un número único global se genera offline** — CAE, número de factura, cobro con tarjeta real. Se encolan con estado `pending` y se resuelven al volver la red. El ticket que sale de la impresora mientras tanto es *no fiscal* y lo dice.

### Cuatro niveles de degradación

Cada nivel define exactamente qué se puede hacer y qué se bloquea. El estado actual se muestra siempre en la barra superior de todas las apps, con color y texto — nunca solo color.

L0

#### Todo operativo

Dispositivo → hub (LAN) → nube. Sincronización continua, latencia de milisegundos en el KDS.

**Órdenes ✓Cocina ✓Impresión ✓QR / Point ✓CAE ✓Delivery web ✓**

L1

#### Sin internet, LAN viva — el caso frecuente

El hub sigue siendo la fuente de verdad. El servicio continúa entero: mozos cargan, cocina despacha, caja cobra en efectivo, las comandas se imprimen. Lo que requiere red se encola y sale solo cuando vuelve.

**Órdenes ✓Cocina ✓Impresión ✓Efectivo ✓QR / Point ⏳ encoladoCAE ⏳ encoladoDelivery web ✗**

L2

#### Hub caído o dispositivo fuera de la LAN — modo restringido

La PWA opera contra su IndexedDB. El mozo puede seguir cargando *las mesas que ya tenía en pantalla*, pero no ve los cambios de los demás. Banner rojo permanente y bloqueo de cierre de caja: cerrar caja con datos parciales es peor que no cerrarla.

**Órdenes ~ solo propiasCocina ✗Impresión ✗Cobros ~ registro manualCierre de caja ✗ bloqueado**

L3

#### Recuperación

Al volver el enlace, cada outbox se vacía en orden de `lamport` con backoff exponencial. El receptor deduplica por PK. Lo que no se puede resolver solo (un pago sobre una orden anulada, un ítem descontado de stock inexistente) no se descarta: entra en `sync_incidents` y aparece en el panel de admin para que un humano decida.

**Replay ordenadoDedup por UUIDReintentos con backoffIncidencias visibles**

### Cómo se detecta el nivel

```ts
// No alcanza con navigator.onLine: miente. Sonda activa cada 5s.
const probe = async () => {
  const lan   = await ping(`http://restozest.local:3001/health`, { timeout: 800 });
  const cloud = await ping(`https://api.restozest.app/health`, { timeout: 2500 });
  return lan && cloud ? 'L0'
       : lan            ? 'L1'
       : 'L2';
};
// El resultado se guarda en un store global; cada acción de la UI consulta
// canDo(action, level) antes de habilitar su botón. Nada de sorpresas a mitad
// del flujo: si no se puede, el botón está deshabilitado y explica por qué.
```
### El outbox

```ts
type OutboxEntry = {
  id: string;            // UUIDv7 = idempotency key, generado al crear la acción
  kind: 'order_event' | 'payment' | 'stock_movement' | 'print_job';
  payload: unknown;
  lamport: number;       // contador local monótono, persistido
  attempts: number;
  nextRetryAt: number;   // backoff: 1s, 2s, 4s… tope 60s, sin límite de intentos
};

// Reglas del flush:
// 1. Estrictamente secuencial por lamport. Un evento fallado bloquea los
//    siguientes de la MISMA orden (nunca pagar antes de crear la orden).
// 2. El servidor responde 200 tanto si insertó como si ya existía.
// 3. Solo se borra del outbox con confirmación del servidor. Ante la duda,
//    se reenvía: duplicar un envío es gratis, perder una venta no.
// 4. El outbox se persiste ANTES de mostrar éxito en la UI. Optimistic UI
//    sí, pero después del write a disco.
```
**Lo que nunca se hace offline**

**No se emiten comprobantes fiscales.** El CAEA quedó como mecanismo exclusivo de contingencia desde junio de 2026, así que la vía normal es: cobrar, imprimir un ticket interno claramente marcado *«Comprobante no fiscal — pendiente de emisión»*, encolar el `fiscal_document`, y pedir el CAE al volver la conexión indicando la fecha real de la operación. Para un local que factura B/C a consumidor final el riesgo es acotado; si un cliente exige factura en el momento, el sistema debe decirlo con claridad y no simular que la emitió.

**No se cobra con tarjeta ni QR.** Se registra el medio de pago como `pending` y se concilia después, o se cobra en efectivo. Nunca marcar como `captured` algo que no se capturó.

**No se cierra caja en L2.** Sin el hub no se puede garantizar que estén todos los movimientos del turno.

### Test de caos: el criterio de aceptación real de la Fase 5

Un escenario Playwright que hay que poder correr en CI y que debe pasar antes de instalar esto en un local real:

1.  Abrir 3 mesas desde 2 dispositivos de mozo distintos, con modificadores y notas.
2.  **Cortar la WAN del hub** (bloquear el egress en el contenedor).
3.  Cargar 8 ítems más, cambiar estados en el KDS, imprimir 4 comandas, cobrar 2 mesas en efectivo, dividir una cuenta en 3.
4.  **Matar el proceso del hub** a mitad de una carga. Levantarlo. Verificar que nada se perdió.
5.  Restaurar la WAN.
6.  Afirmar: la nube tiene *exactamente* los mismos eventos, totales y pagos que el hub. Cero duplicados, cero faltantes, cero incidencias inesperadas.
