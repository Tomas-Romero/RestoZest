# Pagos y facturación

### Mercado Pago — Orders API

Mercado Pago unificó QR, Point y Checkout detrás de una sola **Orders API**. Integrá contra ella y no contra el modelo viejo de `stores/pos/orders`: te ahorra tres integraciones separadas.

| Escenario                                 | Integración                       | Comportamiento offline                                                     |
|-------------------------------------------|-----------------------------------|----------------------------------------------------------------------------|
| Cobro en mesa con QR                      | Orders API, QR dinámico por orden | Bloqueado. Se ofrece efectivo o transferencia manual                       |
| Tarjeta presencial                        | Point Smart vinculado a la orden  | Bloqueado desde el POS. El Point puede cobrar suelto y se concilia después |
| Delivery / autoservicio web               | Checkout Pro o Bricks             | N/A: si no hay internet, no hay pedido web                                 |
| Efectivo, transferencia, cuenta corriente | Registro manual en `payments`     | Siempre disponible, en todos los niveles                                   |

**Webhooks:** siempre a la nube (el hub no tiene IP pública). La nube valida la firma, actualiza el pago y lo empuja al hub por el canal de sync. Cada webhook se procesa una sola vez usando el `id` de la notificación como clave; Mercado Pago reintenta y hay que estar preparado.

### ARCA — facturación electrónica

**Flujo**

`WSAA` devuelve un ticket de acceso válido por 12 h (cachealo, no lo pidas por comprobante). `WSFEv1` autoriza el comprobante y devuelve el **CAE** con su vencimiento. Los endpoints migraron del dominio AFIP al de ARCA: apuntá a los nuevos.

**Ubicación**

Solo en la nube, en un worker dedicado. El certificado y la clave privada de cada tenant se cifran en reposo (KMS o `pgcrypto`) y jamás bajan al hub. Un hub robado no puede facturar a nombre del cliente.

**Comprobantes del rubro**

Factura B (tipo 6) a consumidor final y monotributistas, Factura C (tipo 11) si el emisor es monotributista, más notas de crédito para anulaciones. Desde 2026 hay que **discriminar correctamente las alícuotas de IVA** (gravado, no gravado, exento) en `vat_breakdown`.

**Cola y reintentos**

`fiscal_documents` con `status='queued'` y reintentos con backoff. ARCA se cae seguido; eso no puede frenar el servicio. Panel de admin con los comprobantes pendientes y rechazados, y el motivo textual del rechazo.

**Ordená la numeración antes de escribir una línea de código fiscal**

Cada punto de venta lleva su propia secuencia y **ARCA no acepta saltos**. Nunca generes el número vos: pedile a WSFEv1 el último autorizado (`FECompUltimoAutorizado`) y usá el siguiente, dentro de un lock por `(venue_id, pto_venta, doc_type)`. Dos workers concurrentes pidiendo CAE para el mismo punto de venta es el bug que después nadie entiende.
