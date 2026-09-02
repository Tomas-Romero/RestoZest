# Roadmap por fases

Diez fases. Cada una termina en algo que **se puede mostrar o vender**, no en «infraestructura lista». Las estimaciones asumen vos solo, con dedicación parcial.

El orden tiene una decisión deliberada: **offline-first llega en la Fase 5, no en la 1**. No se puede hacer resiliente algo que todavía no existe, y persiguiendo la resiliencia desde el día uno se pierden meses sin nada que mostrar. Lo que sí es innegociable es que el *modelo de datos* de las Fases 0–4 ya cumpla las reglas de la sección 04. Si desde el principio usás UUIDv7 del cliente, log de eventos y precios congelados, la Fase 5 es agregar transporte. Si no, es reescribir todo.

### FASE 0 — Fundaciones

*1–2 semanas*

El esqueleto sobre el que se apoya todo. Aburrido y determinante.

- **Monorepo** pnpm + Turborepo: `apps/` (api, hub, admin, pos, waiter, kds, client) y `packages/` (domain, db, ui, sync, printing).
- **Postgres + Drizzle** con las migraciones de tenants, venues, users, memberships, devices y RLS activo.
- **Auth de gestión** y el shell del panel admin con navegación por rol.
- **CI**: typecheck, lint, tests, migración contra una base efímera.

**Listo cuando**

`pnpm dev` levanta API y admin, entrás con un usuario sembrado, y un test prueba que un tenant no puede leer datos del otro.

### FASE 1 — Catálogo y panel admin

*2–3 semanas*

El primer módulo con valor real. Todo lo demás lee de acá.

- CRUD de categorías, productos, variantes, grupos de modificadores, combos y bebidas.
- Listas de precios por canal (salón / delivery / take away).
- **Remarcación masiva con deshacer**: seleccionar por categoría o tag, aplicar % o monto fijo, redondeo configurable, y un botón para revertir el lote.
- Menú del día y ofertas con vigencia por fecha y franja horaria.
- Subida de imágenes a R2 con recorte y conversión a WebP.

**Listo cuando**

Cargás un menú real de una rotisería completa —con combos y modificadores— en menos de una hora, y podés subir todos los precios un 15 % y revertirlo.

### FASE 2 — Client App — menú digital

*2 semanas*

La primera cosa que se puede *vender sola*. Un menú por QR ya justifica una suscripción, y te da un pie comercial para entrar a locales antes de tener el sistema completo.

- Next.js con SSG por tenant e ISR al publicar cambios. Carga en menos de 1,5 s en 3G.
- **Modo «solo vista»**: QR pegado en la mesa, sin carrito. Fotos, descripciones, tags de alérgenos, buscador y filtros.
- Mobile-first de verdad: navegación por categorías sticky, imágenes con `blurhash`, transiciones suaves con Motion, y una hoja de detalle de plato que se abre desde abajo.
- Accesibilidad: contraste AA, targets táctiles de 44 px, navegación completa por teclado, `prefers-reduced-motion` respetado, y textos que no dependen solo del color.

**Listo cuando**

Escaneás el QR de la mesa 12 en un celular de gama baja con mala señal y el menú se ve completo, rápido y ordenado. Lighthouse mobile ≥ 90 en Performance y ≥ 95 en Accessibility.

### FASE 3 — Núcleo operativo: mesas, órdenes y KDS

*3–4 semanas*

El corazón del sistema. Todavía todo contra la nube: sin hub, sin offline. Pero con el log de eventos ya funcionando, que es lo que hace posible la Fase 5.

- **Salón**: áreas, mesas con plano editable, apertura de sesión con cantidad de comensales.
- **App de mozos**: una mano, pulgar, botones grandes. Buscar producto en menos de 3 toques, modificadores, notas, división por tiempos (entrada / principal / postre), envío a estación.
- **KDS**: tablero Kanban con columnas Pendiente → En preparación → Listo. Tarjeta por comanda con cronómetro, alerta visual a los 12 minutos y sonora a los 20 (umbral configurable). Vista por estación.
- **`order_events`** como única vía de escritura, con proyección a `orders` y `order_items`.
- **WebSocket**: lo que carga el mozo aparece en el KDS en menos de un segundo.

**Listo cuando**

Simulás un servicio de 20 mesas entre dos personas y el KDS refleja todo sin recargar. Borrás las proyecciones, reproducís el log de eventos desde cero y obtenés exactamente el mismo estado.

### FASE 4 — POS y caja

*2–3 semanas*

Donde entra la plata. Todavía sin gateways: solo registro de medios de pago.

- Apertura y cierre de turno de caja con fondo inicial, arqueo y diferencia.
- Cobro con múltiples medios sobre una misma orden (mitad efectivo, mitad tarjeta).
- **División de cuenta** en tres modos: por partes iguales, por ítems arrastrados a cada comensal, y por monto libre. Es el flujo que más se usa y el que peor resuelven casi todos los POS.
- Descuentos con tope por rol y motivo obligatorio; anulaciones auditadas.
- Cierre Z con desglose por medio de pago, propinas y ventas por mozo.
- UI de teclado: el cajero no debería necesitar el mouse para cobrar.

**Listo cuando**

Dividís una mesa de 6 personas en 3 cuentas con medios mixtos y el cierre Z cuadra al centavo. Cobrás una mesa completa usando solo el teclado.

### FASE 5 — Hub local y offline-first

*3–4 semanas*

La fase difícil y la que define si el producto es serio. Todo lo anterior existe y funciona; ahora sobrevive a un corte.

