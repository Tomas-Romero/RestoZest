# Punto de partida

El proyecto se llama *Resto Zest*.

Estas seis decisiones determinan casi todo lo que sigue. Cuatro las definiste vos; las otras dos son consecuencia directa.

| Decisión          | Elección                                                   | Consecuencia técnica                                                                       |
|-------------------|------------------------------------------------------------|--------------------------------------------------------------------------------------------|
| Alcance comercial | SaaS multi-tenant                                          | `tenant_id` + `venue_id` en toda tabla operativa, RLS en Postgres, onboarding autoservicio |
| Topología         | Nube + hub local en el salón                               | El hub es la fuente de verdad durante el servicio; la nube consolida y respalda            |
| Fiscal            | ARCA (ex-AFIP), WSAA + WSFEv1                              | El CAE se pide siempre online, desde la nube. Nunca desde el hub ni offline                |
| Pagos             | Mercado Pago Orders API + efectivo, tarjeta, transferencia | Cobro presencial con QR y Point; medios manuales siempre disponibles offline               |
| Moneda            | Enteros en centavos (`bigint`)                             | Cero errores de punto flotante; inflación y remarcaciones frecuentes sin sorpresas         |
| Identificadores   | UUIDv7 generados en el dispositivo                         | Se puede crear una orden sin red y sincronizarla después sin colisión ni renumeración      |

**El insight que ordena todo el proyecto**

El escenario que rompe un sistema gastronómico no es «la tablet perdió WiFi». Es **«se cortó internet un viernes a las 21:30 y hay seis dispositivos que necesitan ver las mismas mesas»**. Un mozo que anota offline en su tablet no le sirve al cajero ni a la cocina si nadie más ve esa orden.

Por eso la pieza central no es IndexedDB: es una mini-PC en el local que mantiene la red LAN operativa cuando la WAN se cae. IndexedDB es la *segunda* red de contención, no la primera.