- **`apps/hub`**: el mismo binario de la API con `ROLE=hub`, Postgres local, Docker Compose y actualizaciones por imagen versionada.
- **Descubrimiento**: mDNS (`restozest.local`) + IP fija de respaldo. La PWA prueba LAN, después nube, y recuerda cuál funcionó.
- **Sync descendente**: catálogo, usuarios y config desde la nube por cursor incremental (`updated_at` + `server_seq`).
- **Sync ascendente**: outbox del hub hacia la nube, secuencial, idempotente, con backoff.
- **Outbox en el dispositivo** (Dexie) para el nivel L2, con la misma semántica.
- **Indicador de nivel** L0–L3 en todas las apps, y `canDo(action, level)` gobernando qué botones se habilitan.
- **`sync_incidents`** y su pantalla de resolución en el admin.
- **Test de caos** en CI (ver sección 04).

**Listo cuando**

El test de caos pasa en CI y podés desenchufar el router del local durante 45 minutos de servicio simulado sin perder una sola orden ni un solo cobro.

### FASE 6 — Impresión térmica

*1–2 semanas*

Corta pero llena de detalles del mundo real. Conseguite una impresora barata de 80 mm antes de arrancar: sin hardware es imposible.

- Servicio de impresión en el hub con `node-thermal-printer`, conexión por red (`:9100`) o USB.
- `printers`, `print_routes` (estación → impresora) y `print_jobs` con reintentos.
- Plantillas: comanda, pre-cuenta, ticket de cobro, ticket fiscal con QR de ARCA, cierre Z.
- Corte automático, apertura de cajón por pulso, y codepage CP858 para acentos y ñ.
- Reimpresión auditada y test de impresora desde el admin.

**Listo cuando**

Una orden con ítems de cocina y de barra imprime dos comandas en dos impresoras distintas, y si apagás una, el trabajo espera en cola y sale al reconectarla.

### FASE 7 — Pagos Mercado Pago y facturación ARCA

*3 semanas*

La fase con más superficie regulatoria. Empezá por homologación de ARCA, que es lo que más tarda.

- Cliente de Orders API: QR dinámico por orden, Point Smart, Checkout para la web.
- Webhooks firmados en la nube, procesados una sola vez, propagados al hub.
- Cliente WSAA con caché del ticket de acceso (12 h) y cliente WSFEv1.
- Worker fiscal con cola, lock por punto de venta y reintentos.
- Gestión de certificados por tenant, cifrados en reposo, con alerta de vencimiento.
- Panel fiscal: pendientes, rechazados con motivo, y reintento manual.
- Notas de crédito para anulaciones posteriores a la emisión.

**Listo cuando**

Emitís una Factura B en homologación, la imprimís con su CAE y QR válidos, y una anulación genera la nota de crédito correspondiente. Un corte de internet a mitad del cobro deja el comprobante en cola y se emite solo al volver.

### FASE 8 — Inventario y reportes

*2–3 semanas*

Lo que convierte al sistema en una herramienta de decisión y no solo de registro.

- **Stock por movimientos**: nunca `SET qty = X`, siempre `qty_delta`. Los deltas son conmutativos y por eso sincronizan sin conflicto.
- Recetas: descuento automático de insumos al vender (bebidas 1:1, platos por receta).
- Alertas de bajo stock por umbral, con notificación en el admin y en el POS.
- **Ranking de platos** por unidades, facturación y margen. Los tres, porque no coinciden.
- **Mapa de calor** hora × día de la semana, y por área del salón usando `tables.area_id`.
- **Ganancias**: margen real usando `cost_snapshot_cents`, con desglose por categoría y por plato.
- Vistas materializadas con refresh nocturno, más una vista en vivo del día en curso.

**Listo cuando**

Vendés una gaseosa y el stock baja solo; el dueño abre el reporte y ve cuál es su plato más rentable, no solo el más pedido.

### FASE 9 — Autoservicio y delivery

*2 semanas*

Se apoya entera sobre la Fase 2. Ahora el menú vende.

- Carrito persistido, checkout con datos mínimos, elección entre pagar online o en el local.
- Ingreso de la orden web al mismo `order_events` con `channel='delivery'`: la cocina no distingue el origen.
- Aceptación o rechazo desde el admin, con tiempo estimado y aviso al cliente.
- Seguimiento del pedido por link, sin necesidad de registrarse.
- Zonas de entrega con costo por distancia y radio máximo.

**Listo cuando**

Un pedido hecho desde el celular aparece en el KDS y se despacha con el mismo flujo que una mesa.

### FASE 10 — Producto SaaS y endurecimiento

*continuo*

Dejar de tener un sistema y pasar a tener un producto que se vende solo.

- Onboarding autoservicio: alta de tenant, carga guiada del menú, enrolamiento de dispositivos por QR.
- Facturación de la suscripción, prueba gratis y control de plan.
- Panel de operaciones interno: hubs vivos, tamaño de outbox por local, comprobantes fiscales atascados, errores de impresión.
- Simulacro de restauración mensual automatizado.
- Prueba de carga: 40 mesas, 6 dispositivos, 300 órdenes por hora en un solo hub.
- Runbook del hub muerto y kit de instalación documentado para que puedas delegar la puesta en marcha.

**Si querés facturar antes**

Las Fases 0 → 1 → 2 ya son un producto vendible: menú digital por QR con panel de administración. Son unas seis semanas y te permiten entrar a locales, cobrar algo y validar el modelo mientras seguís construyendo el resto. Las Fases 3 → 4 → 6 suman el POS completo y compiten de igual a igual con lo que hay en el mercado. La Fase 5 es lo que te deja ganar frente a los competidores 100% cloud, y conviene tenerla antes de escalar a muchos locales.
